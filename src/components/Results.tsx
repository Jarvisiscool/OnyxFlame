import results from "@/data/eval-results.json";

type Metrics = {
  n: number;
  accuracy: number;
  precision: number;
  recall: number;
  falsePositiveRate: number;
  fastPathShare: number;
  avgMs: number;
  confusion: { tp: number; fp: number; tn: number; fn: number };
};

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

const ROWS: { key: keyof Metrics; label: string; hint: string; fmt: (m: Metrics) => string }[] = [
  { key: "recall", label: "Scams caught", hint: "Share of scams flagged as scam or suspicious", fmt: (m) => pct(m.recall) },
  { key: "falsePositiveRate", label: "Real messages wrongly flagged", hint: "Lower is better. False alarms erode trust.", fmt: (m) => pct(m.falsePositiveRate) },
  { key: "precision", label: "Flags that were right", hint: "When it warns you, how often it's correct", fmt: (m) => pct(m.precision) },
  { key: "accuracy", label: "Overall accuracy", hint: "", fmt: (m) => pct(m.accuracy) },
  { key: "fastPathShare", label: "Answered by the small model alone", hint: "Messages that skipped the deep investigation", fmt: (m) => pct(m.fastPathShare) },
  { key: "avgMs", label: "Average time per message", hint: "", fmt: (m) => `${(m.avgMs / 1000).toFixed(1)} s` },
];

const FLOW = [
  { t: "Message arrives", d: "SMS, email or voicemail transcript" },
  { t: "Redact", d: "Cards, SSNs, codes, names, addresses removed on the device" },
  { t: "Triage", d: "Nemotron Nano rates risk in about a second" },
  { t: "Investigate", d: "Nemotron Super plans and calls tools: sender intelligence, domain registry (RDAP), lookalike detector, official directory, scam playbooks" },
  { t: "Guardrails", d: "Rules can raise a 'safe' call or cap confidence the evidence doesn't support" },
  { t: "Protect", d: "Verdict, block/report/verify actions, recovery plan, practice" },
];

export function Results() {
  const rules = results.rules as Metrics;
  const nemo = (results.nemotron ?? null) as Metrics | null;
  return (
    <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr_1fr]">
      <section>
        <h2 className="font-display text-[34px] font-bold leading-[1.05]">How well it works</h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          Measured on {results.datasetSize} synthetic messages ({rules.confusion.tp + rules.confusion.fn} scams, {rules.confusion.tn + rules.confusion.fp} real) that we wrote and labeled. No customer data. Run{" "}
          <code className="rounded bg-panel px-1 font-mono text-[13px]">npm run eval</code> to reproduce.
        </p>
        <div className="mt-6 overflow-hidden rounded-2xl bg-panel ring-1 ring-line">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[13px] text-muted">
                <th className="px-4 py-3 font-semibold">Metric</th>
                <th className="px-4 py-3 text-right font-semibold">Rules only</th>
                <th className="px-4 py-3 text-right font-semibold text-nv">Nemotron agent</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.key} className="border-b border-line/70 last:border-0">
                  <td className="px-4 py-3">
                    <span className="block font-semibold">{r.label}</span>
                    {r.hint && <span className="block text-[12px] text-muted">{r.hint}</span>}
                  </td>
                  <td className="px-4 py-3 text-right tnum text-ink-soft">{r.fmt(rules)}</td>
                  <td className="px-4 py-3 text-right tnum">{nemo ? <span className="font-display text-lg font-bold">{r.fmt(nemo)}</span> : <span className="text-[12px] text-muted">npm run eval</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          Last run {new Date(results.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. Models: {results.models.fast} and {results.models.deep}.
        </p>
      </section>

      <section>
        <h3 className="font-display text-2xl font-bold">How a message is checked</h3>
        <ol className="mt-5">
          {FLOW.map((f, i) => (
            <li key={f.t} className="relative grid grid-cols-[28px_1fr] gap-3 pb-5 last:pb-0">
              {i < FLOW.length - 1 && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-line" aria-hidden />}
              <span className="relative z-10 grid h-7 w-7 place-items-center rounded-full bg-panel text-[12px] font-bold ring-1 ring-line tnum">{i + 1}</span>
              <span className="pt-0.5">
                <span className="block text-[15px] font-semibold">{f.t}</span>
                <span className="block text-[13px] leading-snug text-muted">{f.d}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-2xl bg-panel p-4 text-[13px] leading-relaxed text-ink-soft ring-1 ring-line">
          <span className="font-semibold text-ink">What&apos;s simulated:</span> carrier network signals (number age, caller-ID attestation, sending volume, spam reports) and the
          registry entries for our invented scam domains. Real domains are checked live over RDAP. A carrier already has the network data, so this is the API it could plug in.
        </div>
      </section>
    </div>
  );
}
