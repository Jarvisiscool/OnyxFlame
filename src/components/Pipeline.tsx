"use client";

import type { RunSummary } from "./events";
import { ModelChip, Pill, fmtMs, fmtTokens } from "./ui";

type State = "pending" | "active" | "done" | "skipped" | "error";

interface Stage {
  key: string;
  label: string;
  state: State;
  ms?: number;
  msNote?: string;
  model?: string;
  modelDim?: boolean;
  detail: React.ReactNode;
}

const IDLE_DETAIL: Record<string, string> = {
  redact: "Personal data removed on the device",
  triage: "Small model sorts every message",
  investigate: "Large model calls tools to check the claims",
  guardrails: "Fixed safety rules review the call",
  verdict: "Plain-language answer",
};

function stages(s: RunSummary | undefined, running: boolean, failed: boolean, models?: { fast: string; deep: string }): Stage[] {
  const fast = s?.triage?.model ?? s?.start?.models.fast ?? models?.fast;
  const deep = s?.deepModel ?? models?.deep;
  if (!s) {
    return [
      { key: "redact", label: "Redact", state: "pending", detail: IDLE_DETAIL.redact },
      { key: "triage", label: "Triage", state: "pending", model: fast, detail: IDLE_DETAIL.triage },
      { key: "investigate", label: "Investigate", state: "pending", model: deep, detail: IDLE_DETAIL.investigate },
      { key: "guardrails", label: "Guardrails", state: "pending", detail: IDLE_DETAIL.guardrails },
      { key: "verdict", label: "Verdict", state: "pending", detail: IDLE_DETAIL.verdict },
    ];
  }
  const { start, redaction, triage, route, verdictEv, verdict, done } = s;
  const fastPath = route?.decision === "fast_path";
  // The first unfinished stage is where the run is (or where it stopped).
  const live: State = failed ? "error" : running ? "active" : "pending";

  const redactState: State = redaction ? "done" : live;
  const triageState: State = triage ? "done" : redaction ? live : "pending";
  const investigateState: State = fastPath ? "skipped" : verdictEv ? "done" : route ? live : "pending";
  const finalState: State = verdictEv ? "done" : "pending";

  const items = redaction?.items.reduce((n, x) => n + x.count, 0) ?? 0;
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return [
    {
      key: "redact",
      label: "Redact",
      state: redactState,
      ms: redaction && start ? redaction.t - start.t : undefined,
      detail: redaction ? (items ? `${items} item${items > 1 ? "s" : ""} removed on device` : "Nothing personal found") : IDLE_DETAIL.redact,
    },
    {
      key: "triage",
      label: "Triage",
      state: triageState,
      ms: triage?.ms,
      model: fast,
      detail: triage ? (
        <>
          <span className="font-semibold text-ink-soft">
            {triage.risk === "safe" ? "Low risk" : triage.risk === "scam" ? "High risk" : "Unclear"} {pct(triage.confidence)}
          </span>
          {route && <span className={fastPath ? "font-semibold text-safe" : ""}>{fastPath ? ". Answered alone" : ". Escalated"}</span>}
        </>
      ) : (
        IDLE_DETAIL.triage
      ),
    },
    {
      key: "investigate",
      label: "Investigate",
      state: investigateState,
      ms: verdictEv && route && !fastPath ? verdictEv.t - route.t : undefined,
      model: deep,
      modelDim: fastPath,
      detail: fastPath ? (
        "Skipped. Nothing to verify"
      ) : route ? (
        <span className="tnum">
          {s.toolCalls} tool call{s.toolCalls === 1 ? "" : "s"}
          {investigateState === "active" ? " so far" : ""}
        </span>
      ) : (
        IDLE_DETAIL.investigate
      ),
    },
    {
      key: "guardrails",
      label: "Guardrails",
      state: finalState,
      detail: verdict ? (
        verdict.guardrail ? <span className="font-semibold text-caution">Adjusted the call</span> : "Passed, no changes"
      ) : (
        IDLE_DETAIL.guardrails
      ),
    },
    {
      key: "verdict",
      label: "Verdict",
      state: finalState,
      ms: done?.totalMs,
      msNote: "total",
      detail: verdict ? (
        <span className="inline-flex items-center gap-1.5">
          <Pill risk={verdict.risk} small />
          <span className="tnum font-semibold text-ink-soft">{pct(verdict.confidence)}</span>
        </span>
      ) : (
        IDLE_DETAIL.verdict
      ),
    },
  ];
}

