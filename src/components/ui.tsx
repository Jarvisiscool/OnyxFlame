import type { Risk } from "@/lib/types";

export const RISK_STYLE: Record<Risk, { word: string; text: string; bg: string; wash: string; border: string }> = {
  scam: { word: "Scam", text: "text-scam", bg: "bg-scam", wash: "bg-scam-wash", border: "border-scam" },
  suspicious: { word: "Suspicious", text: "text-caution", bg: "bg-caution", wash: "bg-caution-wash", border: "border-caution" },
  safe: { word: "Looks safe", text: "text-safe", bg: "bg-safe", wash: "bg-safe-wash", border: "border-safe" },
};

export function Pill({ risk, small }: { risk: Risk; small?: boolean }) {
  const s = RISK_STYLE[risk];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${s.wash} ${s.text} font-semibold ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.bg}`} aria-hidden />
      {s.word}
    </span>
  );
}

export function Checking({ small, label = "Checking" }: { small?: boolean; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-agent-wash text-agent font-semibold ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      <span className="relative inline-block h-1.5 w-6 overflow-hidden rounded-full bg-agent/15" aria-hidden>
        <span className="scan-line absolute inset-0" />
      </span>
      {label}
    </span>
  );
}

export function NotChecked({ small }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-ink/8 font-semibold text-ink-soft ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      <span className="h-1.5 w-1.5 rounded-full border border-ink-soft" aria-hidden />
      Not checked
    </span>
  );
}

export function ConfidenceBar({ value, risk }: { value: number; risk: Risk }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2" role="img" aria-label={`${pct}% sure`}>
      <div className="h-1.5 flex-1 rounded-full bg-ink/10">
        <div className={`h-full rounded-full ${RISK_STYLE[risk].bg}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tnum text-xs font-semibold text-ink-soft" aria-hidden>
        {pct}% sure
      </span>
    </div>
  );
}

export function modelShort(model: string) {
  const m = model.split("/").pop() ?? model;
  return m.replace(/^nvidia-/, "");
}

/** Agent text sometimes nests quotes: `Matches "'Hi Mom, new number'" playbook` reads as `Matches "Hi Mom, new number" playbook`. */
export function cleanQuotes(s: string) {
  return s.replace(/"'([^'"]*)'"/g, '"$1"').replace(/'"([^'"]*)"'/g, '"$1"').replace(/""([^"]*)""/g, '"$1"');
}

export const isNemotron = (model: string) => /nemotron/i.test(model);

/** "nvidia/nemotron-3-super-120b-a12b" -> "Nemotron Super 120B" */
export function prettyModel(model: string) {
  if (!isNemotron(model)) {
    if (/offline|rule/i.test(model)) return "Rules (offline)";
    return modelShort(model);
  }
  const m = model.toLowerCase();
  const tier = m.includes("nano") ? "Nano" : m.includes("super") ? "Super" : m.includes("ultra") ? "Ultra" : "";
  const size = m.match(/-(\d+(?:\.\d+)?)b(?:-|$)/)?.[1];
  return ["Nemotron", tier, size ? `${size}B` : ""].filter(Boolean).join(" ") || modelShort(model);
}

/** NVIDIA green appears only here: on chips naming the model that did the work. */
export function ModelChip({ model, size = "sm" }: { model: string; size?: "sm" | "md" }) {
  const nv = isNemotron(model);
  return (
    <span
      title={model}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md font-semibold whitespace-nowrap ${
        nv ? "bg-nv-wash text-nv" : "bg-ink/6 text-ink-soft"
      } ${size === "md" ? "px-2 py-1 text-[12px]" : "px-1.5 py-0.5 text-[11px]"}`}
    >
      {nv && <span className="h-2 w-2 shrink-0 rounded-[2px] bg-nv-bright" aria-hidden />}
      <span className="truncate">{prettyModel(model)}</span>
    </span>
  );
}

export function fmtMs(ms: number) {
  if (ms < 1) return "<1 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function Ms({ ms }: { ms: number }) {
  return <span className="tnum">{fmtMs(ms)}</span>;
}

export function fmtTokens(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k tokens` : `${n} tokens`;
}

export function Kbd({ children, dark }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <kbd
      className={`inline-grid h-5 min-w-5 place-items-center rounded-[5px] px-1 text-[11px] font-bold leading-none ${
        dark ? "bg-white/15 text-white ring-1 ring-white/25" : "bg-panel text-ink-soft ring-1 ring-line"
      }`}
    >
      {children}
    </kbd>
  );
}

export function Logo({ size = 28, light }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <circle cx="11" cy="14" r="8" fill="none" stroke={light ? "#fff" : "var(--color-ink)"} strokeWidth="3" />
      <circle cx="17" cy="14" r="8" fill="none" stroke={light ? "#ff5fa2" : "var(--color-scam)"} strokeWidth="3" />
    </svg>
  );
}
