import results from "@/data/eval-results.json";
import { ModelChip, fmtMs } from "./ui";

type Metrics = {
  n?: number;
  accuracy?: number;
  precision?: number;
  recall?: number;
  falsePositiveRate?: number;
  fastPathShare?: number;
  avgMs?: number;
  confusion?: { tp: number; fp: number; tn: number; fn: number };
  misses?: { id: string; label: string; got: string; body: string }[];
};

/** eval-results.json may gain a `holdout` block; its exact shape is read defensively. */
type Holdout = Metrics & { datasetSize?: number; n?: number; rules?: Metrics | null; nemotron?: Metrics | null; note?: string };
type EvalFile = {
  updatedAt?: string;
  datasetSize?: number;
  models?: { fast?: string; deep?: string };
  rules?: Metrics | null;
  nemotron?: Metrics | null;
  holdout?: Holdout | null;
};

const data = results as unknown as EvalFile;
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const pct = (x?: number) => (isNum(x) ? `${Math.round(x * 100)}%` : "–");

type Row = { key: keyof Metrics; label: string; hint: string; fmt: (m: Metrics) => string; lowerBetter?: boolean };

const ROWS: Row[] = [
  { key: "recall", label: "Scams caught", hint: "Share of scams flagged as scam or suspicious", fmt: (m) => pct(m.recall) },
  { key: "falsePositiveRate", label: "Real messages wrongly flagged", hint: "Lower is better. False alarms erode trust.", fmt: (m) => pct(m.falsePositiveRate), lowerBetter: true },
  { key: "precision", label: "Flags that were right", hint: "When it warns you, how often it's correct", fmt: (m) => pct(m.precision) },
  { key: "accuracy", label: "Overall accuracy", hint: "", fmt: (m) => pct(m.accuracy) },
  { key: "fastPathShare", label: "Answered by the small model alone", hint: "Messages that skipped the deep investigation", fmt: (m) => pct(m.fastPathShare) },
  { key: "avgMs", label: "Average time per message", hint: "", fmt: (m) => (isNum(m.avgMs) ? fmtMs(m.avgMs) : "–") },
];

const HEADLINE: Row[] = [ROWS[0], ROWS[1], ROWS[4]];

const FLOW = [
  { t: "Message arrives", d: "SMS, email or voicemail transcript" },
  { t: "Redact", d: "Cards, SSNs, codes, names, addresses removed on the device" },
  { t: "Triage", d: "Nemotron Nano rates risk in about a second" },
  { t: "Investigate", d: "Nemotron Super plans and calls tools: sender intelligence, domain registry (RDAP), lookalike detector, official directory, scam playbooks" },
  { t: "Guardrails", d: "Rules can raise a 'safe' call or cap confidence the evidence doesn't support" },
  { t: "Protect", d: "Verdict, block/report/verify actions, recovery plan, practice" },
];

function Bar({ value, tone }: { value?: number; tone: "rules" | "agent" }) {
  return (
    <div className="h-2 rounded-full bg-ink/8">
      {isNum(value) && <div className={`h-full rounded-full ${tone === "agent" ? "bg-agent" : "bg-ink/35"}`} style={{ width: `${Math.max(2, value * 100)}%` }} />}
    </div>
  );
}

const SHORT: Partial<Record<keyof Metrics, string>> = { recall: "Scams caught", falsePositiveRate: "False alarms", fastPathShare: "Handled by the small model" };

