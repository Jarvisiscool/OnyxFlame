"use client";

import { useEffect, useRef, useState } from "react";
import type { Evidence, InboxMessage } from "@/lib/types";
import type { Run } from "./useAnalysis";
import { extras, summarize, tokensOf, type PlanEvent, type RunSummary, type UIEvent } from "./events";
import { Pipeline } from "./Pipeline";
import { Checking, ConfidenceBar, ModelChip, Ms, Pill, RISK_STYLE, cleanQuotes, fmtTokens } from "./ui";

const TOOL_LABEL: Record<string, string> = {
  extract_indicators: "Read what the message asks for",
  check_sender: "Checked the sender against carrier data",
  check_link: "Investigated the link",
  lookup_official_contact: "Looked up the real organization",
  match_scam_patterns: "Compared against known scam playbooks",
  submit_verdict: "Submitted its verdict",
};

function SignalChips({ signals }: { signals: Evidence[] }) {
  if (!signals.length) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1">
      {signals.map((s, i) => (
        <li
          key={i}
          title={s.detail}
          className={`rounded-md px-1.5 py-0.5 text-[12px] font-semibold ${s.direction === "risk" ? "bg-scam-wash text-scam" : "bg-safe-wash text-safe"}`}
        >
          <span aria-hidden>{s.direction === "risk" ? "▲ " : "✓ "}</span>
          <span className="sr-only">{s.direction === "risk" ? "Warning sign: " : "Reassuring: "}</span>
          {cleanQuotes(s.signal)}
        </li>
      ))}
    </ul>
  );
}

type ToolCall = Extract<UIEvent, { type: "tool_call" }>;
type ToolResult = Extract<UIEvent, { type: "tool_result" }>;
type Step = { kind: "event"; ev: UIEvent } | { kind: "tool"; call: ToolCall; result?: ToolResult };

function buildSteps(events: UIEvent[]): Step[] {
  const steps: Step[] = [];
  const byId = new Map<string, Step & { kind: "tool" }>();
  for (const ev of events) {
    if (ev.type === "tool_call") {
      // submit_verdict is shown as the verdict itself, not as a step.
      if (ev.name === "submit_verdict") continue;
      const s = { kind: "tool" as const, call: ev };
      byId.set(ev.id, s);
      steps.push(s);
    } else if (ev.type === "tool_result") {
      const s = byId.get(ev.id);
      if (s) s.result = ev;
    } else if (ev.type !== "start" && ev.type !== "verdict" && ev.type !== "done") {
      steps.push({ kind: "event", ev });
    }
  }
  return steps;
}

function StepRow({
  n,
  title,
  meta,
  children,
  active,
  tool,
}: {
  n: number;
  title: React.ReactNode;
  meta?: React.ReactNode;
  children?: React.ReactNode;
  active?: boolean;
  tool?: boolean;
}) {
  return (
    <li className="relative grid grid-cols-[24px_minmax(0,1fr)] gap-3 pb-4 last:pb-0">
      <span className="absolute top-6 bottom-0 left-[11.5px] w-px bg-line" aria-hidden />
      <span
        className={`relative z-10 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold tnum ${
          active ? "bg-agent text-white" : tool ? "bg-agent-wash text-agent" : "bg-panel text-ink-soft ring-1 ring-line"
        }`}
        aria-hidden
      >
        {n}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[14px] font-semibold leading-tight">{title}</span>
          {meta && <span className="flex items-center gap-2 text-[12px] text-muted">{meta}</span>}
        </div>
        {children}
        {active && (
          <div className="mt-2 h-0.5 w-32 overflow-hidden rounded-full bg-agent/10" aria-hidden>
            <div className="scan-line h-full" />
          </div>
        )}
      </div>
    </li>
  );
}

