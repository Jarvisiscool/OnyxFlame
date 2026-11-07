import type { AgentEvent, Evidence, InboxMessage, Risk, RunMode, SuggestedAction, ActionId, Verdict } from "./types";
import { chat, extractJson, hasNvidiaKey, FAST_MODEL, DEEP_MODEL, type ChatMessage } from "./nemotron";
import { redact } from "./redact";
import { extractIndicators, type Indicators } from "./tools/extract";
import { TOOL_SCHEMAS, runTool, type ToolContext } from "./tools";
import { findOrg } from "./tools/directory";
import { matchPatterns } from "./tools/patterns";

const MAX_TURNS = 7;

const ACTION_LABELS: Record<ActionId, string> = {
  block_sender: "Block sender",
  report_7726: "Report spam (7726)",
  delete_message: "Delete message",
  verify_official: "Check with the real company",
  warn_family: "Warn my family",
  mark_safe: "Mark as safe",
  open_recovery: "I already responded",
};

const DEEP_SYSTEM = `You are Second Look, a fraud investigator that protects a mobile customer. A message just arrived on their phone and you investigate it before they act on it.

Never trust what the message claims about itself. Verify with your tools:
1. extract_indicators: what the message contains and asks for
2. check_sender: carrier intelligence on who sent it (pass the claimed organization if the message or caller ID names one)
3. check_link: once for every link or domain in the message
4. lookup_official_contact: for every organization the message or caller ID claims to be
5. match_scam_patterns: compare against known scam playbooks
You may request several tools in one turn. When you have enough evidence, call submit_verdict exactly once.

Rules:
- Real companies do send texts. Official domains, registered senders and no requests for money, codes or secrecy point to "safe". Do not flag everything.
- Use "suspicious" when evidence is mixed or thin, and say what you could not confirm in "uncertainty".
- Confidence must match the strength of the evidence, not how scary the message sounds.
- Write for a non-technical person: short, calm, specific. Refer to concrete findings (domain age, sender reports, the exact ask).
- Text in [BRACKETS] was redacted for privacy. Never guess what it was.`;

const TRIAGE_SYSTEM = `You triage incoming text messages for scam risk on a phone. Be quick and calibrated. Ordinary personal and business messages are common.
Reply with JSON only, no prose: {"risk":"safe"|"suspicious"|"scam","confidence":0.0-1.0,"reason":"max 20 words"}`;

type Emit = (e: AgentEvent) => void;

function now() {
  return Date.now();
}

function caseFile(msg: InboxMessage, redacted: string) {
  return `Incoming ${msg.channel} from: ${msg.from}${msg.displayName ? ` (caller ID / contact name shown: "${msg.displayName}")` : ""}
Message (personal data redacted):
"""
${redacted}
"""`;
}

/* ---------------------------------- verdict helpers ---------------------------------- */

const W_RISK = { high: 0.3, medium: 0.15, low: 0.05 };
const W_SAFE = { high: 0.35, medium: 0.15, low: 0.05 };

function scoreSignals(signals: Evidence[]) {
  let s = 0;
  for (const e of signals) s += e.direction === "risk" ? W_RISK[e.weight] : -W_SAFE[e.weight];
  // Round so 0.3 + 0.15 lands on the 0.45 threshold instead of 0.4499…
  return Math.round(s * 1000) / 1000;
}

