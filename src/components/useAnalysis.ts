"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentEvent, InboxMessage, RunMode, Verdict } from "@/lib/types";

export interface Run {
  events: AgentEvent[];
  status: "queued" | "running" | "done";
  verdict?: Verdict;
  mode?: RunMode;
}

export function useAnalysis(replay: boolean) {
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const chain = useRef<Promise<void>>(Promise.resolve());
  const replayRef = useRef(replay);
  replayRef.current = replay;

  const update = useCallback((id: string, fn: (r: Run) => Run) => {
    setRuns((prev) => ({ ...prev, [id]: fn(prev[id] ?? { events: [], status: "queued" }) }));
  }, []);

  const analyze = useCallback(
    (msg: InboxMessage) => {
      update(msg.id, () => ({ events: [], status: "queued" }));
      // One investigation at a time keeps the trace readable and avoids rate limits.
      chain.current = chain.current.then(async () => {
        update(msg.id, (r) => ({ ...r, status: "running" }));
        try {
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: msg, replay: replayRef.current }),
          });
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
              const ev = JSON.parse(line) as AgentEvent;
              update(msg.id, (r) => ({
                ...r,
                events: [...r.events, ev],
                verdict: ev.type === "verdict" ? ev.verdict : r.verdict,
                mode: ev.type === "start" ? ev.mode : r.mode,
              }));
            }
          }
        } catch (e) {
          update(msg.id, (r) => ({
            ...r,
            events: [...r.events, { type: "notice", level: "warn", text: `Couldn't reach the agent: ${(e as Error).message}`, t: Date.now() }],
          }));
        }
        update(msg.id, (r) => ({ ...r, status: "done" }));
      });
    },
    [update],
  );

  return { runs, analyze };
}