function Expandable({ text, lines = 3 }: { text: string; lines?: 2 | 3 | 4 }) {
  const [open, setOpen] = useState(false);
  // Rough line estimate (about 60 characters per line in the trace column) avoids measuring the DOM.
  const estLines = text.split("\n").reduce((n, p) => n + Math.max(1, Math.ceil(p.length / 60)), 0);
  const long = estLines > lines;
  const clamp = { 2: "line-clamp-2", 3: "line-clamp-3", 4: "line-clamp-4" }[lines];
  return (
    <div className="mt-1">
      <p className={`whitespace-pre-wrap text-[13px] leading-snug text-ink-soft ${open || !long ? "" : clamp}`}>{text}</p>
      {long && (
        <button onClick={() => setOpen((o) => !o)} className="mt-0.5 min-h-6 text-[12px] font-semibold text-agent" aria-expanded={open}>
          {open ? "Show less" : "Show all"}
        </button>
      )}
    </div>
  );
}

function CallMeta({ ev, ms, hideModel }: { ev: object; ms?: number; hideModel?: string }) {
  const m = extras(ev).model;
  const model = m && m !== hideModel ? m : undefined;
  const tokens = tokensOf(ev);
  return (
    <>
      {model && <ModelChip model={model} />}
      {tokens > 0 && <span className="tnum">{fmtTokens(tokens)}</span>}
      {ms !== undefined && <Ms ms={ms} />}
    </>
  );
}

function argText(args: Record<string, unknown>) {
  return Object.entries(args)
    .map(([k, v]) => `${k}: ${typeof v === "string" ? `"${v}"` : JSON.stringify(v)}`)
    .join(", ");
}

/** `deep` is the investigating model; tool rows only name a model when it differs, to keep the trace quiet. */
function renderStep(step: Step, i: number, running: boolean, deep?: string) {
  const n = i + 1;
  if (step.kind === "tool") {
    const { call, result } = step;
    const ms = result ? (extras(result).ms ?? result.ms) : undefined;
    return (
      <StepRow
        key={call.id + i}
        n={n}
        tool
        active={!result && running}
        title={TOOL_LABEL[call.name] ?? call.name}
        meta={<CallMeta ev={{ ...call, usage: extras(result ?? {}).usage ?? extras(call).usage }} ms={ms} hideModel={deep} />}
      >
        <p className="mt-0.5 truncate font-mono text-[12px] text-muted" title={`${call.name}(${argText(call.args)})`}>
          {call.name}({argText(call.args)})
        </p>
        {result && <p className="mt-1 text-[13px] leading-snug text-ink-soft">{result.summary}</p>}
        {result && <SignalChips signals={result.signals} />}
      </StepRow>
    );
  }
  const ev = step.ev;
  switch (ev.type) {
    case "redaction":
      return (
        <StepRow key={i} n={n} title="Removed personal data before any model saw it" meta={<CallMeta ev={ev} />}>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            {ev.items.length ? ev.items.map((x) => `${x.count} ${x.kind}${x.count > 1 ? "s" : ""}`).join(", ") + " redacted." : "Nothing personal found. Text sent as is."}
          </p>
          {ev.items.length > 0 && <p className="mt-1 line-clamp-2 rounded-md bg-wash px-2 py-1 text-[12px] leading-snug text-muted">{ev.redacted}</p>}
        </StepRow>
      );
    case "triage":
      return (
        <StepRow key={i} n={n} title="Quick triage" meta={<CallMeta ev={ev} ms={ev.ms} />}>
          <div className="mt-1 flex items-center gap-2">
            <Pill risk={ev.risk} small />
            <span className="text-[12px] font-semibold text-muted tnum">{Math.round(ev.confidence * 100)}%</span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">{ev.reason}</p>
        </StepRow>
      );
    case "route":
      return (
        <StepRow key={i} n={n} title={ev.decision === "fast_path" ? "Fast path: no deep investigation needed" : "Escalated to a full investigation"}>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{ev.reason}</p>
        </StepRow>
      );
    case "plan":
      return (
        <StepRow key={i} n={n} title="Planned the investigation" meta={<CallMeta ev={ev} ms={extras(ev).ms} />}>
          <Expandable text={(ev as PlanEvent).text} lines={4} />
        </StepRow>
      );
    case "thought":
      return (
        <StepRow key={i} n={n} title={ev.text.startsWith("Plan:") ? "Planned the investigation" : "Reasoned about the evidence"} meta={<CallMeta ev={ev} ms={extras(ev).ms} />}>
          <Expandable text={ev.text} lines={2} />
        </StepRow>
      );
    case "notice":
      return (
        <StepRow key={i} n={n} title={ev.level === "warn" ? "Switched to a backup" : "Note"}>
          <p className="mt-0.5 text-[13px] leading-snug text-caution">{ev.text}</p>
        </StepRow>
      );
    default:
      return null;
  }
}

