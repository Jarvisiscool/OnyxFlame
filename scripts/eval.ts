/**
 * Measure detection quality on the synthetic eval sets.
 *
 *   npm run eval                  → rules-only baseline AND the Nemotron agent (if NVIDIA_API_KEY is set)
 *   npm run eval -- --offline     → rules only (keeps the last saved Nemotron numbers)
 *   npm run eval -- --verbose     → also print every message with its verdict
 *
 * Two sets are scored separately:
 *   dev     = src/data/eval-set.ts (+ eval-set.generated.json if present). Tune against this one.
 *   holdout = src/data/eval-holdout.ts. Written before tuning; the honest number.
 *
 * Writes src/data/eval-results.json. The Results tab reads `rules`, `nemotron`
 * (dev set), `datasetSize`, `models` and `updatedAt`; holdout lives under `holdout`.
 * Set SECONDLOOK_NO_RDAP=1 to skip live domain-registry lookups (faster, deterministic).
 */
import "./_env";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { runAnalysis } from "@/lib/agent";
import { hasNvidiaKey, DEEP_MODEL, FAST_MODEL } from "@/lib/nemotron";
import { EVAL_SET } from "@/data/eval-set";
import { HOLDOUT_SET } from "@/data/eval-holdout";
import type { AgentEvent, InboxMessage } from "@/lib/types";

const GENERATED = path.join(process.cwd(), "src/data/eval-set.generated.json");
const OUT = path.join(process.cwd(), "src/data/eval-results.json");
const VERBOSE = process.argv.includes("--verbose");

type Labeled = InboxMessage & { label: "scam" | "legit" };
type Raw = Omit<InboxMessage, "receivedAt" | "channel"> & { channel?: InboxMessage["channel"]; label: "scam" | "legit" };

const prep = (xs: Raw[]) => xs.map((e) => ({ ...e, channel: e.channel ?? "sms", receivedAt: "" })) as Labeled[];

function loadDev(): Labeled[] {
  const base = prep(EVAL_SET);
  if (!existsSync(GENERATED)) return base;
  const extra = JSON.parse(readFileSync(GENERATED, "utf8")) as Labeled[];
  return [...base, ...extra.map((e, i) => ({ ...e, id: e.id ?? `g${i}`, channel: e.channel ?? "sms", receivedAt: "" }))];
}

async function evaluate(set: Labeled[], offline: boolean, tag: string) {
  let tp = 0, fp = 0, tn = 0, fn = 0, flaggedSuspicious = 0, fastPath = 0;
  let totalMs = 0;
  // Calibration: probability the message is risky implied by the verdict, vs the label.
  let brier = 0, confRight = 0, nRight = 0, confWrong = 0, nWrong = 0;
  const misses: { id: string; label: string; got: string; confidence: number; body: string }[] = [];
  for (const [i, m] of set.entries()) {
    const events: AgentEvent[] = [];
    const t0 = Date.now();
    const v = await runAnalysis({ ...m, label: undefined }, (e) => events.push(e), { forceOffline: offline, pace: false });
    totalMs += Date.now() - t0;
    if (events.some((e) => e.type === "route" && e.decision === "fast_path")) fastPath++;
    const flagged = v.risk !== "safe";
    const isScam = m.label === "scam";
    if (v.risk === "suspicious") flaggedSuspicious++;
    if (isScam && flagged) tp++;
    else if (isScam) fn++;
    else if (flagged) fp++;
    else tn++;
    const pRisk = v.risk === "safe" ? 1 - v.confidence : v.risk === "scam" ? v.confidence : 0.5 + (v.confidence - 0.5) * 0.5;
    brier += (pRisk - (isScam ? 1 : 0)) ** 2;
    if (isScam === flagged) (confRight += v.confidence), nRight++;
    else (confWrong += v.confidence), nWrong++;
    if (isScam !== flagged) misses.push({ id: m.id, label: m.label, got: v.risk, confidence: v.confidence, body: m.body.slice(0, 110) });
    if (VERBOSE) console.log(`\n  ${isScam === flagged ? "✓" : "✗"} ${m.id} [${m.label}] → ${v.risk} ${Math.round(v.confidence * 100)}%  ${m.body.slice(0, 70)}`);
    else if (process.stdout.isTTY) process.stdout.write(`\r  ${tag} ${offline ? "rules" : "nemotron"} ${i + 1}/${set.length}`);
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
    calibration: {
      brier: brier / n,
      avgConfidenceWhenRight: nRight ? confRight / nRight : null,
      avgConfidenceWhenWrong: nWrong ? confWrong / nWrong : null,
    },
    confusion: { tp, fp, tn, fn },
    misses,
  };
}

type Metrics = Awaited<ReturnType<typeof evaluate>>;

const fmt = (r: Metrics | null) =>
  r
    ? `acc ${(r.accuracy * 100).toFixed(1)}%  precision ${(r.precision * 100).toFixed(1)}%  recall ${(r.recall * 100).toFixed(1)}%  FPR ${(r.falsePositiveRate * 100).toFixed(1)}%  brier ${r.calibration.brier.toFixed(3)}`
    : "not run (set NVIDIA_API_KEY)";

(async () => {
  const dev = loadDev();
  const holdout = prep(HOLDOUT_SET);
  const offlineOnly = process.argv.includes("--offline") || !hasNvidiaKey();
  const count = (s: Labeled[]) => `${s.length} messages, ${s.filter((m) => m.label === "scam").length} scams`;
  console.log(`Dev set: ${count(dev)}  ·  Holdout: ${count(holdout)}`);
  const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

  const rules = await evaluate(dev, true, "dev");
  const holdoutRules = await evaluate(holdout, true, "holdout");
  const nemotron = offlineOnly ? (previous.nemotron ?? null) : await evaluate(dev, false, "dev");
  const holdoutNemotron = offlineOnly ? (previous.holdout?.nemotron ?? null) : await evaluate(holdout, false, "holdout");

  const result = {
    updatedAt: new Date().toISOString(),
    datasetSize: dev.length,
    models: { fast: FAST_MODEL, deep: DEEP_MODEL },
    rules,
    nemotron,
    holdout: { datasetSize: holdout.length, rules: holdoutRules, nemotron: holdoutNemotron },
  };
  writeFileSync(OUT, JSON.stringify(result, null, 2) + "\n");
  console.log(`Dev      rules    : ${fmt(rules)}`);
  console.log(`Dev      nemotron : ${fmt(nemotron)}`);
  console.log(`Holdout  rules    : ${fmt(holdoutRules)}`);
  console.log(`Holdout  nemotron : ${fmt(holdoutNemotron)}`);
  const show = (tag: string, r: Metrics) => r.misses.forEach((m) => console.log(`  ${tag} miss ${m.id} [${m.label}→${m.got}] ${m.body}`));
  show("dev", rules);
  show("holdout", holdoutRules);
  console.log(`Saved → ${path.relative(process.cwd(), OUT)}`);
})();