function Track({ state }: { state: State }) {
  return (
    <span
      aria-hidden
      className={`relative block h-7 w-1.5 overflow-hidden rounded-full sm:col-span-2 sm:h-1.5 sm:w-full ${
        state === "skipped" ? "skip-track" : state === "active" ? "bg-agent/15" : "bg-line"
      }`}
    >
      {state === "done" && <span className="animate-fill absolute inset-0 rounded-full bg-agent" />}
      {state === "active" && <span className="scan-line absolute inset-0" />}
      {state === "error" && <span className="absolute inset-0 rounded-full bg-caution" />}
    </span>
  );
}

const STATE_WORD: Record<State, string> = { pending: "waiting", active: "in progress", done: "done", skipped: "skipped", error: "stopped" };

export function Pipeline({
  s,
  running,
  error,
  models,
}: {
  s?: RunSummary;
  running: boolean;
  error?: string;
  models?: { fast: string; deep: string };
}) {
  const list = stages(s, running, Boolean(error), models);
  const mode = s?.start?.mode;
  const done = s?.done;

  return (
    <section aria-label="Agent pipeline" className="rounded-2xl bg-panel px-4 pt-3 pb-4 ring-1 ring-line">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-[15px] font-bold">Agent pipeline</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
          {done && (
            <span className="tnum">
              {done.llmCalls} model call{done.llmCalls === 1 ? "" : "s"}, {done.toolCalls} tool call{done.toolCalls === 1 ? "" : "s"}
              {s && s.tokens > 0 ? `, ${fmtTokens(s.tokens)}` : ""}
            </span>
          )}
          {mode && (
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                mode === "live" ? "bg-nv-wash text-nv" : mode === "replay" ? "bg-agent-wash text-agent" : "bg-caution-wash text-caution"
              }`}
            >
              {mode === "live" ? "Live on Nemotron" : mode === "replay" ? "Replaying a recorded Nemotron run" : "Offline rules, no API key"}
            </span>
          )}
        </div>
      </div>
      <ol className="grid gap-2 sm:grid-cols-5 sm:gap-3">
        {list.map((st) => (
          <li
            key={st.key}
            aria-label={`${st.label}: ${STATE_WORD[st.state]}`}
            className="grid grid-cols-[6px_5.5rem_minmax(0,1fr)_auto] items-center gap-x-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:content-start sm:items-baseline sm:gap-y-1"
          >
            <Track state={st.state} />
            <span
              className={`text-[14px] font-semibold sm:mt-1 ${
                st.state === "active" ? "text-agent" : st.state === "pending" || st.state === "skipped" ? "text-muted" : "text-ink"
              } ${st.state === "skipped" ? "line-through decoration-1" : ""}`}
            >
              {st.label}
            </span>
            <span className="order-last text-right text-[12px] text-muted sm:order-none">
              {st.ms !== undefined && (
                <span className="tnum">
                  {fmtMs(st.ms)}
                  {st.msNote ? ` ${st.msNote}` : ""}
                </span>
              )}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-snug text-muted sm:col-span-2">
              {st.model && (
                <span className={st.modelDim ? "opacity-45" : ""}>
                  <ModelChip model={st.model} />
                </span>
              )}
              <span className="min-w-0 sm:basis-full">{st.state === "error" ? <span className="font-semibold text-caution">Stopped here</span> : st.detail}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