function Trace({ events, running, deep }: { events: UIEvent[]; running: boolean; deep?: string }) {
  const steps = buildSteps(events);
  const scroller = useRef<HTMLDivElement>(null);

  // Follow the newest step while the agent works (only matters when the panel scrolls).
  useEffect(() => {
    const el = scroller.current;
    if (!el || !running) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [steps.length, running]);

  return (
    <section aria-label="What the agent did" className="flex min-h-0 flex-col rounded-2xl bg-panel ring-1 ring-line xl:order-1">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2">
        <h3 className="font-display text-[15px] font-bold">What the agent did</h3>
        {steps.length > 0 && <span className="text-[12px] text-muted tnum">{steps.length} steps</span>}
      </div>
      <div ref={scroller} className="phone-scroll min-h-0 flex-1 px-4 pb-4 xl:overflow-y-auto">
        {steps.length === 0 ? (
          running ? (
            <Checking label="Starting" />
          ) : (
            <p className="text-[13px] text-muted">No steps ran.</p>
          )
        ) : (
          <ol>{steps.map((s, i) => renderStep(s, i, running, deep))}</ol>
        )}
      </div>
    </section>
  );
}

function Tally({ s }: { s: RunSummary }) {
  const risk = s.signals.filter((x) => x.direction === "risk");
  const safe = s.signals.filter((x) => x.direction === "safe");
  if (!s.signals.length) return null;
  return (
    <div className="mt-5">
      <p className="text-[13px] font-semibold text-ink-soft tnum">
        So far: {risk.length} warning sign{risk.length === 1 ? "" : "s"}, {safe.length} reassuring
      </p>
      <SignalChips signals={s.signals.slice(-6)} />
    </div>
  );
}

function VerdictPanel({ s, running, error, onRetry }: { s: RunSummary; running: boolean; error?: string; onRetry: () => void }) {
  const v = s.verdict;
  const base = "flex min-h-0 flex-col rounded-2xl xl:order-2";
  if (!v && error) {
    return (
      <section aria-label="Verdict" className={`${base} bg-panel p-5 ring-2 ring-caution/50`}>
        <p className="font-display text-[26px] font-bold leading-tight text-caution">Couldn&apos;t finish this check</p>
        <p className="mt-2 text-[15px] leading-relaxed text-ink">
          The agent didn&apos;t reach a verdict, so this message is <span className="font-semibold">not</span> marked safe. Don&apos;t tap links or reply until it&apos;s checked.
        </p>
        <p className="mt-3 rounded-lg bg-wash px-3 py-2 font-mono text-[12px] leading-snug break-words text-muted">{error}</p>
        <button onClick={onRetry} className="mt-4 min-h-9 self-start rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink-soft">
          Try again
        </button>
      </section>
    );
  }
  if (!v) {
    return (
      <section aria-label="Verdict" className={`${base} bg-panel p-5 ring-1 ring-line`}>
        <Checking label={running ? "Investigating" : "Waiting"} />
        <p className="mt-3 max-w-sm text-[15px] leading-snug text-ink-soft">The verdict appears once the evidence is in.</p>
        <Tally s={s} />
      </section>
    );
  }
  const st = RISK_STYLE[v.risk];
  return (
    <section aria-label="Verdict" className={`${base} ${st.wash}`}>
      <div className="animate-sheet-up phone-scroll min-h-0 flex-1 p-5 xl:overflow-y-auto">
        <span className={`block font-display text-[44px] font-extrabold leading-[0.9] whitespace-nowrap ${st.text}`}>{st.word}</span>
        <p className="mt-2 font-display text-[19px] font-semibold leading-snug">{v.headline}</p>
        <div className="mt-3 flex items-center gap-3">
          <span className="shrink-0 text-[13px] font-semibold text-ink-soft">{v.scamType}</span>
          <div className="flex-1">
            <ConfidenceBar value={v.confidence} risk={v.risk} />
          </div>
        </div>
        {s.verdictEv && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
            Decided by <ModelChip model={s.verdictEv.model} />
          </p>
        )}
        <p className="mt-3 text-[15px] leading-relaxed">{v.explanation}</p>
        {v.uncertainty && (
          <p className="mt-3 rounded-lg bg-panel/70 px-3 py-2 text-[13px] leading-snug text-ink-soft">
            <span className="font-semibold text-caution">What it couldn&apos;t confirm:</span> {v.uncertainty}
          </p>
        )}
        {v.guardrail && (
          <p className="mt-3 rounded-lg bg-panel/70 px-3 py-2 text-[13px] leading-snug text-ink-soft">
            <span className="font-semibold">Safety rule applied:</span> {v.guardrail}
          </p>
        )}
        {v.evidence.length > 0 && (
          <>
            <h4 className="mt-4 text-[13px] font-bold">Evidence</h4>
            <ul className="mt-1.5 space-y-1.5">
              {v.evidence.map((e, i) => (
                <li key={i} className="rounded-lg bg-panel/80 px-3 py-2">
                  <span className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <span className={`text-[13px] font-bold ${e.direction === "risk" ? "text-scam" : "text-safe"}`}>{cleanQuotes(e.signal)}</span>
                    <span className="text-[11px] text-muted">{e.source}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{e.detail}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function EmptyState({ controls, models }: { controls: React.ReactNode; models?: { fast: string; deep: string } }) {
  return (
    <div className="flex min-w-0 flex-col justify-center gap-6 py-4 lg:h-full">
      <div>
        <h2 className="max-w-xl font-display text-[34px] font-bold leading-[1.05]">Every message gets a second look before you act on it.</h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          No one types a prompt. When a text or voicemail arrives, the agent strips your personal data, sorts it with a small model, and sends anything risky to a larger model that checks
          the sender, the link and the claims with real tools.
        </p>
      </div>
      <Pipeline running={false} models={models} />
      {controls}
    </div>
  );
}

const CHANNEL_WORD = { voicemail: "voicemail", email: "email", sms: "text" } as const;

export function Investigation({
  msg,
  run,
  onRetry,
  models,
  controls,
}: {
  msg?: InboxMessage;
  run?: Run;
  controls: React.ReactNode;
  onRetry: (m: InboxMessage) => void;
  models?: { fast: string; deep: string };
}) {
  if (!msg) return <EmptyState controls={controls} models={models} />;
  const events = (run?.events ?? []) as UIEvent[];
  const s = summarize(run?.events ?? []);
  const running = run?.status !== "done";
  const error = !s.verdict ? run?.error : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-3 lg:h-full lg:min-h-0 lg:overflow-y-auto xl:overflow-visible">
      <header className="flex shrink-0 flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1 basis-80">
        <p className="text-[13px] text-muted">
          Investigating a {CHANNEL_WORD[msg.channel]} from{" "}
          <span className="font-semibold text-ink">
            {msg.displayName ? `"${msg.displayName}" ` : ""}
            {msg.from}
          </span>
        </p>
        <p className="mt-0.5 line-clamp-2 max-w-3xl text-[15px] leading-snug text-ink-soft xl:line-clamp-1" title={msg.body}>
          {msg.body}
        </p>
        </div>
        {controls}
      </header>
      <div className="shrink-0">
        <Pipeline s={s} running={running} error={error} models={models} />
      </div>
      <div className="grid gap-3 xl:min-h-0 xl:flex-1 xl:grid-cols-2">
        <VerdictPanel s={s} running={running} error={error} onRetry={() => onRetry(msg)} />
        <Trace events={events} running={running} deep={s.deepModel} />
      </div>
    </div>
  );
}
