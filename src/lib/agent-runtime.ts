/**
 * Plumbing for the Nemotron agent loop: untrusted-text fencing, prompt-injection detection,
 * tool-call identity (dedupe), timeouts and per-model metrics.
 */
import { randomBytes } from "node:crypto";
import type { Evidence, ModelMetrics, RunMetrics, TokenUsage } from "./types";
import { parseHost } from "./tools/link";

/* ------------------------------ untrusted text ------------------------------ */

/** Defang markup that could be mistaken for our own delimiters or for model control tokens. */
export function neutralize(text: string) {
  return text
    .replace(/<<<|>>>/g, (m) => (m === "<<<" ? "‹‹‹" : "›››"))
    .replace(/<(\/?)(toolcall|tool_call|think|function=|parameter=|\|)/gi, "‹$1$2")
    .replace(/\[(\/?)(INST|SYS)\]/g, "⟦$1$2⟧");
}

/** One line, quoted-safe, bounded: for sender / caller-ID strings the attacker controls. */
export function oneLine(s: string, max = 80) {
  return neutralize(s).replace(/[\r\n\t]+/g, " ").replace(/"/g, "'").slice(0, max);
}

/** Wrap untrusted message text in nonce-tagged markers the system prompt tells the model about. */
export function untrustedBlock(text: string, nonce = randomBytes(4).toString("hex")) {
  return `<<<UNTRUSTED_MESSAGE id=${nonce}>>>\n${neutralize(text)}\n<<<END_UNTRUSTED_MESSAGE id=${nonce}>>>`;
}

/* ------------------------------ prompt injection ------------------------------ */

const INJECTION_PATTERNS: RegExp[] = [
  /\b(ignore|disregard|forget|override|bypass)\b[^.\n]{0,40}\b(instructions?|prompts?|rules|guidelines|system message)\b/i,
  /\bsubmit_verdict\b|\btool_calls?\b|<\/?toolcall>/i,
  /\b(system|assistant|developer)\s*(prompt|message|note)?\s*:/i,
  /\b(assistant|ai|model)\s*,\s*(please\s+)?(call|mark|classify|ignore|respond|reply|say|output)\b/i,
  /\[\/?(INST|SYS)\]|<\|im_start\|>|<\|system\|>/i,
  /\b(as an ai|you are (now )?an? (ai|assistant|language model|llm|classifier)|dear (ai|assistant|model|filter))\b/i,
  /\b(ai|spam|scam)\s*(filter|detector|classifier|model)s?\b[^.\n]{0,40}\b(mark|classify|label|rate|treat)\b/i,
  /\b(mark|classify|label|rate)\b[^.\n]{0,25}\b(this|message|it)\b[^.\n]{0,15}\bas\s+(safe|legit(imate)?|not (a )?scam|trusted)\b/i,
  /\brisk\s*[:=]\s*["']?safe\b/i,
];

export function detectInjection(text: string): { found: boolean; snippet?: string } {
  for (const re of INJECTION_PATTERNS) {
    const m = text.match(re);
    if (m) return { found: true, snippet: m[0].trim().slice(0, 60) };
  }
  return { found: false };
}

export function injectionSignal(snippet: string): Evidence {
  return {
    signal: "Prompt-injection attempt",
    detail: `The message contains text aimed at AI filters ("${snippet}"). Real companies never do this; it's an attempt to get the message marked safe.`,
    weight: "high",
    direction: "risk",
    source: "Prompt-injection detector",
  };
}

/* ------------------------------ tool identity ------------------------------ */

function normUrl(u: unknown) {
  const s = String(u ?? "").trim().toLowerCase().replace(/[.,;:!?)\]]+$/, "");
  return s.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

/** Identity of a tool call for dedupe: same tool + same meaningful args = same check. */
export function toolKey(name: string, args: Record<string, unknown>) {
  switch (name) {
    case "extract_indicators":
    case "match_scam_patterns":
      return name;
    case "check_link":
      return `${name}|${normUrl(args.url)}`;
    case "check_sender":
      return `${name}|${String(args.sender ?? "").replace(/[^\d+a-z@.]/gi, "").toLowerCase()}|${String(args.claimed_name ?? "").toLowerCase().trim()}`;
    case "lookup_official_contact":
      return `${name}|${String(args.organization ?? "").toLowerCase().trim()}`;
    default:
      return `${name}|${JSON.stringify(args, Object.keys(args).sort())}`;
  }
}

/** Coarser identity used to decide whether a required check is already covered. */
export function coverageKey(name: string, args: Record<string, unknown>) {
  if (name === "check_link") return `${name}|${parseHost(String(args.url ?? "")).hostname}`;
  if (name === "check_sender") return name;
  return toolKey(name, args);
}

/* ------------------------------ timing ------------------------------ */

export class TimeoutError extends Error {}

export function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms} ms`)), ms);
    }),
  ]);
}

export function envMs(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/* ------------------------------ metrics ------------------------------ */

const zero = (): TokenUsage => ({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });

function add(a: TokenUsage, b?: TokenUsage) {
  if (!b) return;
  a.promptTokens += b.promptTokens;
  a.completionTokens += b.completionTokens;
  a.totalTokens += b.totalTokens;
  if (b.reasoningTokens) a.reasoningTokens = (a.reasoningTokens ?? 0) + b.reasoningTokens;
}

export class MetricsTracker {
  llmMs = 0;
  toolMs = 0;
  fallback = false;
  degraded = false;
  private tokens = zero();
  private byModel: Record<string, ModelMetrics> = {};

  constructor(private budgetMs: number) {}

  llm(model: string, ms: number, usage?: TokenUsage) {
    this.llmMs += ms;
    const m = (this.byModel[model] ??= { calls: 0, ms: 0, tokens: zero() });
    m.calls++;
    m.ms += ms;
    add(m.tokens, usage);
    add(this.tokens, usage);
  }

  snapshot(): RunMetrics {
    return {
      llmMs: this.llmMs,
      toolMs: this.toolMs,
      tokens: { ...this.tokens },
      byModel: JSON.parse(JSON.stringify(this.byModel)),
      budgetMs: this.budgetMs,
      ...(this.fallback ? { fallback: true } : {}),
      ...(this.fallback || this.degraded ? { degraded: true } : {}),
    };
  }
}

/* ------------------------------ plan extraction ------------------------------ */

/** Pull "Plan: …" out of model text. Steps split on arrows, semicolons, numbering or "then". */
export function extractPlan(text: string): { text: string; steps: string[]; rest: string } | null {
  if (!text) return null;
  const m = text.match(/(?:^|\n)\s*(?:\*\*)?plan(?:\*\*)?\s*[:\-–]\s*([\s\S]+?)(?:\n\s*\n|$)/i);
  if (!m) return null;
  const planText = m[1].replace(/\s+/g, " ").trim().slice(0, 300);
  const steps = planText
    .split(/\s*(?:→|->|;|\bthen\b|\d+[.)]\s)\s*/i)
    .map((s) => s.replace(/^[,.\s]+|[,.\s]+$/g, ""))
    .filter((s) => s.length > 2)
    .slice(0, 8);
  return { text: planText, steps: steps.length ? steps : [planText], rest: text.replace(m[0], "").trim() };
}
