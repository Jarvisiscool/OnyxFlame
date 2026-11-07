"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentEvent, InboxMessage, RunMode, Verdict } from "@/lib/types";

export interface Run {
  events: AgentEvent[];
  status: "queued" | "running" | "done";
  verdict?: Verdict;
  mode?: RunMode;
  /** Set when the request failed or the stream ended without a verdict */
  error?: string;
}

/** A single check may not hold the queue longer than this. */
const RUN_TIMEOUT_MS = 90_000;

export function useAnalysis(replay: boolean) {
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const chain = useRef<Promise<void>>(Promise.resolve());
  const generation = useRef(0);
  const inflight = useRef<AbortController | null>(null);
  const replayRef = useRef(replay);
  replayRef.current = replay;

  const update = useCallback((id: string, fn: (r: Run) => Run) => {
    setRuns((prev) => ({ ...prev, [id]: fn(prev[id] ?? { events: [], status: "queued" }) }));
  }, []);

  const analyze = useCallback(
    (msg: InboxMessage) => {
      const gen = generation.current;
      // After a reset, anything still queued or streaming from before is ignored.
      const upd = (fn: (r: Run) => Run) => {
        if (generation.current === gen) update(msg.id, fn);
      };
      upd(() => ({ events: [], status: "queued" }));
      // One investigation at a time keeps the trace readable and avoids rate limits.
      chain.current = chain.current.then(async () => {
        if (generation.current !== gen) return;
        const ctrl = new AbortController();
        inflight.current = ctrl;
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          ctrl.abort();
        }, RUN_TIMEOUT_MS);
        upd((r) => ({ ...r, status: "running" }));
        let gotVerdict = false;
        let lastWarn: string | undefined;
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg, replay: replayRef.current }),
            signal: ctrl.signal,
          });
          if (!res.ok) {
            let detail = `${res.status} ${res.statusText}`.trim();
            try {
              const j = (await res.json()) as { error?: string };
              if (j?.error) detail = j.error;
            } catch {}
            throw new Error(`The server answered ${detail}`);
          }
          if (!res.body) throw new Error("No response stream");
          const reader = res.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.trim()) continue;
              let ev: AgentEvent;
              try {
                ev = JSON.parse(line) as AgentEvent;
              } catch {
                continue;
              }
              if (ev.type === "verdict") gotVerdict = true;
              if (ev.type === "notice" && ev.level === "warn") lastWarn = ev.text;
              upd((r) => ({
                ...r,
                events: [...r.events, ev],
                verdict: ev.type === "verdict" ? ev.verdict : r.verdict,
                mode: ev.type === "start" ? ev.mode : r.mode,
              }));
            }
          }
          if (!gotVerdict) throw new Error(lastWarn ?? "The check ended before a verdict was reached");
        } catch (e) {
          const text = timedOut
            ? `No verdict after ${RUN_TIMEOUT_MS / 1000} seconds, so the check was stopped`
            : (e as Error).name === "AbortError"
              ? "Stopped"
              : (e as Error).message || "Network error";
          upd((r) => ({ ...r, error: text }));
        } finally {
          clearTimeout(timer);
          if (inflight.current === ctrl) inflight.current = null;
        }
        upd((r) => ({ ...r, status: "done" }));
      });
    },
    [update],
  );

  /** Abort the running check, drop the queue and forget every run. */
  const reset = useCallback(() => {
    generation.current++;
    inflight.current?.abort();
    inflight.current = null;
    chain.current = Promise.resolve();
    setRuns({});
  }, []);

  return { runs, analyze, reset };
}
