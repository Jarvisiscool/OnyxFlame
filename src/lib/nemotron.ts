/**
 * Minimal client for NVIDIA's OpenAI-compatible endpoint (build.nvidia.com).
 * Plain fetch keeps the dependency surface small and the request shape obvious.
 */

export const BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";

/** Small, fast model: triages every incoming message. */
export const FAST_MODEL = process.env.NEMOTRON_FAST_MODEL || "nvidia/nvidia-nemotron-nano-9b-v2";

/** Larger reasoning model: runs the tool-calling investigation on risky messages. */
export const DEEP_MODEL = process.env.NEMOTRON_DEEP_MODEL || "nvidia/nemotron-3-super-120b-a12b";

export function hasNvidiaKey() {
  return Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_API_KEY.trim());
}

export type ChatRole = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ChatMessage {
  role: ChatRole;
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolSchema {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatResult {
  content: string;
  reasoning: string;
  toolCalls: ToolCall[];
  ms: number;
}

interface ChatOptions {
  model: string;
  messages: ChatMessage[];
  tools?: ToolSchema[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the model to answer without a long reasoning trace (faster). */
  noThink?: boolean;
  timeoutMs?: number;
}

export class NemotronError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

const THINK_RE = /<think>([\s\S]*?)<\/think>/gi;

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new NemotronError("NVIDIA_API_KEY is not set");

  const messages = opts.messages.map((m) => ({ ...m }));
  if (opts.noThink && messages[0]?.role === "system") {
    // Nemotron Nano/Super use a system-prompt switch to turn reasoning off.
    messages[0].content = `/no_think\n${messages[0].content ?? ""}`;
  }

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
  }

  const started = Date.now();
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 60_000);
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const err = new NemotronError(
          `NVIDIA API ${res.status}: ${text.slice(0, 300) || res.statusText}`,
          res.status,
        );
        if (res.status === 429 || res.status >= 500) {
          lastErr = err;
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        throw err;
      }
      const json = await res.json();
      const msg = json?.choices?.[0]?.message ?? {};
      let content: string = msg.content ?? "";
      let reasoning: string = msg.reasoning_content ?? msg.reasoning ?? "";
      const thinkBlocks = [...content.matchAll(THINK_RE)].map((m) => m[1].trim());
      if (thinkBlocks.length) {
        reasoning = [reasoning, ...thinkBlocks].filter(Boolean).join("\n");
        content = content.replace(THINK_RE, "").trim();
      }
      // Some templates emit an unterminated <think> when reasoning runs long.
      if (content.startsWith("<think>")) {
        reasoning = [reasoning, content.slice(7)].filter(Boolean).join("\n");
        content = "";
      }
      return {
        content: content.trim(),
        reasoning: reasoning.trim(),
        toolCalls: Array.isArray(msg.tool_calls) ? msg.tool_calls : [],
        ms: Date.now() - started,
      };
    } catch (e) {
      lastErr = e;
      if (e instanceof NemotronError && e.status && e.status < 500 && e.status !== 429) throw e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new NemotronError(String(lastErr));
}

/** Pull the first JSON object out of a model response (handles ```json fences and chatter). */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf("{");
    if (start === -1) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < c.length; i++) {
      const ch = c[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(c.slice(start, i + 1)) as T;
          } catch {
            break;
          }
        }
      }
    }
  }
  return null;
}
