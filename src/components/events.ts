import type { AgentEvent, Evidence, InboxMessage, TokenUsage, Verdict } from "@/lib/types";

type Of<T extends AgentEvent["type"]> = Extract<AgentEvent, { type: T }>;

function first<T extends AgentEvent["type"]>(events: AgentEvent[], type: T) {
  return events.find((e): e is Of<T> => e.type === type);
}

/** Only `usage` is summed: llm_call.tokens repeats the same numbers. */
function usageTotal(events: AgentEvent[]) {
  return events.reduce((n, e) => {
    const u = (e as { usage?: TokenUsage }).usage;
    return u ? n + (u.totalTokens || u.promptTokens + u.completionTokens || 0) : n;
  }, 0);
}

export interface RunSummary {
  start?: Of<"start">;
  redaction?: Of<"redaction">;
  triage?: Of<"triage">;
  route?: Of<"route">;
  plan?: Of<"plan">;
  guardrail?: Of<"guardrail">;
  verdictEv?: Of<"verdict">;
  verdict?: Verdict;
  done?: Of<"done">;
  toolResults: Of<"tool_result">[];
  toolCalls: number;
  llmCalls: number;
  signals: Evidence[];
  tokens: number;
  deepModel?: string;
  investigateMs: number;
}

export function summarize(events: AgentEvent[]): RunSummary {
  const toolResults = events.filter((e): e is Of<"tool_result"> => e.type === "tool_result");
  const toolCallEvs = events.filter((e): e is Of<"tool_call"> => e.type === "tool_call");
  const llm = events.filter((e): e is Of<"llm_call"> => e.type === "llm_call");
  const plan = first(events, "plan");
  const route = first(events, "route");
  const verdictEv = first(events, "verdict");
  const deepModel = llm.find((c) => c.purpose === "investigate")?.model ?? toolCallEvs.find((c) => c.model && c.model !== "rules")?.model ?? plan?.model;
  // Investigation time: from the routing decision to the verdict.
  const investigateMs = route && verdictEv && route.decision === "escalate" ? Math.max(0, verdictEv.t - route.t) : 0;
  return {
    start: first(events, "start"),
    redaction: first(events, "redaction"),
    triage: first(events, "triage"),
    route,
    plan,
    guardrail: first(events, "guardrail"),
    verdictEv,
    verdict: verdictEv?.verdict,
    done: first(events, "done"),
    toolResults,
    toolCalls: toolCallEvs.length,
    llmCalls: llm.length,
    signals: toolResults.flatMap((e) => e.signals),
    tokens: usageTotal(events),
    deepModel,
    investigateMs,
  };
}

const TOOL_NAMES: Record<string, string> = {
  extract_indicators: "Message cues",
  check_sender: "Sender",
  check_link: "Link owner",
  lookup_official_contact: "Official contact",
  match_scam_patterns: "Scam playbook",
  check_phone_number: "Phone number",
  search_scam_reports: "Reports",
};

