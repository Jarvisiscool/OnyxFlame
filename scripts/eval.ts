/**
 * Measure detection quality on the synthetic eval set.
 *
 *   npm run eval            → runs the rule-only baseline AND the Nemotron agent (if NVIDIA_API_KEY is set)
 *   npm run eval -- --offline   → baseline only
 *
 * Writes src/data/eval-results.json, which the Results tab displays.
 */
import "./_env";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { runAnalysis } from "@/lib/agent";
import { hasNvidiaKey, DEEP_MODEL, FAST_MODEL } from "@/lib/nemotron";
import { EVAL_SET } from "@/data/eval-set";
import type { AgentEvent, InboxMessage } from "@/lib/types";

const GENERATED = path.join(process.cwd(), "src/data/eval-set.generated.json");
const OUT = path.join(process.cwd(), "src/data/eval-results.json");

type Labeled = InboxMessage & { label: "scam" | "legit" };

function loadSet(): Labeled[] {
  const base = EVAL_SET.map((e) => ({ ...e, channel: e.channel ?? "sms", receivedAt: "" })) as Labeled[];
  if (!existsSync(GENERATED)) return base;
  const extra = JSON.parse(readFileSync(GENERATED, "utf8")) as Labeled[];
  return [...base, ...extra.map((e, i) => ({ ...e, id: e.id ?? `g${i}`, channel: e.channel ?? "sms", receivedAt: "" }))];
}

async function evaluate(set: Labeled[], offline: boolean) {
  let tp = 0, fp = 0, tn = 0, fn = 0, flaggedSuspicious = 0, fastPath = 0;
  let totalMs = 0;
  const misses: { id: string; label: string; got: string; body: string }[] = [];
  for (const [i, m] of set.entries()) {
    const events: AgentEvent[] = [];
    const t0 = Date.now();
    // Silence the offline pacing delays for evaluation speed.
    const v = await runAnalysis({ ...m, label: undefined }, (e) => events.push(e), { forceOffline: offline, pace: false });
    totalMs += Date.now() - t0;
    if (events.some((e) => e.type === "route" && e.decision === "fast_path")) fastPath++;
    const flagged = v.risk !== "safe";
    if (v.risk === "suspicious") flaggedSuspicious++;
    if (m.label === "scam" && flagged) tp++;
    else if (m.label === "scam") fn++;
    else if (flagged) fp++;
    else tn++;
    if ((m.label === "scam") !== flagged) misses.push({ id: m.id, label: m.label, got: v.risk, body: m.body.slice(0, 90) });
    process.stdout.write(`\r  ${offline ? "rules" : "nemotron"} ${i + 1}/${set.length}`);
  }
  process.stdout.write("\n");
  const n = set.length;
  const precision = tp / Math.max(1, tp + fp);
  const recall = tp / Math.max(1, tp + fn);
  return {
    n,
    accuracy: (tp + tn) / n,
    precision,
    recall,
    f1: (2 * precision * recall) / Math.max(1e-9, precision + recall),
    falsePositiveRate: fp / Math.max(1, fp + tn),
    suspiciousShare: flaggedSuspicious / n,
    fastPathShare: fastPath / n,
    avgMs: Math.round(totalMs / n),
    confusion: { tp, fp, tn, fn },
    misses,
  };
}

(async () => {
  const set = loadSet();
  const offlineOnly = process.argv.includes("--offline") || !hasNvidiaKey();
  console.log(`Evaluating on ${set.length} labeled synthetic messages (${set.filter((m) => m.label === "scam").length} scams)`);
  const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const rules = await evaluate(set, true);
  const nemotron = offlineOnly ? previous.nemotron ?? null : await evaluate(set, false);
  const result = {
    updatedAt: new Date().toISOString(),
    datasetSize: set.length,
    models: { fast: FAST_MODEL, deep: DEEP_MODEL },
    rules,
    nemotron,
  };
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  const fmt = (r: typeof rules | null) =>
    r ? `acc ${(r.accuracy * 100).toFixed(1)}%  precision ${(r.precision * 100).toFixed(1)}%  recall ${(r.recall * 100).toFixed(1)}%  FPR ${(r.falsePositiveRate * 100).toFixed(1)}%` : "not run (set NVIDIA_API_KEY)";
  console.log(`Rules only : ${fmt(rules)}`);
  console.log(`Nemotron   : ${fmt(nemotron)}`);
  console.log(`Saved → ${path.relative(process.cwd(), OUT)}`);
})();
