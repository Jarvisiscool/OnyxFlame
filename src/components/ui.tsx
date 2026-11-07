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

export function Checking({ small }: { small?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-agent-wash text-agent font-semibold ${small ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}>
      <span className="relative inline-block h-1.5 w-6 overflow-hidden rounded-full bg-agent/15">
        <span className="scan-line absolute inset-0" />
      </span>
      Checking
    </span>
  );
}

export function ConfidenceBar({ value, risk }: { value: number; risk: Risk }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2" aria-label={`Confidence ${pct}%`}>
      <div className="h-1.5 flex-1 rounded-full bg-ink/10">
        <div className={`h-full rounded-full ${RISK_STYLE[risk].bg}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="tnum text-xs font-semibold text-ink-soft">{pct}% sure</span>
    </div>
  );
}

export function modelShort(model: string) {
  const m = model.split("/").pop() ?? model;
  return m.replace(/^nvidia-/, "");
}