function Headline({ rules, nemo }: { rules: Metrics; nemo: Metrics | null }) {
  return (
    <div className="mt-6 grid gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-3">
      {HEADLINE.map((r) => (
        <div key={r.key} className="flex flex-col bg-panel p-4">
          <p className="text-[13px] font-semibold text-ink-soft">
            {SHORT[r.key] ?? r.label}
            {r.lowerBetter && <span className="font-normal text-muted">, lower is better</span>}
          </p>
          <p className="mt-1.5 font-display text-[40px] leading-none font-bold tnum">{r.fmt(nemo ?? rules)}</p>
          <p className={`mt-1 text-[12px] ${nemo ? "font-semibold text-agent" : "text-muted"}`}>{nemo ? "Nemotron agent" : "Rules only"}</p>
          {nemo && (
            <div className="mt-auto space-y-2.5 pt-4 text-[12px]">
              <div>
                <div className="mb-1 flex justify-between gap-2">
                  <span className="text-muted">Rules only</span>
                  <span className="tnum text-ink-soft">{r.fmt(rules)}</span>
                </div>
                <Bar value={rules[r.key] as number | undefined} tone="rules" />
              </div>
              <div>
                <div className="mb-1 flex justify-between gap-2">
                  <span className="font-semibold whitespace-nowrap text-agent">Nemotron agent</span>
                  <span className="font-semibold whitespace-nowrap tnum">{r.fmt(nemo)}</span>
                </div>
                <Bar value={nemo[r.key] as number | undefined} tone="agent" />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function NotMeasured({ what }: { what: string }) {
  return (
    <p className="mt-3 rounded-xl border border-dashed border-ink/25 px-3.5 py-2.5 text-[13px] leading-snug text-ink-soft">
      <span className="font-semibold text-agent">Nemotron agent:</span> not measured yet on {what}. Run{" "}
      <code className="rounded bg-panel px-1 font-mono text-[12px]">npm run eval</code> with an NVIDIA API key to fill in the comparison. These numbers are the rules
      baseline the agent falls back to offline.
    </p>
  );
}

function MetricTable({ cols, caption }: { cols: { label: string; m: Metrics | null | undefined; agent?: boolean }[]; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-panel ring-1 ring-line">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-[13px] text-muted">
            <th scope="col" className="px-4 py-3 font-semibold">
              Metric
            </th>
            {cols.map((c) => (
              <th key={c.label} scope="col" className={`px-4 py-3 text-right font-semibold ${c.agent ? "text-agent" : ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.key} className="border-b border-line/70 last:border-0">
              <th scope="row" className="px-4 py-2.5 font-normal">
                <span className="block font-semibold">{r.label}</span>
                {r.hint && <span className="block text-[12px] text-muted">{r.hint}</span>}
              </th>
              {cols.map((c) => (
                <td key={c.label} className="px-4 py-2.5 text-right tnum">
                  {c.m ? (
                    <span className={c.agent ? "font-display text-lg font-bold" : "text-ink-soft"}>{r.fmt(c.m)}</span>
                  ) : (
                    <span className="text-[12px] text-muted">not run</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Results() {
  const rules: Metrics = data.rules ?? {};
  const nemo = data.nemotron ?? null;
  const holdout = data.holdout ?? null;
  const c = rules.confusion;
  const misses = (nemo?.misses ?? rules.misses ?? []).slice(0, 4);

  // Holdout may be { rules, nemotron } or a single metrics block.
  const holdoutCols = holdout
    ? holdout.rules || holdout.nemotron
      ? [
          ...(holdout.rules ? [{ label: "Rules only", m: holdout.rules }] : []),
          ...(holdout.nemotron ? [{ label: "Nemotron agent", m: holdout.nemotron, agent: true }] : []),
        ]
      : [{ label: "Held-out set", m: holdout as Metrics }]
    : null;
  const holdoutSize = holdout?.datasetSize ?? holdout?.n ?? holdout?.nemotron?.n ?? holdout?.rules?.n;

  return (
    <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <section className="min-w-0">
        <h2 className="font-display text-[34px] leading-[1.05] font-bold">How well it works</h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          Measured on {data.datasetSize ?? rules.n ?? "our"} synthetic messages{c ? ` (${c.tp + c.fn} scams, ${c.tn + c.fp} real)` : ""} that we wrote and labeled. No customer data. Run{" "}
          <code className="rounded bg-panel px-1 font-mono text-[13px]">npm run eval</code> to reproduce.
        </p>
        <Headline rules={rules} nemo={nemo} />
        {!nemo && <NotMeasured what="this set" />}

        <h3 className="mt-8 mb-3 font-display text-xl font-bold">All metrics</h3>
        <MetricTable
          caption="Rules only compared with the Nemotron agent"
          cols={nemo ? [{ label: "Rules only", m: rules }, { label: "Nemotron agent", m: nemo, agent: true }] : [{ label: "Rules only", m: rules }]}
        />

        {holdoutCols && (
          <>
            <h3 className="mt-8 font-display text-xl font-bold">Held-out set</h3>
            <p className="mt-1 mb-3 text-[13px] leading-snug text-ink-soft">
              {holdoutSize ? `${holdoutSize} messages` : "Messages"} we didn&apos;t look at while building the agent, so the score isn&apos;t tuned to them.
              {holdout?.note ? ` ${holdout.note}` : ""}
            </p>
            <MetricTable caption="Results on the held-out set" cols={holdoutCols} />
            {(holdout?.rules || holdout?.nemotron) && !holdout?.nemotron && <NotMeasured what="the held-out set" />}
          </>
        )}

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted">
          {data.updatedAt && <span>Last run {new Date(data.updatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.</span>}
          {nemo && data.models?.fast && (
            <>
              <span>Nemotron agent used</span>
              <ModelChip model={data.models.fast} />
              {data.models.deep && <ModelChip model={data.models.deep} />}
            </>
          )}
        </p>
      </section>

      <section className="min-w-0">
        <h3 className="font-display text-2xl font-bold">How a message is checked</h3>
        <ol className="mt-5">
          {FLOW.map((f, i) => (
            <li key={f.t} className="relative grid grid-cols-[28px_1fr] gap-3 pb-4 last:pb-0">
              {i < FLOW.length - 1 && <span className="absolute top-7 bottom-0 left-[13.5px] w-px bg-line" aria-hidden />}
              <span className="relative z-10 grid h-7 w-7 place-items-center rounded-full bg-panel text-[12px] font-bold ring-1 ring-line tnum">{i + 1}</span>
              <span className="pt-0.5">
                <span className="block text-[15px] font-semibold">{f.t}</span>
                <span className="block text-[13px] leading-snug text-muted">{f.d}</span>
              </span>
            </li>
          ))}
        </ol>

        {misses.length > 0 && (
          <div className="mt-8">
            <h3 className="font-display text-xl font-bold">Where it got it wrong</h3>
            <p className="mt-1 text-[13px] text-muted">{nemo?.misses ? "Nemotron agent" : "Rules baseline"}. Showing the mistakes keeps the numbers honest.</p>
            <ul className="mt-3 space-y-2">
              {misses.map((m) => (
                <li key={m.id} className="rounded-xl bg-panel px-3.5 py-2.5 ring-1 ring-line">
                  <p className="text-[12px] font-semibold text-ink-soft">
                    Really <span className={m.label === "scam" ? "text-scam" : "text-safe"}>{m.label === "legit" ? "real" : m.label}</span>, called{" "}
                    <span className={m.got === "scam" ? "text-scam" : m.got === "safe" ? "text-safe" : "text-caution"}>{m.got}</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{m.body}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 rounded-2xl bg-panel p-4 text-[13px] leading-relaxed text-ink-soft ring-1 ring-line">
          <span className="font-semibold text-ink">What&apos;s simulated:</span> carrier network signals (number age, caller-ID attestation, sending volume, spam reports) and the
          registry entries for our invented scam domains. Real domains are checked live over RDAP. A carrier already has the network data, so this is the API it could plug in.
        </div>
      </section>
    </div>
  );
}
