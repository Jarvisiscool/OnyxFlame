/**
 * Sanity-check your NVIDIA setup before the demo:
 *   npm run check
 * 1. Lists Nemotron models your key can reach
 * 2. Confirms the configured fast/deep models answer
 * 3. Confirms the deep model makes a tool call
 */
import "./_env";
import { BASE_URL, FAST_MODEL, DEEP_MODEL, chat, hasNvidiaKey } from "@/lib/nemotron";

async function main() {
  if (!hasNvidiaKey()) {
    console.error("✗ NVIDIA_API_KEY is not set. Copy .env.example to .env.local and paste your key from build.nvidia.com.");
    process.exit(1);
  }
  const res = await fetch(`${BASE_URL}/models`, { headers: { Authorization: `Bearer ${process.env.NVIDIA_API_KEY}` } });
  if (res.ok) {
    const j = (await res.json()) as { data: { id: string }[] };
    const nemo = j.data.map((m) => m.id).filter((id) => /nemotron/i.test(id)).sort();
    console.log(`Nemotron models available (${nemo.length}):\n  ${nemo.join("\n  ")}\n`);
    for (const m of [FAST_MODEL, DEEP_MODEL]) {
      if (!nemo.includes(m)) console.warn(`! ${m} is not in the list. Set NEMOTRON_FAST_MODEL / NEMOTRON_DEEP_MODEL in .env.local to one of the above.`);
    }
  } else {
    console.warn(`! Could not list models (${res.status}). Continuing.`);
  }

  const fast = await chat({ model: FAST_MODEL, noThink: true, maxTokens: 60, messages: [{ role: "system", content: "Reply with JSON only." }, { role: "user", content: 'Return {"ok":true}' }] });
  console.log(`✓ Fast model ${FAST_MODEL} answered in ${fast.ms} ms: ${fast.content.slice(0, 80)}`);

  const deep = await chat({
    model: DEEP_MODEL,
    maxTokens: 800,
    messages: [
      { role: "system", content: "You are a helpful agent. Use tools when useful." },
      { role: "user", content: "How old is the domain example.com? Use the tool." },
    ],
    tools: [
      {
        type: "function",
        function: { name: "check_link", description: "Check a domain", parameters: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
      },
    ],
  });
  if (deep.toolCalls.length) console.log(`✓ Deep model ${DEEP_MODEL} made a tool call in ${deep.ms} ms: ${deep.toolCalls[0].function.name}(${deep.toolCalls[0].function.arguments})`);
  else console.warn(`! Deep model answered without a tool call. Try another NEMOTRON_DEEP_MODEL. Response: ${deep.content.slice(0, 160)}`);
}

main().catch((e) => {
  console.error("✗", (e as Error).message);
  process.exit(1);
});
