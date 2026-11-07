/**
 * Minimal client for NVIDIA's OpenAI-compatible endpoint (build.nvidia.com), also works with OpenRouter.
 * Plain fetch keeps the dependency surface small and the request shape obvious.
 *
 * What it handles so the agent loop doesn't have to:
 * - reasoning on/off per model family (chat_template_kwargs, /no_think, "detailed thinking", OpenRouter `reasoning`)
 * - endpoints that reject optional params (400 → retried once without them, remembered per model)
 * - 429 / 5xx / network errors (bounded retries honoring Retry-After and the caller's deadline)
 * - per-call timeouts and an absolute deadline
 * - <think> blocks, reasoning_content / reasoning fields, token usage
 * - tool calls written into the message text instead of `tool_calls` (parseContentToolCalls)
 */
import type { TokenUsage } from "./types";

const DEFAULT_BASE_URL = "https://integrate.api.nvidia.com/v1";

/** Read at call time so scripts/tests can switch endpoints. */
export function baseUrl() {
  return (process.env.NVIDIA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}
/** @deprecated use baseUrl(); kept for older imports. */
export const BASE_URL = baseUrl();

/** Small, fast model: triages every incoming message. */
export const FAST_MODEL = process.env.NEMOTRON_FAST_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b";

/** Larger reasoning model: runs the tool-calling investigation on risky messages. */
export const DEEP_MODEL = process.env.NEMOTRON_DEEP_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b";

/** Vision-language model for screenshots / QR codes (accepts OpenAI-style image_url content parts). */
export const VISION_MODEL = process.env.NEMOTRON_VISION_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b";

export function hasNvidiaKey() {
  return Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim());
}

