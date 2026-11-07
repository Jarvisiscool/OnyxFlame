/**
 * Sanity-check your NVIDIA (or OpenRouter) setup before the demo:
 *   npm run check             # all checks, including one full agent run on a demo scam
 *   npm run check -- --quick  # skip the full agent run
 *
 * 1. Lists the Nemotron models your key can reach
 * 2. Times candidate fast models (triage) with the configured reasoning mode
 * 3. Checks which deep models make native tool calls (or text tool calls the agent parses)
 *    candidates: nemotron-3.5-super-vl-120b-a12b, nemotron-3-super-120b-a12b, your NEMOTRON_DEEP_MODEL
 * 4. Checks the content-embedded tool-call path (<TOOLCALL>[…]</TOOLCALL>) the agent falls back to
 * 5. Checks the vision model with a tiny image (for screenshot / QR checks)
 * 6. Runs the real agent once and prints latency/tokens per model
 * 7. Prints a suggested .env.local based on what it saw
 */
import "./_env";
import {
  baseUrl,
  chat,
  chatVision,
  VISION_MODEL,
  hasNvidiaKey,
  isOpenRouter,
  parseContentToolCalls,
  reasoningControlFor,
  rejectedParamsFor,
  requestHeaders,
  thinkingFor,
  thinkingLabel,
  FAST_MODEL,
  DEEP_MODEL,
  type ChatResult,
  type ToolSchema,
} from "@/lib/nemotron";
import type { AgentEvent } from "@/lib/types";

const quick = process.argv.includes("--quick");
const ok = (s: string) => console.log(`✓ ${s}`);
const warn = (s: string) => console.warn(`! ${s}`);
const bad = (s: string) => console.error(`✗ ${s}`);

const CHECK_LINK: ToolSchema = {
  type: "function",
  function: { name: "check_link", description: "Check a domain's registration age and owner", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
};

async function step<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    bad(`${label}: ${(e as Error).message}`);
    return null;
  }
}

function describe(res: ChatResult) {
  const u = res.usage ? `, ${res.usage.promptTokens}→${res.usage.completionTokens} tokens${res.usage.reasoningTokens ? ` (${res.usage.reasoningTokens} reasoning)` : ""}` : "";
  return `${res.ms} ms${u}, thinking ${thinkingLabel(res.thinking)}${res.droppedParams.length ? `, endpoint rejected ${res.droppedParams.join(", ")}` : ""}`;
}