export function toolName(name: string) {
  return TOOL_NAMES[name] ?? name.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function dataOf<T>(s: RunSummary, tool: string): T | undefined {
  const r = s.toolResults.find((t) => t.name === tool && !t.error);
  return r?.data && typeof r.data === "object" ? (r.data as T) : undefined;
}

type LinkData = { hostname?: string; impersonates?: string | null; ageDays?: number | null };
type IndicatorData = { urgency?: string[]; claimedOrgs?: string[] };
type OfficialData = { org?: string; neverAsks?: string[]; officialDomains?: string[] };
type SenderData = { distinctRecipients24h?: number; spamReports7d?: number; numberAgeDays?: number };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const n = (x: number) => x.toLocaleString("en-US");

/** A few words around the urgency cue, quoted from the message: "Pay by tonight". */
function rushPhrase(body: string, word: string) {
  const i = body.toLowerCase().indexOf(word.toLowerCase());
  if (i < 0) return cap(word);
  const before = body.slice(0, i).split(/[\s:]+/).filter(Boolean).slice(-2).join(" ");
  const phrase = `${before} ${body.slice(i, i + word.length)}`.trim();
  return cap(phrase.replace(/^[^\w$]+/, ""));
}

export interface Insights {
  /** One-line reason for warnings: "NTTA never asks for toll payments through a text-message link." */
  reason: string;
  /** Calm-pause key fact about the link */
  keyFact: string;
  /** Calm-pause rush line */
  rush?: string;
  linkHost?: string;
  officialHost?: string;
  /** Short findings for the timeline and judges card */
  findings: string[];
}

export function insights(msg: InboxMessage, s: RunSummary): Insights {
  const v = s.verdict;
  const link = dataOf<LinkData>(s, "check_link");
  const ind = dataOf<IndicatorData>(s, "extract_indicators");
  const off = dataOf<OfficialData>(s, "lookup_official_contact");
  const snd = dataOf<SenderData>(s, "check_sender");
  const org = v?.verifyContact?.org ?? off?.org;
  const never = off?.neverAsks?.[0];

  const reason = v
    ? org && never && v.risk !== "safe"
      ? `${org} never asks for ${never}.`
      : v.headline
    : "";

  const fact: string[] = [];
  if (link?.impersonates) fact.push(`This link isn't ${link.impersonates}'s.`);
  if (typeof link?.ageDays === "number" && link.ageDays <= 60) fact.push(`It was created ${link.ageDays === 1 ? "1 day" : `${link.ageDays} days`} ago.`);
  const top = s.signals.find((e) => e.direction === "risk" && e.weight === "high") ?? s.signals.find((e) => e.direction === "risk");
  const keyFact = fact.length ? fact.join(" ") : top ? `${top.signal}. ${top.detail.replace(/\.$/, "")}.` : (v?.headline ?? "");

  let rush: string | undefined;
  const urg = ind?.urgency?.[0];
  if (urg) {
    rush = `"${rushPhrase(msg.body, urg)}" is the rush.`;
    if (org && never) rush += ` ${org} never asks for ${never}, so there's no real deadline here.`;
  } else if (org && never) rush = `${org} never asks for ${never}.`;

  const findings: string[] = [];
  if (link?.impersonates) findings.push(`Link owner: lookalike, not ${link.impersonates}`);
  if (typeof link?.ageDays === "number" && link.ageDays <= 60) findings.push(`Domain age: registered ${link.ageDays === 1 ? "1 day" : `${link.ageDays} days`} ago`);
  if (snd?.distinctRecipients24h && snd.distinctRecipients24h > 1000) findings.push(`Sender: texted ${n(snd.distinctRecipients24h)} people today`);
  if (snd?.spamReports7d && snd.spamReports7d > 10) findings.push(`Reports: ${n(snd.spamReports7d)} people this week`);
  if (org && never && v?.risk !== "safe") findings.push(`${org} never asks for ${never}`);
  for (const e of s.signals) {
    if (findings.length >= 5) break;
    if (e.direction !== "risk" || e.weight === "low") continue;
    if (/lookalike|brand-new|mass texting|reported by/i.test(e.signal) && findings.length) continue;
    findings.push(e.signal);
  }
  if (!findings.length) for (const e of s.signals.filter((x) => x.direction === "safe").slice(0, 3)) findings.push(e.signal);

  let officialHost: string | undefined;
  try {
    officialHost = v?.verifyContact?.url ? new URL(v.verifyContact.url).hostname.replace(/^www\./, "") : undefined;
  } catch {}
  return { reason, keyFact, rush, linkHost: link?.hostname, officialHost, findings: [...new Set(findings)].slice(0, 5) };
}

/** What the privacy filter removed, in words. */
export function redactionWords(s: RunSummary) {
  const items = s.redaction?.items ?? [];
  if (!s.redaction) return "";
  if (!items.length) return "Nothing personal to remove";
  return "Removed " + items.map((i) => `${i.count} ${i.kind.replace(/_/g, " ")}${i.count > 1 && !/s$/.test(i.kind) ? "s" : ""}`).join(", ");
}