export function isOpenRouter(url = baseUrl()) {
  return /openrouter\.ai/i.test(url);
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export interface ChatMessage {
  role: ChatRole;
  /** Plain text, or content parts (text + images) for vision models */
  content: string | ContentPart[] | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolSchema {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatResult {
  model: string;
  content: string;
  reasoning: string;
  toolCalls: ToolCall[];
  ms: number;
  usage?: TokenUsage;
  finishReason?: string;
  /** HTTP attempts made (retries + param fallbacks) */
  attempts: number;
  /** Optional params dropped because the endpoint rejected them */
  droppedParams: string[];
  thinking: Thinking;
}

/* --------------------------------- reasoning control --------------------------------- */

/** off | on | low (on with a small budget) | a reasoning-token budget */
export type Thinking = "off" | "on" | "low" | number;

export function parseThinking(v: string | undefined, fallback: Thinking): Thinking {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return fallback;
  if (["off", "false", "0", "no", "none"].includes(s)) return "off";
  if (["on", "true", "yes", "full"].includes(s)) return "on";
  if (s === "low") return "low";
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : fallback;
}

/** Defaults: triage never thinks (speed); the investigator thinks a little (quality without stalling the demo). */
export function thinkingFor(role: "fast" | "deep"): Thinking {
  return role === "fast"
    ? parseThinking(process.env.NEMOTRON_FAST_THINKING, "off")
    : parseThinking(process.env.NEMOTRON_DEEP_THINKING, "low");
}

export function thinkingLabel(t: Thinking) {
  return typeof t === "number" ? `budget ${t}` : t;
}

/** How a given model/endpoint expects reasoning to be switched. */
export type ReasoningControl = "chat_template_kwargs" | "system_prompt" | "detailed_thinking" | "openrouter" | "none";

export function reasoningControlFor(model: string, url = baseUrl()): ReasoningControl {
  const forced = process.env.NEMOTRON_REASONING_CONTROL as ReasoningControl | undefined;
  if (forced && ["chat_template_kwargs", "system_prompt", "detailed_thinking", "openrouter", "none"].includes(forced)) return forced;
  if (isOpenRouter(url)) return "openrouter";
  const m = model.toLowerCase();
  // Nemotron 3 / 3.5 (Nano 30B-A3B, Super 120B-A12B, Super VL, Ultra): top-level chat_template_kwargs.enable_thinking
  if (/nemotron-?3|nemotron-nano-3-/.test(m)) return "chat_template_kwargs";
  // Nemotron Nano 9B/12B v2 and Llama-3.3-Nemotron-Super-49B v1.5: /think and /no_think in the system prompt
  if (/nano-(9b|12b)-v2|nemotron-nano-.*v2|super-49b-v1[._]5/.test(m)) return "system_prompt";
  // Llama Nemotron v1 family: "detailed thinking on|off" system prompt
  if (/llama-3\.[13]-nemotron|nemotron-(nano|super|ultra)-[\w.-]*v1\b/.test(m)) return "detailed_thinking";
  return "none";
}

const LOW_BUDGET = 512;

function applyThinking(body: Record<string, unknown>, messages: ChatMessage[], control: ReasoningControl, thinking: Thinking) {
  const on = thinking !== "off";
  const budget = typeof thinking === "number" ? thinking : thinking === "low" ? LOW_BUDGET : undefined;
  const prefix = (p: string) => {
    if (messages[0]?.role === "system" && typeof messages[0].content === "string") messages[0] = { ...messages[0], content: `${p}\n${messages[0].content}` };
    else messages.unshift({ role: "system", content: p });
  };
  switch (control) {
    case "chat_template_kwargs":
      body.chat_template_kwargs = { enable_thinking: on, ...(thinking === "low" ? { low_effort: true } : {}) };
      if (on && budget) body.reasoning_budget = budget;
      break;
    case "system_prompt":
      prefix(on ? "/think" : "/no_think");
      break;
    case "detailed_thinking":
      prefix(`detailed thinking ${on ? "on" : "off"}`);
      break;
    case "openrouter":
      body.reasoning = !on ? { enabled: false } : budget ? { max_tokens: budget } : { enabled: true };
      break;
    case "none":
      break;
  }
}

/* --------------------------------- errors --------------------------------- */

export type NemotronErrorCode = "no_key" | "http" | "timeout" | "network" | "aborted" | "deadline" | "tools_unsupported";

export class NemotronError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code: NemotronErrorCode = "http",
  ) {
    super(message);
    this.name = "NemotronError";
  }
}

/** Params we can drop without changing the meaning of a request. */
const OPTIONAL_PARAMS = ["chat_template_kwargs", "reasoning_budget", "reasoning", "top_p", "tool_choice", "parallel_tool_calls", "seed"] as const;
const rejected = new Map<string, Set<string>>();

const PARAM_COMPLAINT =
  /unrecogni[sz]ed|unknown (param|field|argument|key)|unsupported (param|field|argument)|not supported|not permitted|extra (inputs?|fields?)|unexpected (keyword|field|param)|additional properties|invalid (param|field|argument|request argument)/i;

/** Exposed for tests and the check script. */
export function rejectedParamsFor(model: string) {
  return [...(rejected.get(`${baseUrl()}|${model}`) ?? [])];
}
export function resetParamMemory() {
  rejected.clear();
}

/* --------------------------------- chat --------------------------------- */

interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  tools?: ToolSchema[];
  temperature?: number;
  maxTokens?: number;
  /** Reasoning mode. Defaults to off for the fast model and NEMOTRON_DEEP_THINKING otherwise. */
  thinking?: Thinking;
  /** @deprecated use thinking: "off" */
  noThink?: boolean;
  /** Per-attempt timeout */
  timeoutMs?: number;
  /** Absolute epoch-ms deadline across all attempts and retries */
  deadline?: number;
  signal?: AbortSignal;
  /** Max retries for 429/5xx/network errors (default 2) */
  retries?: number;
  /** Sampling seed, for reproducible evals */
  seed?: number;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new NemotronError("aborted", undefined, "aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new NemotronError("aborted", undefined, "aborted"));
    });
  });

