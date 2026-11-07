import { runAnalysis } from "@/lib/agent";
import { loadRecording, saveRecording } from "@/lib/recordings";
import type { AgentEvent, AnalyzeRequest } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = (await req.json()) as AnalyzeRequest;
  const msg = body?.message;
  if (!msg?.body || !msg.from) {
    return Response.json({ error: "Send { message: { body, from, channel } }" }, { status: 400 });
  }
  const message = { ...msg, label: undefined, channel: msg.channel ?? "sms" };
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const write = (e: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (body.replay) {
          const rec = await loadRecording(message);
          if (rec?.length) {
            const first = rec[0];
            write(first.type === "start" ? { ...first, mode: "replay" } : first);
            for (let i = 1; i < rec.length; i++) {
              const gap = Math.min(1100, Math.max(120, rec[i].t - rec[i - 1].t));
              await new Promise((r) => setTimeout(r, gap));
              write(rec[i]);
            }
            controller.close();
            return;
          }
        }
        const events: AgentEvent[] = [];
        let live = false;
        await runAnalysis(message, (e) => {
          if (e.type === "start") live = e.mode === "live";
          events.push(e);
          write(e);
        });
        if (live) await saveRecording(message, events);
      } catch (e) {
        write({ type: "notice", level: "warn", text: `Analysis failed: ${(e as Error).message}`, t: Date.now() });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
