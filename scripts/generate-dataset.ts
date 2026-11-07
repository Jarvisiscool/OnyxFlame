/**
 * Use Nemotron to write more labeled synthetic messages for the eval set.
 *   npm run generate            → 30 new examples
 *   npm run generate -- 60      → 60 new examples
 * Appends to src/data/eval-set.generated.json. Review it before you trust the metrics.
 */
import "./_env";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chat, extractJson, DEEP_MODEL, hasNvidiaKey } from "@/lib/nemotron";

const OUT = path.join(process.cwd(), "src/data/eval-set.generated.json");

const KINDS = [
  "toll or parking fine scam",
  "package delivery fee scam",
  "bank impersonation asking to move money or verify login",
  "carrier impersonation asking for a PIN or code (SIM swap)",
  "family member on a new number asking for money",
  "wrong-number friendly opener",
  "job or task offer scam",
  "government impersonation (IRS, SSA, sheriff)",
  "legitimate bank or card alert that does NOT ask for anything",
  "legitimate delivery notification",
  "legitimate appointment reminder",
  "legitimate personal text from a friend or family member",
  "legitimate one-time passcode message",
  "legitimate carrier bill or usage alert using the real domain",
];

const SYSTEM = `You create labeled synthetic text messages to evaluate a scam detector. Everything must be fictional:
phone numbers in the 555-01XX range, invented scam domains (never real working sites), no real people.
Make them realistic and varied in tone. Some legit messages should sound urgent; some scams should sound calm.
Output JSON only: {"items":[{"from":"+1 (xxx) 555-01xx","displayName":"optional caller ID name","channel":"sms"|"voicemail","body":"...","label":"scam"|"legit"}]}`;

async function main() {
  if (!hasNvidiaKey()) throw new Error("Set NVIDIA_API_KEY in .env.local first");
  const target = Number(process.argv[2] ?? 30);
  const existing: unknown[] = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : [];
  const out: Record<string, unknown>[] = [];
  while (out.length < target) {
    const kinds = [...KINDS].sort(() => Math.random() - 0.5).slice(0, 5);
    const res = await chat({
      model: DEEP_MODEL,
      temperature: 0.95,
      maxTokens: 2500,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Write 5 messages, one for each: ${kinds.join("; ")}.` },
      ],
    });
    const j = extractJson<{ items: Record<string, unknown>[] }>(res.content || res.reasoning);
    const items = (j?.items ?? []).filter((x) => typeof x.body === "string" && (x.label === "scam" || x.label === "legit"));
    out.push(...items.map((x, i) => ({ ...x, id: `gen-${Date.now()}-${i}`, channel: x.channel === "voicemail" ? "voicemail" : "sms" })));
    process.stdout.write(`\r  ${Math.min(out.length, target)}/${target}`);
  }
  writeFileSync(OUT, JSON.stringify([...existing, ...out.slice(0, target)], null, 2));
  console.log(`\nSaved ${target} new examples → ${path.relative(process.cwd(), OUT)}. Now run: npm run eval`);
}

main().catch((e) => {
  console.error("✗", (e as Error).message);
  process.exit(1);
});