/** Request headers for the configured endpoint (OpenRouter attribution included). */
export function requestHeaders(key = process.env.NVIDIA_API_KEY ?? ""): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" };
  if (isOpenRouter()) {
    h["HTTP-Referer"] = process.env.OPENROUTER_REFERER || "https://github.com/second-look-hackutd";
    h["X-Title"] = process.env.OPENROUTER_TITLE || "Second Look";
  }
  // Test/mocking hook: extra headers as JSON, e.g. {"x-mock-scenario":"native"}
  if (process.env.NEMOTRON_EXTRA_HEADERS) {
    try {
      Object.assign(h, JSON.parse(process.env.NEMOTRON_EXTRA_HEADERS));
    } catch {
      /* ignore malformed */
    }
  }
  return h;
}

/** Human-readable error text from an API error body (JSON or HTML), never a raw dump. */
export function errorDetail(text: string): string {
  if (!text) return "";
  try {
    const j = JSON.parse(text) as Record<string, unknown>;
    const e = j.error;
    const msg = (e && typeof e === "object" ? (e as { message?: unknown }).message : e) ?? j.message ?? j.detail ?? j.title;
    if (msg) return (typeof msg === "string" ? msg : JSON.stringify(msg)).replace(/\s+/g, " ").slice(0, 160);
  } catch {
    /* not JSON */
  }
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

function statusHint(status: number) {
  if (status === 401 || status === 403) return "rejected the API key";
  if (status === 404) return "model not found";
  if (status === 429) return "rate limit";
  if (status >= 500) return "service error";
  return "request error";
}

const THINK_RE = /<think>([\s\S]*?)<\/think>/gi;

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => (typeof p === "string" ? p : (p as { text?: string })?.text ?? "")).join("");
  return "";
}

function toUsage(u: Record<string, unknown> | undefined): TokenUsage | undefined {
  if (!u || typeof u !== "object") return undefined;
  const prompt = Number(u.prompt_tokens ?? 0) || 0;
  const completion = Number(u.completion_tokens ?? 0) || 0;
  const total = Number(u.total_tokens ?? prompt + completion) || prompt + completion;
  const details = u.completion_tokens_details as Record<string, unknown> | undefined;
  const reasoning = Number(details?.reasoning_tokens ?? u.reasoning_tokens ?? NaN);
  if (!prompt && !completion && !total) return undefined;
  return { promptTokens: prompt, completionTokens: completion, totalTokens: total, ...(Number.isFinite(reasoning) && reasoning > 0 ? { reasoningTokens: reasoning } : {}) };
}

