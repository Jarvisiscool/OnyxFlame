import type { AgentEvent, Evidence, Verdict } from "@/lib/types";

/**
 * The UI reads a few fields that the agent may or may not send yet
 * (per-call timing, token usage, model on tool/thought events, a "plan" event).
 * Everything here is optional and read defensively so the UI compiles and renders
 * against both the current and the extended event shapes.
 */
export type Usage = { promptTokens?: number; completionTokens?: number; totalTokens?: number };
export type PlanEvent = { type: "plan"; model: string; text: string; t: number };
export type UIEvent = AgentEvent | PlanEvent;

type Of<T extends UIEvent["type"]> = Extract<UIEvent, { type: T }>;

export function extras(ev: object): { ms?: number; usage?: Usage; model?: string } {
  const e = ev as { ms?: unknown; usage?: unknown; model?: unknown };
  return {
    ms: typeof e.ms === "number" ? e.ms : undefined,
    usage: e.usage && typeof e.usage === "object" ? (e.usage as Usage) : undefined,
    model: typeof e.model === "string" ? e.model : undefined,
  };
}

export function tokensOf(ev: object) {
  const u = extras(ev).usage;
  if (!u) return 0;
  return u.totalTokens ?? (u.promptTokens ?? 0) + (u.completionTokens ?? 0);
}

function first<T extends UIEvent["type"]>(events: UIEvent[], type: T) {
  return events.find((e): e is Of<T> => e.type === type);
}

export interface RunSummary {
  start?: Of<"start">;
  redaction?: Of<"redaction">;
  triage?: Of<"triage">;
  route?: Of<"route">;
  plan?: PlanEvent;
  thought?: Of<"thought">;
  verdictEv?: Of<"verdict">;
  verdict?: Verdict;
  done?: Of<"done">;
  toolCalls: number;
  toolResults: number;
  signals: Evidence[];
  tokens: number;
  deepModel?: string;
  lastT?: number;
}

export function summarize(raw: AgentEvent[]): RunSummary {
  const events = raw as UIEvent[];
  const start = first(events, "start");
  const plan = events.find((e): e is PlanEvent => e.type === "plan" && typeof (e as PlanEvent).text === "string");
  const thought = first(events, "thought");
  const verdictEv = first(events, "verdict");
  const toolCallEvs = events.filter((e): e is Of<"tool_call"> => e.type === "tool_call");
  const toolResultEvs = events.filter((e): e is Of<"tool_result"> => e.type === "tool_result");
  const toolModel = toolCallEvs.map((e) => extras(e).model).find(Boolean);
  return {
    start,
    redaction: first(events, "redaction"),
    triage: first(events, "triage"),
    route: first(events, "route"),
    plan,
    thought,
    verdictEv,
    verdict: verdictEv?.verdict,
    done: first(events, "done"),
    toolCalls: toolCallEvs.length,
    toolResults: toolResultEvs.length,
    signals: toolResultEvs.flatMap((e) => e.signals),
    tokens: events.reduce((n, e) => n + tokensOf(e), 0),
    deepModel: plan?.model ?? thought?.model ?? toolModel ?? start?.models.deep,
    lastT: events.length ? events[events.length - 1].t : undefined,
  };
}
