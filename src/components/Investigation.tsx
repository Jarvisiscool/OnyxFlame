"use client";

import type { AgentEvent, Evidence, InboxMessage } from "@/lib/types";
import type { Run } from "./useAnalysis";
import { Checking, ConfidenceBar, Pill, RISK_STYLE, modelShort } from "./ui";

const TOOL_LABEL: Record<string, string> = {
  extract_indicators: "Read what the message asks for",
  check_sender: "Checked the sender against carrier data",
  check_link: "Investigated the link",
  lookup_official_contact: "Looked up the real organization",
  match_scam_patterns: "Compared against known scam playbooks",
};

function SignalChips({ signals }: { signals: Evidence[] }) {
  if (!signals.length) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-1.5">
      {signals.map((s, i) => (
        <li
          key={i}
          title={s.detail}
          className={`rounded-md px-2 py-0.5 text-[12px] font-semibold ${s.direction === "risk" ? "bg-scam-wash text-scam" : "bg-safe-wash text-safe"}`}
        >
          {s.direction === "risk" ? "▲ " : "✓ "}
          {s.signal}
        </li>
      ))}
    </ul>
  );
}

function ModelChip({ model }: { model: string }) {
  const isNv = model.includes("nemotron");
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${isNv ? "bg-nv/10 text-nv" : "bg-ink/6 text-muted"}`}>
      {isNv ? "NVIDIA " : ""}
      {modelShort(model)}
    </span>
  );
}

type Step =
  | { kind: "event"; ev: AgentEvent }
  | { kind: "tool"; call: Extract<AgentEvent, { type: "tool_call" }>; result?: Extract<AgentEvent, { type: "tool_result" }> };

function buildSteps(events: AgentEvent[]): Step[] {
  const steps: Step[] = [];
  const byId = new Map<string, Step & { kind: "tool" }>();
  for (const ev of events) {
    if (ev.type === "tool_call") {
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

function StepRow({ n, title, meta, children, active }: { n: number; title: React.ReactNode; meta?: React.ReactNode; children?: React.ReactNode; active?: boolean }) {
  return (
    <li className="relative grid grid-cols-[28px_1fr] gap-3 pb-5 last:pb-0">
      <span className="absolute left-[13px] top-7 bottom-0 w-px bg-line" aria-hidden />
      <span className={`relative z-10 grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold tnum ${active ? "bg-agent text-white" : "bg-panel text-ink-soft ring-1 ring-line"}`}>{n}</span>
      <div className="min-w-0 pt-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[15px] font-semibold leading-tight">{title}</span>
          {meta && <span className="flex items-center gap-2 text-[12px] text-muted">{meta}</span>}
        </div>
        {children}
        {active && (
          <div className="mt-2 h-0.5 w-40 overflow-hidden rounded-full bg-agent/10">
            <div className="scan-line h-full" />
          </div>
        )}
      </div>
    </li>
  );
}

function Ms({ ms }: { ms: number }) {
  return <span className="tnum">{ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`}</span>;
}