function normalizeToolCalls(raw: unknown): ToolCall[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c, i) => {
      const fn = (c as { function?: { name?: unknown; arguments?: unknown } })?.function ?? {};
      const name = String(fn.name ?? "").replace(/^functions\./, "");
      if (!name) return null;
      const args = typeof fn.arguments === "string" ? fn.arguments : fn.arguments == null ? "" : JSON.stringify(fn.arguments);
      return { id: String((c as { id?: unknown }).id || `call_${Date.now().toString(36)}_${i}`), type: "function" as const, function: { name, arguments: args } };
    })
    .filter((c): c is ToolCall => c !== null);
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new NemotronError("NVIDIA_API_KEY is not set", undefined, "no_key");
  const url = `${baseUrl()}/chat/completions`;
  const memKey = `${baseUrl()}|${opts.model}`;
  const thinking: Thinking = opts.thinking ?? (opts.noThink ? "off" : opts.model === FAST_MODEL ? thinkingFor("fast") : thinkingFor("deep"));

  const messages = opts.messages.map((m) => ({ ...m }));
  const body: Record<string, unknown> = {
    model: opts.model,
    messages,
    temperature: opts.temperature ?? 0.2,
    top_p: 0.95,
    max_tokens: opts.maxTokens ?? 1500,
    stream: false,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
    // The investigator asks for several independent checks per turn; the agent runs them concurrently.
    body.parallel_tool_calls = true;
  }
  if (opts.seed !== undefined) body.seed = opts.seed;
  applyThinking(body, messages, reasoningControlFor(opts.model), thinking);
  const dropped: string[] = [];
  for (const p of rejected.get(memKey) ?? []) {
    if (p in body) {
      delete body[p];
      dropped.push(p);
    }
  }

  const started = Date.now();
  const maxRetries = opts.retries ?? 2;
  let retries = 0;
  let paramFallbacks = 0;
  let attempts = 0;

  for (;;) {
    const remaining = opts.deadline ? opts.deadline - Date.now() : Infinity;
    if (remaining < 250) throw new NemotronError("time budget exhausted before the model answered", undefined, "deadline");
    const timeout = Math.min(opts.timeoutMs ?? 60_000, remaining);
    const ctrl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctrl.abort();
    }, timeout);
    const signal = opts.signal ? AbortSignal.any([ctrl.signal, opts.signal]) : ctrl.signal;
    attempts++;
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers: requestHeaders(key), body: JSON.stringify(body), signal });
    } catch (e) {
      clearTimeout(timer);
      if (timedOut) throw new NemotronError(`model timed out after ${(timeout / 1000).toFixed(1)}s`, undefined, "timeout");
      if (opts.signal?.aborted) throw new NemotronError("request aborted", undefined, "aborted");
      if (retries < maxRetries) {
        retries++;
        await sleep(Math.min(600 * retries, Math.max(0, (opts.deadline ?? Infinity) - Date.now() - 500)), opts.signal);
        continue;
      }
      throw new NemotronError(`network error: ${(e as Error).message}`, undefined, "network");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      clearTimeout(timer);
      const detail = errorDetail(text) || res.statusText;

      // 400/422 complaining about a param: drop optional params and retry immediately.
      if ((res.status === 400 || res.status === 422) && paramFallbacks < 2) {
        const present = OPTIONAL_PARAMS.filter((p) => p in body);
        const named = present.filter((p) => text.includes(p));
        let toDrop: string[] = named;
        if (!toDrop.length && /\btools?\b/i.test(text) && body.tools && !/tool_call_id|tool message/i.test(text)) {
          throw new NemotronError(`endpoint rejected tools: ${detail}`, res.status, "tools_unsupported");
        }
        if (!toDrop.length && PARAM_COMPLAINT.test(text)) toDrop = present;
        if (toDrop.length) {
          paramFallbacks++;
          const mem = rejected.get(memKey) ?? new Set<string>();
          for (const p of toDrop) {
            delete body[p];
            dropped.push(p);
            mem.add(p);
          }
          rejected.set(memKey, mem);
          continue;
        }
      }

      if ((res.status === 429 || res.status >= 500) && retries < maxRetries) {
        retries++;
        const ra = Number(res.headers.get("retry-after"));
        const wait = Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 5000) : Math.min(5000, 700 * 2 ** (retries - 1) + Math.random() * 300);
        if (!opts.deadline || Date.now() + wait + 1000 < opts.deadline) {
          await sleep(wait, opts.signal);
          continue;
        }
      }
      throw new NemotronError(`${isOpenRouter() ? "OpenRouter" : "NVIDIA"} API ${statusHint(res.status)} (${res.status}): ${detail}`, res.status, "http");
    }

    let json: Record<string, unknown>;
    try {
      json = (await res.json()) as Record<string, unknown>;
    } catch (e) {
      clearTimeout(timer);
      if (timedOut) throw new NemotronError(`model timed out after ${(timeout / 1000).toFixed(1)}s`, undefined, "timeout");
      throw new NemotronError(`invalid JSON from endpoint: ${(e as Error).message}`, res.status, "http");
    }
    clearTimeout(timer);

    const choice = (json?.choices as Record<string, unknown>[] | undefined)?.[0] ?? {};
    const msg = (choice.message as Record<string, unknown>) ?? {};
    let content = textOf(msg.content);
    let reasoning = textOf(msg.reasoning_content ?? msg.reasoning ?? "");
    const thinkBlocks = [...content.matchAll(THINK_RE)].map((m) => m[1].trim());
    if (thinkBlocks.length) {
      reasoning = [reasoning, ...thinkBlocks].filter(Boolean).join("\n");
      content = content.replace(THINK_RE, "");
    }
    // Templates that open <think> in the prompt emit only the closing tag.
    const close = content.indexOf("</think>");
    if (close !== -1) {
      reasoning = [reasoning, content.slice(0, close).trim()].filter(Boolean).join("\n");
      content = content.slice(close + 8);
    }
    // Unterminated <think> when reasoning runs long: treat it all as reasoning, but keep any tool-call markup.
    const open = content.indexOf("<think>");
    if (open !== -1) {
      const tail = content.slice(open + 7);
      const tc = tail.search(/<TOOLCALL>|<tool_call>/i);
      reasoning = [reasoning, (tc === -1 ? tail : tail.slice(0, tc)).trim()].filter(Boolean).join("\n");
      content = content.slice(0, open) + (tc === -1 ? "" : tail.slice(tc));
    }
    return {
      model: opts.model,
      content: content.trim(),
      reasoning: reasoning.trim(),
      toolCalls: normalizeToolCalls(msg.tool_calls),
      ms: Date.now() - started,
      usage: toUsage(json.usage as Record<string, unknown> | undefined),
      finishReason: choice.finish_reason ? String(choice.finish_reason) : undefined,
      attempts,
      droppedParams: [...new Set(dropped)],
      thinking,
    };
  }
}