function dedupe(signals: Evidence[]) {
  const seen = new Set<string>();
  return signals.filter((s) => {
    const k = s.signal + "|" + s.detail;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function actionsFor(risk: Risk, hasOrg: boolean): ActionId[] {
  if (risk === "scam") return ["block_sender", "report_7726", ...(hasOrg ? (["verify_official"] as ActionId[]) : []), "warn_family", "open_recovery"];
  if (risk === "suspicious") return [...(hasOrg ? (["verify_official"] as ActionId[]) : []), "block_sender", "report_7726", "open_recovery"];
  return ["mark_safe"];
}

function toActions(ids: ActionId[]): SuggestedAction[] {
  return [...new Set(ids)].filter((id) => id in ACTION_LABELS).map((id) => ({ id, label: ACTION_LABELS[id] }));
}

function verifyContactFor(msg: InboxMessage, ind: Indicators, orgName?: string) {
  const org = findOrg(orgName ?? "") ?? findOrg(msg.displayName ?? "") ?? findOrg(ind.claimedOrgs[0] ?? "");
  if (org) return { org: org.org, how: org.safeContact, url: org.url };
  if (matchPatterns(msg.body).matches.find((m) => m.score >= 0.66)?.id === "family_emergency")
    return { org: "your family member", how: "Call them on the number you already have saved, or ask something only they would know" };
  return undefined;
}

const sentence = (s: string) => s.trim().replace(/[.\s]+$/, "");
const joinSentences = (xs: string[]) => xs.map(sentence).filter(Boolean).join(". ") + ".";

/** Most persuasive evidence first: things the user can see for themselves beat network stats. */
const PRIORITY = [
  "Lookalike domain",
  "Lookalike sender",
  "Asks for your code",
  "Asks you to move money",
  "Asks for gift cards",
  "Caller ID can't be verified",
  "Asks for secrecy",
  "Unverified callback number",
  "Brand-new domain",
  "Raw IP",
  "Sender doesn't match brand",
  "Link isn't the company's site",
  "Matches",
  "Asks for personal details",
  "Fraud-alert format",
  "Threatens a penalty",
  "Asks you to scan",
  "Moves the chat",
  "Reported by others",
  "Mass texting",
];
function priority(e: Evidence) {
  const i = PRIORITY.findIndex((p) => e.signal.startsWith(p));
  return W_RISK[e.weight] * 10 + (i === -1 ? 0 : PRIORITY.length - i);
}

/** Rule-based verdict used offline, and as a safety net if the model never submits one. */
export function heuristicVerdict(msg: InboxMessage, ind: Indicators, signals: Evidence[]): Verdict {
  const score = scoreSignals(signals);
  const risk: Risk = score >= 0.45 ? "scam" : score >= 0.15 ? "suspicious" : "safe";
  // No signals at all means little was checked: say "safe" with modest confidence, not 70%.
  const confidence =
    risk === "scam" ? Math.min(0.97, 0.62 + (score - 0.45) * 0.45) : risk === "suspicious" ? 0.5 + Math.min(0.15, score * 0.3) : signals.length === 0 ? 0.6 : Math.min(0.95, 0.65 - score * 0.6);
  // Only a strong playbook match (2 of 3 cues or better) names the scam type.
  const top = matchPatterns(msg.body).matches.find((m) => m.score >= 0.66);
  const vc = verifyContactFor(msg, ind);
  const riskSignals = signals.filter((s) => s.direction === "risk").sort((a, b) => priority(b) - priority(a));
  const safeSignals = signals.filter((s) => s.direction === "safe");
  const headline =
    risk === "scam"
      ? vc && !vc.org.startsWith("your ")
        ? `This is not really ${vc.org.replace(/ \(.*\)$/, "")}. Don't respond.`
        : top?.id === "family_emergency"
          ? "This is probably not your family. Don't send money."
          : "This looks like a scam. Don't respond." : risk === "suspicious" ? "Something's off here. Verify before you reply." : "This message looks legitimate.";
  // Only claim what is true of this message: some safe messages do ask for money (a saved contact) or have links.
  const asksSomething = ind.requestsPayment || ind.asksForPersonalInfo || ind.asksForCode;
  const safeTail = asksSomething
    ? "It does ask for something, so if anything feels off, check with the sender another way first."
    : safeSignals.some((s) => s.signal === "Nothing to act on")
      ? ""
      : "Nothing in it asks for money, codes or personal details.";
  const explanation =
    risk === "safe"
      ? safeSignals.length
        ? `${joinSentences(safeSignals.map((s) => s.detail).slice(0, 2))} ${safeTail}`.trim()
        : asksSomething || ind.urls.length || ind.asksToCall
          ? `None of my checks found a problem with the sender${ind.urls.length ? " or the link" : ""}. ${safeTail}`.trim()
          : "It doesn't contain links, requests for money, codes or personal details. I had little to check, so treat this as a light check rather than a guarantee."
      : joinSentences(riskSignals.map((s) => s.detail).slice(0, 2));
  return {
    risk,
    confidence: Math.round(confidence * 100) / 100,
    scamType: risk === "safe" ? "Legitimate message" : top?.name ?? "Unverified message",
    headline,
    explanation,
    evidence: [...riskSignals, ...safeSignals].slice(0, 5),
    actions: toActions(actionsFor(risk, Boolean(vc))),
    verifyContact: risk === "safe" ? undefined : vc,
    uncertainty: risk === "suspicious" ? "The evidence is mixed, so I can't say for sure. Verify through an official channel before responding." : undefined,
  };
}

function normalizeVerdict(raw: Record<string, unknown>, msg: InboxMessage, ind: Indicators): Verdict {
  const riskRaw = String(raw.risk ?? "suspicious").toLowerCase();
  const risk: Risk = riskRaw === "safe" || riskRaw === "scam" ? riskRaw : "suspicious";
  let confidence = Number(raw.confidence ?? 0.6);
  if (!Number.isFinite(confidence)) confidence = 0.6;
  if (confidence > 1) confidence = confidence / 100;
  confidence = Math.max(0.05, Math.min(0.99, confidence));
  const evidence: Evidence[] = Array.isArray(raw.evidence)
    ? (raw.evidence as Record<string, unknown>[]).slice(0, 6).map((e) => ({
        signal: String(e.signal ?? "Finding"),
        detail: String(e.detail ?? ""),
        weight: (["high", "medium", "low"].includes(String(e.weight)) ? e.weight : "medium") as Evidence["weight"],
        direction: (e.direction === "safe" ? "safe" : "risk") as Evidence["direction"],
        source: String(e.source ?? "Nemotron investigation"),
      }))
    : [];
  const ids = (Array.isArray(raw.actions) ? raw.actions : []).map(String).filter((a): a is ActionId => a in ACTION_LABELS);
  const vc = verifyContactFor(msg, ind, raw.verify_organization ? String(raw.verify_organization) : undefined);
  return {
    risk,
    confidence: Math.round(confidence * 100) / 100,
    scamType: String(raw.scam_type ?? (risk === "safe" ? "Legitimate message" : "Unverified message")),
    headline: String(raw.headline ?? ""),
    explanation: String(raw.explanation ?? ""),
    evidence,
    actions: toActions(ids.length ? ids : actionsFor(risk, Boolean(vc))),
    verifyContact: risk === "safe" ? undefined : vc,
    uncertainty: raw.uncertainty ? String(raw.uncertainty) || undefined : undefined,
  };
}

/** Deterministic safeguards layered on top of the model: honest confidence, no unsafe "safe" calls. */
export function applyGuardrails(v: Verdict, signals: Evidence[], msg: InboxMessage, ind: Indicators): Verdict {
  const out = { ...v };
  const hardRisk = signals.filter(
    (s) => s.direction === "risk" && s.weight === "high" && /Lookalike|Brand-new|Asks for your code|Caller ID can't|Asks for secrecy|Asks you to move money|Raw IP|Disguised/.test(s.signal),
  );
  if (out.risk === "safe" && hardRisk.length) {
    out.risk = hardRisk.length >= 2 ? "scam" : "suspicious";
    out.confidence = hardRisk.length >= 2 ? 0.8 : 0.6;
    out.guardrail = `Raised from "safe": ${hardRisk.map((s) => s.signal.toLowerCase()).join(", ")}`;
    out.headline = out.risk === "scam" ? "Don't respond. This has strong scam signs." : "Something's off here. Verify before you reply.";
    out.evidence = dedupe([...hardRisk, ...out.evidence]).slice(0, 5);
    out.actions = toActions(actionsFor(out.risk, Boolean(verifyContactFor(msg, ind))));
    out.verifyContact = verifyContactFor(msg, ind);
  }
  const anyRisk = signals.some((s) => s.direction === "risk");
  if (out.risk === "scam" && out.confidence > 0.85 && !anyRisk) {
    out.confidence = 0.75;
    out.guardrail = "Confidence capped: no tool independently confirmed a risk signal";
    out.uncertainty ||= "My tools didn't independently confirm the risk, so treat this as a strong suspicion rather than proof.";
  }
  if (!out.evidence.length) out.evidence = signals.slice(0, 5);
  if (!out.headline) out.headline = out.risk === "safe" ? "This message looks legitimate." : out.risk === "scam" ? "This looks like a scam. Don't respond." : "Verify before you reply.";
  return out;
}

/* ---------------------------------- the agent ---------------------------------- */

export interface AnalyzeOptions {
  forceOffline?: boolean;
  /** Offline mode adds short pauses so the trace is readable on stage. Off for evals. */
  pace?: boolean;
}

export async function runAnalysis(msg: InboxMessage, emit: Emit, opts: AnalyzeOptions = {}) {
  const started = now();
  const mode: RunMode = !opts.forceOffline && hasNvidiaKey() ? "live" : "offline";
  let llmCalls = 0;
  let toolCalls = 0;
  const pace = (ms: number) => (mode === "offline" && opts.pace !== false ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());

  emit({ type: "start", mode, models: { fast: FAST_MODEL, deep: DEEP_MODEL }, t: now() });

  // 1. Privacy first: redact before any model sees the text.
  const { redacted, items } = redact(msg.body);
  emit({ type: "redaction", redacted, items, t: now() });
  await pace(250);

  const ind = extractIndicators(redacted);
  const ctx: ToolContext = { text: redacted, from: msg.from, displayName: msg.displayName };
  const signals: Evidence[] = [];

  // 2. Fast triage with the small model.
  let triage: { risk: Risk; confidence: number; reason: string };
  const tStart = now();
  if (mode === "live") {
    try {
      const res = await chat({
        model: FAST_MODEL,
        noThink: true,
        maxTokens: 400,
        temperature: 0,
        messages: [
          { role: "system", content: TRIAGE_SYSTEM },
          { role: "user", content: caseFile(msg, redacted) },
        ],
      });
      llmCalls++;
      const j = extractJson<{ risk?: string; confidence?: number; reason?: string }>(res.content || res.reasoning);
      const r = String(j?.risk ?? "suspicious").toLowerCase();
      triage = {
        risk: r === "safe" || r === "scam" ? r : "suspicious",
        confidence: Math.max(0, Math.min(1, Number(j?.confidence ?? 0.5) > 1 ? Number(j?.confidence) / 100 : Number(j?.confidence ?? 0.5))),
        reason: j?.reason ? String(j.reason) : "Triage model returned no reason",
      };
    } catch (e) {
      emit({ type: "notice", level: "warn", text: `Triage model unavailable (${(e as Error).message.slice(0, 120)}). Escalating to full investigation.`, t: now() });
      triage = { risk: "suspicious", confidence: 0.5, reason: "Triage unavailable" };
    }
  } else {
    const s =
      scoreSignals(matchPatterns(redacted).signals) +
      (ind.urls.length ? 0.1 : 0) +
      (ind.asksForCode || ind.secrecy || ind.giftCardPayment || ind.moveMoney ? 0.3 : 0) +
      (ind.callbackAlarm || ind.qrCode || ind.offPlatformChat.length || ind.asksForPersonalInfo ? 0.15 : 0) +
      (Math.min(ind.urgencyCount, 6) + ind.threats.length) * 0.05 +
      (ind.capsRatio > 0.6 ? 0.1 : 0) +
      ind.paymentMethods.length * 0.1 +
      (ind.wrongNameGreeting ? 0.05 : 0);
    const risk: Risk = s >= 0.45 ? "scam" : s >= 0.12 ? "suspicious" : "safe";
    triage = {
      risk,
      confidence: risk === "safe" ? 0.86 : 0.6,
      reason: risk === "safe" ? "No links, payment asks, code requests or pressure language" : "Contains cues that need a closer look",
    };
  }
  emit({ type: "triage", model: mode === "live" ? FAST_MODEL : "rule-based triage (offline)", ...triage, ms: now() - tStart, t: now() });
  await pace(300);

  // 3. Route: fast path only when the message has nothing to investigate.
  const nothingToCheck =
    ind.urls.length === 0 && !ind.asksForCode && ind.paymentMethods.length === 0 && ind.amounts.length === 0 && !ind.asksToCall && !ind.secrecy;
  const fastPath = triage.risk === "safe" && triage.confidence >= 0.8 && nothingToCheck;
  emit({
    type: "route",
    decision: fastPath ? "fast_path" : "escalate",
    reason: fastPath
      ? "Low risk and nothing to verify. Answered by the small model alone."
      : `Escalating to ${mode === "live" ? "the deep investigator" : "full investigation"}: ${
          [ind.urls.length ? "has links" : null, ind.claimedOrgs.length ? `claims to be ${ind.claimedOrgs[0]}` : null, ind.asksForCode ? "asks for a code" : null, ind.amounts.length ? "mentions money" : null, triage.risk !== "safe" ? `triage flagged ${triage.risk}` : null]
            .filter(Boolean)
            .join(", ") || "needs verification"
        }.`,
    t: now(),
  });

  let verdict: Verdict;
  let verdictModel = mode === "live" ? FAST_MODEL : "rules";

  if (fastPath) {
    const ev: Evidence[] = [{ signal: "Nothing risky to act on", detail: "No links, no requests for money, codes or personal details", weight: "medium", direction: "safe", source: "Message analysis" }];
    if (ind.deliversCode)
      ev.push({ signal: "Code delivered, not requested", detail: "It sends you a one-time code and does not ask for it back. Never share it with anyone who contacts you.", weight: "medium", direction: "safe", source: "Message analysis" });
    verdict = {
      risk: "safe",
      confidence: Math.round(triage.confidence * 100) / 100,
      scamType: "Legitimate message",
      headline: ind.deliversCode ? "Looks legit. Keep this code to yourself." : "This message looks legitimate.",
      explanation: `${triage.reason}${triage.reason.endsWith(".") ? "" : "."} ${ind.deliversCode ? "If anyone calls or texts asking for this code, that's the scam." : "No further checks were needed."}`,
      evidence: ev,
      actions: toActions(["mark_safe"]),
    };
  } else if (mode === "live") {
    try {
      const res = await deepInvestigation(msg, redacted, triage, ctx, ind, emit, signals, () => {
        llmCalls++;
      }, () => {
        toolCalls++;
      });
      verdict = res;
      verdictModel = DEEP_MODEL;
    } catch (e) {
      emit({ type: "notice", level: "warn", text: `Deep model unavailable (${(e as Error).message.slice(0, 140)}). Finishing with rule-based investigation.`, t: now() });
      toolCalls += await scriptedInvestigation(msg, ctx, ind, emit, signals, async () => {});
      verdict = heuristicVerdict(msg, ind, dedupe(signals));
      verdictModel = "rules (fallback)";
    }
  } else {
    toolCalls += await scriptedInvestigation(msg, ctx, ind, emit, signals, pace);
    verdict = heuristicVerdict(msg, ind, dedupe(signals));
  }

  verdict = applyGuardrails(verdict, dedupe(signals), msg, ind);
  emit({ type: "verdict", verdict, model: verdictModel, t: now() });
  emit({ type: "done", totalMs: now() - started, llmCalls, toolCalls, t: now() });
  return verdict;
}

/** Offline plan: the same tools in a fixed order (also the fallback if the API fails). */
async function scriptedInvestigation(
  msg: InboxMessage,
  ctx: ToolContext,
  ind: Indicators,
  emit: Emit,
  signals: Evidence[],
  pace: (ms: number) => Promise<unknown>,
) {
  const plan: { name: string; args: Record<string, unknown> }[] = [{ name: "extract_indicators", args: {} }];
  plan.push({ name: "check_sender", args: { sender: msg.from, ...(msg.displayName || ind.claimedOrgs[0] ? { claimed_name: msg.displayName ?? ind.claimedOrgs[0] } : {}) } });
  for (const url of ind.urls.slice(0, 3)) plan.push({ name: "check_link", args: { url } });
  const orgs = [...new Set([msg.displayName ? findOrg(msg.displayName)?.org : undefined, ...ind.claimedOrgs].filter(Boolean))] as string[];
  for (const org of orgs.slice(0, 2)) plan.push({ name: "lookup_official_contact", args: { organization: org } });
  plan.push({ name: "match_scam_patterns", args: {} });

  emit({ type: "thought", model: "planner (offline)", text: `Plan: ${plan.map((p) => p.name).join(" → ")}`, t: now() });
  let i = 0;
  for (const step of plan) {
    const id = `s${++i}`;
    emit({ type: "tool_call", id, name: step.name, args: step.args, t: now() });
    const t0 = now();
    const out = await runTool(step.name, step.args, ctx);
    await pace(220);
    signals.push(...out.signals);
    emit({ type: "tool_result", id, name: step.name, summary: out.summary, signals: out.signals, data: out.data, ms: now() - t0, t: now() });
  }
  return plan.length;
}

async function deepInvestigation(
  msg: InboxMessage,
  redacted: string,
  triage: { risk: Risk; confidence: number; reason: string },
  ctx: ToolContext,
  ind: Indicators,
  emit: Emit,
  signals: Evidence[],
  onLlm: () => void,
  onTool: () => void,
): Promise<Verdict> {
  const messages: ChatMessage[] = [
    { role: "system", content: DEEP_SYSTEM },
    {
      role: "user",
      content: `${caseFile(msg, redacted)}

Fast triage said: ${triage.risk} (${Math.round(triage.confidence * 100)}%): ${triage.reason}
Investigate with your tools, then call submit_verdict.`,
    },
  ];
  let nudged = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await chat({ model: DEEP_MODEL, messages, tools: TOOL_SCHEMAS, temperature: 0.2, maxTokens: 2500 });
    onLlm();
    const thought = (res.reasoning || (res.toolCalls.length ? res.content : "")).trim();
    if (thought) emit({ type: "thought", model: DEEP_MODEL, text: thought.length > 700 ? thought.slice(0, 700) + "…" : thought, t: now() });

    if (res.toolCalls.length) {
      messages.push({ role: "assistant", content: res.content || null, tool_calls: res.toolCalls });
      for (const call of res.toolCalls) {
        let args: Record<string, unknown> = {};
        try {
          args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = extractJson<Record<string, unknown>>(call.function.arguments) ?? {};
        }
        if (call.function.name === "submit_verdict") {
          return normalizeVerdict(args, msg, ind);
        }
        emit({ type: "tool_call", id: call.id, name: call.function.name, args, t: now() });
        const t0 = now();
        const out = await runTool(call.function.name, args, ctx);
        onTool();
        signals.push(...out.signals);
        emit({ type: "tool_result", id: call.id, name: call.function.name, summary: out.summary, signals: out.signals, data: out.data, ms: now() - t0, t: now() });
        const payload = JSON.stringify({ summary: out.summary, signals: out.signals, data: out.data });
        messages.push({ role: "tool", tool_call_id: call.id, name: call.function.name, content: payload.length > 3000 ? payload.slice(0, 3000) : payload });
      }
      continue;
    }

    // No tool call: maybe it wrote the verdict as plain JSON.
    const j = extractJson<Record<string, unknown>>(res.content);
    if (j && "risk" in j) return normalizeVerdict(j, msg, ind);
    if (nudged) break;
    nudged = true;
    messages.push({ role: "assistant", content: res.content || "" });
    messages.push({ role: "user", content: "Continue the investigation with tools if needed, then call submit_verdict." });
  }

  emit({ type: "notice", level: "info", text: "Investigator didn't submit a verdict in time. Concluding from the evidence it gathered.", t: now() });
  return heuristicVerdict(msg, ind, dedupe(signals));
}