async function main() {
  if (!hasNvidiaKey()) {
    bad("NVIDIA_API_KEY is not set. Copy .env.example to .env.local and paste your key from build.nvidia.com (or OpenRouter).");
    process.exit(1);
  }
  const provider = isOpenRouter() ? "OpenRouter" : "NVIDIA";
  console.log(`Endpoint: ${baseUrl()} (${provider})`);
  console.log(`Fast model: ${FAST_MODEL} · reasoning via ${reasoningControlFor(FAST_MODEL)} · thinking ${thinkingLabel(thinkingFor("fast"))}`);
  console.log(`Deep model: ${DEEP_MODEL} · reasoning via ${reasoningControlFor(DEEP_MODEL)} · thinking ${thinkingLabel(thinkingFor("deep"))}\n`);

  const rec: Record<string, string> = {};
  if (isOpenRouter()) rec.NVIDIA_BASE_URL = baseUrl();

  // 1. Models
  let available: string[] = [];
  const list = await step("list models", async () => {
    const res = await fetch(`${baseUrl()}/models`, { headers: requestHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as { data: { id: string }[] };
  });
  if (list) {
    available = list.data.map((m) => m.id).filter((id) => /nemotron/i.test(id)).sort();
    console.log(`Nemotron models available (${available.length}):\n  ${available.join("\n  ")}\n`);
    for (const [m, envName] of [
      [FAST_MODEL, "NEMOTRON_FAST_MODEL"],
      [DEEP_MODEL, "NEMOTRON_DEEP_MODEL"],
    ] as const) {
      if (available.length && !available.includes(m)) {
        const alt = available.find((id) => (envName === "NEMOTRON_FAST_MODEL" ? /nano/i : /super|ultra/i).test(id));
        warn(`${m} is not in the list.${alt ? ` Try ${envName}=${alt}` : ""}`);
        if (alt) rec[envName] = alt;
      }
    }
  }

  // 2. Fast model candidates: pick the quickest that returns clean JSON.
  const FAST_CANDIDATES = [...new Set(["nvidia/nemotron-3.5-lightning-30b-a3b", "nvidia/nemotron-nano-3-30b-a3b", "nvidia/nemotron-3.5-bolt-e4b", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", "nvidia/nemotron-3-nano-30b-a3b", FAST_MODEL])].filter((m) => !available.length || available.includes(m) || m === FAST_MODEL);
  const fastResults: { model: string; res: ChatResult; json: boolean }[] = [];
  for (const model of FAST_CANDIDATES) {
    const res = await step(`fast candidate ${model}`, () =>
      chat({ model, thinking: thinkingFor("fast"), maxTokens: 80, timeoutMs: 20_000, messages: [{ role: "system", content: "Reply with JSON only." }, { role: "user", content: 'Return {"ok":true}' }] }),
    );
    if (!res) continue;
    const json = /\{\s*"ok"\s*:\s*true\s*\}/.test(res.content);
    fastResults.push({ model, res, json });
    (json ? ok : warn)(`Fast ${model}: ${res.content.slice(0, 60) || "(empty)"} · ${describe(res)}`);
  }
  const fast = fastResults.find((f) => f.model === FAST_MODEL)?.res ?? fastResults[0]?.res ?? null;
  const bestFast = fastResults.filter((f) => f.json).sort((x, y) => x.res.ms - y.res.ms)[0];
  if (bestFast && bestFast.model !== FAST_MODEL) rec.NEMOTRON_FAST_MODEL = bestFast.model;

  // 3. Deep model candidates: must call tools (natively, or as text the agent parses). Prefer Nemotron 3.5 Super.
  const DEEP_CANDIDATES = [...new Set(["nvidia/nemotron-3.5-super-vl-120b-a12b", "nvidia/nemotron-3-ultra-550b-a55b", "nvidia/nemotron-3-super-120b-a12b", DEEP_MODEL])].filter((m) => !available.length || available.includes(m) || m === DEEP_MODEL);
  const deepResults: { model: string; res: ChatResult; tools: "native" | "content" | "none" }[] = [];
  for (const model of DEEP_CANDIDATES) {
    const res = await step(`deep candidate ${model} (native tools)`, () =>
      chat({
        model,
        thinking: thinkingFor("deep"),
        maxTokens: 1200,
        timeoutMs: 45_000,
        tools: [CHECK_LINK],
        messages: [
          { role: "system", content: "You are an investigator. Use tools when useful." },
          { role: "user", content: "How old is the domain example.com? Use the tool." },
        ],
      }),
    );
    if (!res) continue;
    if (res.toolCalls.length) {
      deepResults.push({ model, res, tools: "native" });
      ok(`Deep ${model} made a native tool call: ${res.toolCalls[0].function.name}(${res.toolCalls[0].function.arguments}) · ${describe(res)}`);
      continue;
    }
    const parsed = parseContentToolCalls(res.content || res.reasoning, ["check_link"]);
    if (parsed.calls.length) {
      deepResults.push({ model, res, tools: "content" });
      ok(`Deep ${model} wrote its tool call as text (${parsed.format}); the agent parses this: ${parsed.calls[0].name}(${parsed.calls[0].arguments}) · ${describe(res)}`);
    } else {
      deepResults.push({ model, res, tools: "none" });
      warn(`Deep ${model} answered without a tool call: ${res.content.slice(0, 120)} · ${describe(res)}`);
    }
  }
  const deepEntry = deepResults.find((d) => d.model === DEEP_MODEL);
  const deep = deepEntry?.res ?? null;
  const nativeOk = deepEntry?.tools === "native";
  const contentFromNative = deepEntry?.tools === "content";
  // Order of DEEP_CANDIDATES is the preference order; native tool calling beats text tool calls.
  const bestDeep = deepResults.find((d) => d.tools === "native") ?? deepResults.find((d) => d.tools === "content");
  if (bestDeep && bestDeep.model !== DEEP_MODEL) rec.NEMOTRON_DEEP_MODEL = bestDeep.model;

  // 4. Content-embedded tool calls (the agent's text protocol, used if native tools are rejected)
  const text = await step("content-embedded tool-call path", () =>
    chat({
      model: DEEP_MODEL,
      thinking: "off",
      maxTokens: 300,
      timeoutMs: 30_000,
      messages: [
        {
          role: "system",
          content:
            'You can call tools by replying ONLY with <TOOLCALL>[{"name":"tool_name","arguments":{...}}]</TOOLCALL>. Available tool: check_link(url): check a domain\'s registration age.',
        },
        { role: "user", content: "How old is the domain example.com?" },
      ],
    }),
  );
  let textOk = false;
  if (text) {
    const parsed = parseContentToolCalls(text.content || text.reasoning, ["check_link"]);
    if (parsed.calls.length) {
      textOk = true;
      ok(`Text tool-call protocol parses (${parsed.format}): ${parsed.calls[0].name}(${parsed.calls[0].arguments}) · ${text.ms} ms`);
    } else if (text.toolCalls.length) {
      textOk = true;
      ok(`Endpoint turned the text protocol into native tool_calls: ${text.toolCalls[0].function.name} · ${text.ms} ms`);
    } else warn(`Text tool-call protocol not followed: ${text.content.slice(0, 160)}`);
  }

  // 5. Vision model (screenshot / QR checks)
  const tinyPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const vision = await step(`vision model ${VISION_MODEL}`, () => chatVision({ image: tinyPng, prompt: "Describe this image in five words.", maxTokens: 60, timeoutMs: 30_000 }));
  if (vision) ok(`Vision model ${VISION_MODEL} answered: ${vision.content.slice(0, 60) || "(empty)"} · ${describe(vision)}`);
  else if (available.length && !available.includes(VISION_MODEL)) {
    const alt = available.find((id) => /vl|vision/i.test(id));
    if (alt) rec.NEMOTRON_VISION_MODEL = alt;
  }

  // 6. One full agent run
  let agentMs = 0;
  if (!quick) {
    const { runAnalysis } = await import("@/lib/agent");
    const { DEMO_INBOX } = await import("@/data/demo-inbox");
    const m = { ...DEMO_INBOX[0], receivedAt: "", label: undefined };
    const events: AgentEvent[] = [];
    console.log(`\nFull agent run on "${m.body.slice(0, 60)}…"`);
    await step("agent run", () => runAnalysis(m, (e) => events.push(e), { pace: false }));
    for (const e of events) {
      if (e.type === "llm_call") console.log(`  · ${e.purpose}${e.turn !== undefined ? ` turn ${e.turn}` : ""} ${e.model}: ${e.ms} ms, ${e.tokens?.totalTokens ?? "?"} tokens, ${e.toolCalls} tool call(s) [${e.format}]`);
      if (e.type === "plan") console.log(`  · plan (${e.source}): ${e.text}`);
      if (e.type === "notice") console.log(`  · ${e.level}: ${e.text}`);
      if (e.type === "verdict") console.log(`  → verdict ${e.verdict.risk} ${Math.round(e.verdict.confidence * 100)}% by ${e.model}: ${e.verdict.headline}`);
      if (e.type === "done") {
        agentMs = e.totalMs;
        console.log(`  done in ${e.totalMs} ms · ${e.llmCalls} model calls · ${e.toolCalls} tool calls · ${e.metrics?.tokens.totalTokens ?? "?"} tokens${e.metrics?.fallback ? " · FINISHED BY RULES" : ""}`);
      }
    }
    const v = events.find((e) => e.type === "verdict");
    if (v?.type === "verdict" && v.model === DEEP_MODEL) ok("Nemotron completed the investigation end to end");
    else warn("The run was finished by the rule-based fallback. See notices above.");
  }

  // 7. Recommendations
  const dropped = [...new Set([...rejectedParamsFor(FAST_MODEL), ...rejectedParamsFor(DEEP_MODEL)])];
  if (dropped.length) warn(`Endpoint rejects ${dropped.join(", ")}. The client drops them automatically; reasoning control may be ignored.`);
  if (rejectedParamsFor(DEEP_MODEL).some((p) => /chat_template_kwargs|reasoning/.test(p))) rec.NEMOTRON_DEEP_THINKING = "off";
  if (deep && deep.ms > 9_000 && thinkingFor("deep") !== "off") {
    rec.NEMOTRON_DEEP_THINKING = "off";
    warn(`One deep turn took ${deep.ms} ms with thinking on. For a snappy demo set NEMOTRON_DEEP_THINKING=off (or a small budget like 256).`);
  }
  if (fast && fast.ms > 4_000) rec.NEMOTRON_FAST_THINKING = "off";
  const deepMs = deep?.ms ?? 0;
  const estimate = Math.max(agentMs, (fast?.ms ?? 0) + 3 * deepMs + 2_000);
  if (estimate * 1.3 > 25_000) {
    rec.NEMOTRON_RUN_BUDGET_MS = String(Math.min(55_000, Math.ceil((estimate * 1.3) / 1000) * 1000));
    rec.NEMOTRON_DEEP_TIMEOUT_MS = String(Math.min(30_000, Math.max(15_000, Math.ceil((deepMs * 2) / 1000) * 1000)));
  }
  if (!nativeOk && !contentFromNative && !textOk) bad("Neither native nor text tool calls worked with this deep model. Pick another NEMOTRON_DEEP_MODEL.");

  if (!quick && (rec.NEMOTRON_FAST_MODEL || rec.NEMOTRON_DEEP_MODEL)) console.log("\n(The full agent run above used your current models. Re-run after updating .env.local.)");
  console.log("\nSuggested .env.local:");
  const lines = Object.entries(rec);
  if (!lines.length) console.log("  (current settings look good — nothing to change)");
  for (const [k, v] of lines) console.log(`  ${k}=${v}`);
  console.log(`  # current: NEMOTRON_FAST_THINKING=${thinkingLabel(thinkingFor("fast"))} NEMOTRON_DEEP_THINKING=${thinkingLabel(thinkingFor("deep"))}`);
}

main().catch((e) => {
  bad((e as Error).message);
  process.exit(1);
});