/* --------------------------------- vision --------------------------------- */

const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;
const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB of image as base64

export interface VisionOptions {
  /** data:image/...;base64,... URL (preferred: nothing leaves your server but the request) or an https:// image URL */
  image: string;
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  thinking?: Thinking;
  timeoutMs?: number;
  deadline?: number;
  signal?: AbortSignal;
}

/**
 * Ask the vision-language Nemotron about one image (screenshot of a text, QR code, letter…).
 * The image goes as an OpenAI-style image_url content part next to the text prompt.
 */
export async function chatVision(opts: VisionOptions): Promise<ChatResult> {
  const url = (opts.image ?? "").trim();
  if (url.length > MAX_IMAGE_CHARS) throw new NemotronError("image is too large (max ~6 MB)", 400, "http");
  if (!IMAGE_DATA_URL.test(url) && !/^https:\/\/[^\s]+$/i.test(url)) throw new NemotronError("image must be a data:image/(png|jpeg|webp|gif);base64 URL or an https URL", 400, "http");
  const messages: ChatMessage[] = [];
  if (opts.system) messages.push({ role: "system", content: opts.system });
  messages.push({
    role: "user",
    content: [
      { type: "text", text: opts.prompt },
      { type: "image_url", image_url: { url } },
    ],
  });
  return chat({
    model: opts.model ?? VISION_MODEL,
    messages,
    maxTokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.2,
    thinking: opts.thinking ?? parseThinking(process.env.NEMOTRON_VISION_THINKING, "off"),
    timeoutMs: opts.timeoutMs ?? 30_000,
    deadline: opts.deadline,
    signal: opts.signal,
  });
}

/* --------------------------------- JSON helpers --------------------------------- */

/** Index just past the balanced JSON value that starts at `start`, or -1. */
function scanBalanced(text: string, start: number): number {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return -1;
      if (!stack.length) return i + 1;
    }
  }
  return -1;
}