function renderStep(step: Step, i: number, running: boolean, isLast: boolean) {
  const n = i + 1;
  if (step.kind === "tool") {
    const { call, result } = step;
    const argText = Object.entries(call.args)
      .map(([k, v]) => `${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join("  ");
    return (
      <StepRow key={call.id + i} n={n} active={!result && running} title={TOOL_LABEL[call.name] ?? call.name} meta={result && <Ms ms={result.ms} />}>
        <p className="mt-1 truncate font-mono text-[12px] text-muted">
          {call.name}({argText})
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
        <StepRow key={i} n={n} title="Removed personal data before any model saw it">
          <p className="mt-1 text-[13px] text-ink-soft">
            {ev.items.length ? ev.items.map((x) => `${x.count} ${x.kind}${x.count > 1 ? "s" : ""}`).join(", ") + " redacted." : "Nothing personal found. Text sent as is."}
          </p>
          {ev.items.length > 0 && <p className="mt-1.5 rounded-md bg-wash px-2.5 py-1.5 text-[12px] leading-snug text-muted line-clamp-2">{ev.redacted}</p>}
        </StepRow>
      );
    case "triage":
      return (
        <StepRow key={i} n={n} title="Quick triage" meta={<><ModelChip model={ev.model} /><Ms ms={ev.ms} /></>}>
          <div className="mt-1.5 flex items-center gap-2">
            <Pill risk={ev.risk} small />
            <span className="text-[12px] font-semibold text-muted tnum">{Math.round(ev.confidence * 100)}%</span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">{ev.reason}</p>
        </StepRow>
      );
    case "route":
      return (
        <StepRow key={i} n={n} title={ev.decision === "fast_path" ? "Fast path: no deep investigation needed" : "Escalated to a full investigation"}>
          <p className="mt-1 text-[13px] leading-snug text-ink-soft">{ev.reason}</p>
        </StepRow>
      );
    case "thought":
      return (
        <StepRow key={i} n={n} title="Planned the investigation" meta={<ModelChip model={ev.model} />}>
          <details className="mt-1" open={isLast && running}>
            <summary className="cursor-pointer text-[13px] text-agent">Show reasoning</summary>
            <p className="mt-1 whitespace-pre-wrap text-[12px] leading-snug text-muted">{ev.text}</p>
          </details>
        </StepRow>
      );
    case "notice":
      return (
        <StepRow key={i} n={n} title={ev.level === "warn" ? "Switched to a backup" : "Note"}>
          <p className="mt-1 text-[13px] leading-snug text-caution">{ev.text}</p>
        </StepRow>
      );
    default:
      return null;
  }
}

function EmptyState({ onDeliver }: { onDeliver: () => void }) {
  const stages = [
    ["Redact", "Personal data is stripped on the device"],
    ["Triage", "A small Nemotron model sorts every message"],
    ["Investigate", "A larger Nemotron model calls tools to verify what the message claims"],
    ["Protect", "Plain-language verdict, honest confidence, one-tap actions"],
  ];
  return (
    <div className="flex h-full flex-col justify-center px-2 py-10">
      <h2 className="max-w-md font-display text-[34px] font-bold leading-[1.05]">Every message gets a second look before you act on it.</h2>
      <ol className="mt-8 grid max-w-xl gap-4 sm:grid-cols-2">
        {stages.map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-panel text-[12px] font-bold ring-1 ring-line tnum">{i + 1}</span>
            <span>
              <span className="block text-[15px] font-semibold">{t}</span>
              <span className="block text-[13px] leading-snug text-muted">{d}</span>
            </span>
          </li>
        ))}
      </ol>
      <button onClick={onDeliver} className="mt-8 self-start rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-soft">
        Deliver the first message
      </button>
    </div>
  );
}

export function Investigation({ msg, run, onDeliver }: { msg?: InboxMessage; run?: Run; onDeliver: () => void }) {
  if (!msg) return <EmptyState onDeliver={onDeliver} />;
  const events = run?.events ?? [];
  const steps = buildSteps(events);
  const running = run?.status !== "done";
  const start = events.find((e): e is Extract<AgentEvent, { type: "start" }> => e.type === "start");
  const done = events.find((e): e is Extract<AgentEvent, { type: "done" }> => e.type === "done");
  const verdictEv = events.find((e): e is Extract<AgentEvent, { type: "verdict" }> => e.type === "verdict");
  const v = verdictEv?.verdict;

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-muted">
            Investigating a {msg.channel === "voicemail" ? "voicemail" : msg.channel === "email" ? "email" : "text"} from{" "}
            <span className="font-semibold text-ink">{msg.displayName ? `"${msg.displayName}" ` : ""}{msg.from}</span>
          </p>
          <p className="mt-1 line-clamp-2 max-w-2xl text-[15px] leading-snug text-ink-soft">{msg.body}</p>
        </div>
        {start && (
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
              start.mode === "live" ? "bg-nv/10 text-nv" : start.mode === "replay" ? "bg-agent-wash text-agent" : "bg-caution-wash text-caution"
            }`}
          >
            {start.mode === "live" ? "Live on Nemotron" : start.mode === "replay" ? "Replaying a recorded Nemotron run" : "Offline rules (no API key)"}
          </span>
        )}
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-label="Agent steps" className="rounded-2xl bg-panel p-5 ring-1 ring-line">
          <h3 className="mb-4 font-display text-lg font-bold">What the agent did</h3>
          {steps.length === 0 ? (
            <Checking />
          ) : (
            <ol>{steps.map((s, i) => renderStep(s, i, running, i === steps.length - 1))}</ol>
          )}
          {done && (
            <p className="mt-5 border-t border-line pt-3 text-[12px] text-muted tnum">
              {(done.totalMs / 1000).toFixed(1)} s total, {done.llmCalls} model call{done.llmCalls === 1 ? "" : "s"}, {done.toolCalls} tool call{done.toolCalls === 1 ? "" : "s"}
            </p>
          )}
        </section>

        <section aria-label="Verdict" className={`rounded-2xl p-5 ring-1 ${v ? `${RISK_STYLE[v.risk].wash} ring-transparent` : "bg-panel ring-line"}`}>
          {!v ? (
            <div className="flex h-full min-h-40 flex-col justify-center">
              <Checking />
              <p className="mt-3 text-sm text-muted">The verdict appears once the evidence is in.</p>
            </div>
          ) : (
            <div className="animate-sheet-up">
              <div className="flex items-baseline justify-between gap-3">
                <span className={`font-display text-[44px] font-extrabold leading-none ${RISK_STYLE[v.risk].text}`}>{RISK_STYLE[v.risk].word}</span>
                {verdictEv && <ModelChip model={verdictEv.model} />}
              </div>
              <p className="mt-1 text-sm font-semibold text-ink-soft">{v.scamType}</p>
              <div className="mt-3">
                <ConfidenceBar value={v.confidence} risk={v.risk} />
              </div>
              <p className="mt-4 text-[15px] leading-relaxed">{v.explanation}</p>
              {v.uncertainty && <p className="mt-3 text-[13px] leading-snug text-caution">Not sure about: {v.uncertainty}</p>}
              {v.guardrail && (
                <p className="mt-3 rounded-lg bg-panel/70 px-3 py-2 text-[12px] leading-snug text-ink-soft">
                  <span className="font-semibold">Safety check:</span> {v.guardrail}
                </p>
              )}
              <h4 className="mt-5 text-sm font-bold">Evidence</h4>
              <ul className="mt-2 space-y-2">
                {v.evidence.map((e, i) => (
                  <li key={i} className="rounded-lg bg-panel/80 px-3 py-2">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`text-[13px] font-bold ${e.direction === "risk" ? "text-scam" : "text-safe"}`}>{e.signal}</span>
                      <span className="shrink-0 text-[11px] text-muted">{e.source}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{e.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
