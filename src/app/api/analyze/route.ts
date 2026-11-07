import { runAnalysis } from "@/lib/agent";
import { loadRecording, saveRecording } from "@/lib/recordings";
import type { AgentEvent, AnalyzeRequest, Channel, InboxMessage } from "@/lib/types";

export const maxDuration = 60;

const CHANNELS: Channel[] = ["sms", "email", "voicemail"];
const MAX_BODY = 4000;

function parseMessage(raw: unknown): InboxMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.body !== "string" || typeof m.from !== "string" || !m.body.trim() || !m.from.trim()) return null;
  return {
    id: typeof m.id === "string" ? m.id.slice(0, 64) : "msg",
    channel: CHANNELS.includes(m.channel as Channel) ? (m.channel as Channel) : "sms",
    from: m.from.slice(0, 120),
    displayName: typeof m.displayName === "string" && m.displayName.trim() ? m.displayName.slice(0, 80) : undefined,
    body: m.body.slice(0, MAX_BODY),
    receivedAt: typeof m.receivedAt === "string" ? m.receivedAt.slice(0, 40) : "",
    // label is ground truth for synthetic data and is never passed on.
  };
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as AnalyzeRequest | null;
  const message = parseMessage(body?.message);
  if (!message) {
    return Response.json({ error: "Send { message: { body, from, channel } }" }, { status: 400 });
  }
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const write = (e: AgentEvent) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
        } catch {
          open = false; // client went away; keep running so the recording still completes
        }
      };
      try {
        if (body?.replay) {
          const rec = await loadRecording(message);
          if (rec?.length) {
            const first = rec[0];
            write(first.type === "start" ? { ...first, mode: "replay" } : first);
            for (let i = 1; i < rec.length && open; i++) {
              const gap = Math.min(1100, Math.max(120, rec[i].t - rec[i - 1].t));
              await new Promise((r) => setTimeout(r, gap));
              write(rec[i]);
            }
            controller.close();
            return;
          }
          write({ type: "notice", level: "info", text: "No saved run for this message yet. Running it now.", t: Date.now() });
        }
        const events: AgentEvent[] = [];
        let live = false;
        let degraded = false;
        let nemotronVerdict = false;
        await runAnalysis(
          message,
          (e) => {
            if (e.type === "start") live = e.mode === "live";
            if (e.type === "verdict") nemotronVerdict = !/^rules/.test(e.model);
            if (e.type === "done") degraded = Boolean(e.metrics?.degraded || e.metrics?.fallback);
            events.push(e);
            write(e);
          },
          { signal: req.signal },
        );
        // Only clean Nemotron runs are recorded, so replay never presents a rules fallback as a model run
        // and a degraded run can never overwrite a good recording.
        if (live && nemotronVerdict && !degraded) await saveRecording(message, events);
      } catch (e) {
        write({ type: "notice", level: "warn", text: `Analysis failed: ${(e as Error).message}`, t: Date.now() });
      }
      if (open) {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