/** Best-effort repair of the JSON small models write: fences, trailing commas, single quotes, truncation. */
export function parseJsonLenient(raw: string): unknown {
  if (typeof raw !== "string") return undefined;
  let s = raw.trim();
  if (!s) return undefined;
  const fenced = s.match(/^```(?:json)?\s*([\s\S]*?)\s*(?:```|$)/i);
  if (fenced) s = fenced[1].trim();
  try {
    return JSON.parse(s);
  } catch {
    /* repair below */
  }
  s = s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  if (!s.includes('"') && s.includes("'")) s = s.replace(/'/g, '"');
  s = s.replace(/([{,]\s*)([A-Za-z_][\w-]*)\s*:/g, '$1"$2":'); // unquoted keys
  s = s.replace(/,\s*([}\]])/g, "$1");
  // Close whatever the model left open (truncated output).
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (const ch of s) {
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  let fixed = s + (inStr ? '"' : "");
  fixed = fixed.replace(/,\s*$/, "").replace(/:\s*$/, ": null");
  fixed += stack.reverse().join("");
  fixed = fixed.replace(/,\s*([}\]])/g, "$1");
  try {
    return JSON.parse(fixed);
  } catch {
    return undefined;
  }
}

export type ParsedArgs = { ok: true; args: Record<string, unknown>; repaired: boolean } | { ok: false; error: string };

/** Parse a tool call's `arguments` (string, object, double-encoded string, or broken JSON). */
export function parseToolArguments(raw: unknown): ParsedArgs {
  if (raw == null || raw === "") return { ok: true, args: {}, repaired: false };
  if (typeof raw === "object" && !Array.isArray(raw)) return { ok: true, args: raw as Record<string, unknown>, repaired: false };
  if (typeof raw !== "string") return { ok: false, error: `arguments must be a JSON object, got ${typeof raw}` };
  let strict = true;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    strict = false;
    v = parseJsonLenient(raw);
  }
  if (typeof v === "string") {
    const inner = parseJsonLenient(v);
    if (inner && typeof inner === "object") v = inner;
  }
  if (v && typeof v === "object" && !Array.isArray(v)) return { ok: true, args: v as Record<string, unknown>, repaired: !strict };
  return { ok: false, error: `arguments are not valid JSON: ${raw.slice(0, 120)}` };
}

/** Pull the first JSON object out of a model response (handles ```json fences and chatter). */
export function extractJson<T = unknown>(text: unknown): T | null {
  if (text && typeof text === "object") return text as T;
  if (!text || typeof text !== "string") return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  for (const c of [fenced?.[1], text]) {
    if (!c) continue;
    for (let start = c.indexOf("{"); start !== -1; start = c.indexOf("{", start + 1)) {
      const end = scanBalanced(c, start);
      if (end === -1) continue;
      try {
        return JSON.parse(c.slice(start, end)) as T;
      } catch {
        const v = parseJsonLenient(c.slice(start, end));
        if (v && typeof v === "object") return v as T;
      }
    }
  }
  return null;
}

/* --------------------------------- content-embedded tool calls --------------------------------- */

export interface ContentToolCall {
  name: string;
  /** JSON string, like native tool calls */
  arguments: string;
}

export interface ParsedContentCalls {
  calls: ContentToolCall[];
  /** The content with tool-call markup removed (plan / commentary) */
  rest: string;
  format?: "TOOLCALL" | "tool_call" | "xml_function" | "json";
}

function callsFromJson(v: unknown, allowed: Set<string>): ContentToolCall[] {
  const items = Array.isArray(v) ? v : v && typeof v === "object" && Array.isArray((v as { tool_calls?: unknown }).tool_calls) ? (v as { tool_calls: unknown[] }).tool_calls : [v];
  const out: ContentToolCall[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const fn = (o.function && typeof o.function === "object" ? o.function : o) as Record<string, unknown>;
    const name = String(fn.name ?? o.tool ?? o.tool_name ?? "").replace(/^functions\./, "");
    if (!allowed.has(name)) continue;
    const a = fn.arguments ?? fn.parameters ?? fn.args ?? fn.input ?? {};
    out.push({ name, arguments: typeof a === "string" ? a : JSON.stringify(a) });
  }
  return out;
}

