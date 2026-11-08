"use client";

import type { ReactNode } from "react";
import type { Risk, Verdict } from "@/lib/types";

/* ---------------- Icons (24px stroke set) ---------------- */
const PATHS: Record<string, ReactNode> = {
  shield: <path d="M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4" />,
  tag: (
    <>
      <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" />
      <circle cx="8" cy="8" r="1.5" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  flag: <path d="M5 21V4h11l-2 4 2 4H5" />,
  list: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="3" />
      <path d="M8 9h8M8 13h8M8 17h5" />
    </>
  ),
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m3 16 5-5 4 4 3-3 6 6" />
      <circle cx="15.5" cy="8.5" r="1.5" />
    </>
  ),
  up: <path d="M12 19V5m-6 6 6-6 6 6" />,
  clip: <path d="M20 11.5 12.5 19a5 5 0 0 1-7-7l8-8a3.5 3.5 0 0 1 5 5l-8 8a2 2 0 0 1-3-3l7-7" />,
  left: <path d="m15 5-7 7 7 7" />,
  right: <path d="m9 5 7 7-7 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  alert: <path d="M12 4 2.5 20h19L12 4Zm0 6v4m0 3v.01" />,
  lock: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  pause: <path d="M9 6v12M15 6v12" />,
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2M9 2h6" />
    </>
  ),
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />,
  bell: <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2Zm4 4a2 2 0 0 0 4 0" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-9.5v.01" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3m0 14v3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M2 12h3m14 0h3M4.9 19.1 7 17m10-10 2.1-2.1" />
    </>
  ),
  msg: <path d="M4 5h16v11H9l-5 4V5Z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  voicemail: (
    <>
      <circle cx="6.5" cy="12" r="3.5" />
      <circle cx="17.5" cy="12" r="3.5" />
      <path d="M6.5 15.5h11" />
    </>
  ),
  flame: <path d="M12 3c1 4 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-3.5 2-5 1 1.5 2 2 2 2s-1-4 1-7Z" />,
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" />
    </>
  ),
  refresh: <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
};

export function Icon({ name, size = 18, stroke = 2, className, label }: { name: keyof typeof PATHS | string; size?: number; stroke?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {PATHS[name]}
    </svg>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={(size * 14) / 22} viewBox="0 0 22 14" aria-hidden>
      <rect x="0" y="0" width="22" height="14" rx="7" fill="#E20074" />
      <circle cx="15" cy="7" r="4.6" fill="#fff" />
      <circle cx="15" cy="7" r="2.4" fill="#E20074" />
    </svg>
  );
}

/* ---------------- Words ---------------- */

/** Decisive graded confidence: a word and a number. */
export function gradeWords(v: Pick<Verdict, "risk" | "confidence">) {
  const pct = Math.round(v.confidence * 100);
  if (v.risk === "scam") return { label: "Scam", grade: v.confidence >= 0.9 ? "very likely" : v.confidence >= 0.75 ? "likely" : "possibly", pct };
  if (v.risk === "suspicious") return { label: "Not sure", grade: "be careful", pct };
  return { label: "Looks safe", grade: v.confidence >= 0.9 ? "very likely safe" : "probably safe", pct };
}

export function VerdictPill({ v, long }: { v: Pick<Verdict, "risk" | "confidence">; long?: boolean }) {
  const g = gradeWords(v);
  return (
    <span className={`pill ${v.risk}`}>
      {v.risk === "scam" && <Icon name="alert" size={13} stroke={2.4} />}
      {v.risk === "safe" && <Icon name="check" size={13} stroke={2.6} />}
      {long && v.risk !== "suspicious" ? `${g.label} · ${g.grade}, ${g.pct}%` : `${g.label} · ${g.pct}%`}
    </span>
  );
}

export const RISK_TITLE: Record<Risk, string> = { scam: "Likely scam", suspicious: "Be careful", safe: "Looks safe" };

/** "Nemotron 3.5 Lightning" / "Nemotron 3.5 Super", or the rules when no model ran. */
export function friendlyModel(model: string | undefined, role: "fast" | "deep") {
  if (!model) return role === "fast" ? "Nemotron 3.5 Lightning" : "Nemotron 3.5 Super";
  if (/rule|offline|planner|fallback/i.test(model)) return role === "fast" ? "Rules triage (offline)" : "Rules investigator (offline)";
  return role === "fast" ? "Nemotron 3.5 Lightning" : "Nemotron 3.5 Super";
}

export function fmtMs(ms: number | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "";
  return ms < 1000 ? `${Math.max(1, Math.round(ms))} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function fmtTime(iso: string | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function senderName(m: { displayName?: string; from: string }) {
  return m.displayName ?? m.from;
}

/** URLs and bare domains in a message body. */
export const LINK_RE = /(https?:\/\/[^\s]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|top|club|info|vip|shop|online|xyz|ly|co|us|io)(?:\/[^\s]*)?)/gi;

export function splitLinks(body: string) {
  const out: { text: string; link: boolean }[] = [];
  let last = 0;
  for (const m of body.matchAll(LINK_RE)) {
    const raw = m[0].replace(/[.,!?)]+$/, "");
    const i = m.index ?? 0;
    if (i > last) out.push({ text: body.slice(last, i), link: false });
    out.push({ text: raw, link: true });
    last = i + raw.length;
  }
  if (last < body.length) out.push({ text: body.slice(last), link: false });
  return out;
}

/** Wrap each tell (case-insensitive) in <mark>. Returns the tells that weren't found in the text. */
export function Highlight({ text, tells, on }: { text: string; tells: string[]; on: boolean }) {
  if (!on || !tells.length) return <>{text}</>;
  const esc = tells.filter(Boolean).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!esc.length) return <>{text}</>;
  const parts = text.split(new RegExp(`(${esc.join("|")})`, "gi"));
  const set = new Set(tells.map((t) => t.toLowerCase()));
  return (
    <>
      {parts.map((p, i) =>
        set.has(p.toLowerCase()) ? (
          <mark key={i}>{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

export function missingTells(text: string, tells: string[]) {
  const t = text.toLowerCase();
  return tells.filter((x) => !t.includes(x.toLowerCase()));
}