function callsFromXml(inner: string, allowed: Set<string>): ContentToolCall[] {
  const out: ContentToolCall[] = [];
  for (const m of inner.matchAll(/<function=([\w.-]+)>([\s\S]*?)(?:<\/function>|$)/g)) {
    const name = m[1].replace(/^functions\./, "");
    if (!allowed.has(name)) continue;
    const args: Record<string, unknown> = {};
    for (const p of m[2].matchAll(/<parameter=([\w.-]+)>([\s\S]*?)(?:<\/parameter>|(?=<parameter=)|$)/g)) {
      const val = p[2].trim();
      const parsed = /^[[{]/.test(val) || /^-?\d+(\.\d+)?$/.test(val) || /^(true|false|null)$/.test(val) ? parseJsonLenient(val) : undefined;
      args[p[1]] = parsed === undefined ? val : parsed;
    }
    out.push({ name, arguments: JSON.stringify(args) });
  }
  return out;
}

/**
 * Nemotron sometimes writes tool calls into the message text instead of `tool_calls`:
 *   <TOOLCALL>[{"name":"check_link","arguments":{"url":"..."}}]</TOOLCALL>
 *   <tool_call>{"name":...,"arguments":...}</tool_call>
 *   <tool_call><function=check_link><parameter=url>...</parameter></function></tool_call>
 *   a bare JSON array/object (optionally fenced) of {name, arguments|parameters}
 * Only names in `allowedNames` are accepted, so ordinary JSON in a reply is never executed.
 */
export function parseContentToolCalls(content: string, allowedNames: string[]): ParsedContentCalls {
  const allowed = new Set(allowedNames);
  if (!content) return { calls: [], rest: "" };

  const tagged = [...content.matchAll(/<TOOLCALL>([\s\S]*?)(?:<\/TOOLCALL>|$)/gi)];
  if (tagged.length) {
    const calls = tagged.flatMap((m) => callsFromJson(parseJsonLenient(m[1]), allowed));
    if (calls.length) return { calls, rest: content.replace(/<TOOLCALL>[\s\S]*?(?:<\/TOOLCALL>|$)/gi, "").trim(), format: "TOOLCALL" };
  }

  const hermes = [...content.matchAll(/<tool_call>([\s\S]*?)(?:<\/tool_call>|$)/gi)];
  if (hermes.length) {
    const calls = hermes.flatMap((m) => (/<function=/.test(m[1]) ? callsFromXml(m[1], allowed) : callsFromJson(parseJsonLenient(m[1]), allowed)));
    if (calls.length) return { calls, rest: content.replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi, "").trim(), format: "tool_call" };
  }

  if (/<function=/.test(content)) {
    const calls = callsFromXml(content, allowed);
    if (calls.length) return { calls, rest: content.replace(/<function=[\s\S]*?(?:<\/function>|$)/g, "").trim(), format: "xml_function" };
  }

  // Bare JSON: try each top-level array/object in order (fenced blocks first).
  const sources: string[] = [];
  for (const f of content.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) sources.push(f[1]);
  sources.push(content);
  for (const src of sources) {
    for (let i = 0; i < src.length; i++) {
      if (src[i] !== "[" && src[i] !== "{") continue;
      const end = scanBalanced(src, i);
      const chunk = end === -1 ? src.slice(i) : src.slice(i, end);
      const v = parseJsonLenient(chunk);
      const calls = v === undefined ? [] : callsFromJson(v, allowed);
      if (calls.length) {
        const rest = content.replace(/```(?:json)?\s*[\s\S]*?```/gi, (blk) => (blk.includes(chunk.slice(0, 40)) ? "" : blk)).replace(chunk, "").trim();
        return { calls, rest, format: "json" };
      }
      if (end !== -1) i = end - 1;
    }
  }
  return { calls: [], rest: content };
}
