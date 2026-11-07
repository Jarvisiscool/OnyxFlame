"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DEMO_INBOX } from "@/data/demo-inbox";
import type { ActionId, InboxMessage } from "@/lib/types";
import { useAnalysis } from "./useAnalysis";
import { Phone } from "./Phone";
import { Investigation } from "./Investigation";
import { Composer } from "./Composer";
import { ScamGym } from "./ScamGym";
import { Results } from "./Results";
import { modelShort } from "./ui";

type Tab = "protect" | "practice" | "results";
type Status = { live: boolean; fastModel: string; deepModel: string; recordings: number };

const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: "protect", label: "Live protection", hint: "During" },
  { id: "practice", label: "Practice", hint: "Before" },
  { id: "results", label: "Results", hint: "Proof" },
];

const TOASTS: Partial<Record<ActionId, (m: InboxMessage) => string>> = {
  block_sender: (m) => `Blocked ${m.from}. Future texts and calls from this number won't reach you.`,
  report_7726: () => "Reported to 7726. Carriers use reports to block the sender for everyone.",
  delete_message: () => "Message deleted.",
  warn_family: () => "Sent to your family group: “Heads up: scam texts going around pretending to be a company we use. Don't tap links, check in the official app.”",
  mark_safe: (m) => `Marked ${m.displayName ?? m.from} as safe.`,
};

export function App() {
  const [tab, setTab] = useState<Tab>("protect");
  const [status, setStatus] = useState<Status | null>(null);
  const [replay, setReplay] = useState(false);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [nextIdx, setNextIdx] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [bannerId, setBannerId] = useState<string | null>(null);
  const [composer, setComposer] = useState(false);
  const [done, setDone] = useState<Record<string, ActionId[]>>({});
  const [toast, setToast] = useState<string | null>(null);
  const { runs, analyze } = useAnalysis(replay);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: Status) => {
        setStatus(s);
        if (s.recordings > 0 && !s.live) setReplay(true);
      })
      .catch(() => {});
  }, []);

  const deliver = useCallback(
    (m: Omit<InboxMessage, "receivedAt">) => {
      const msg: InboxMessage = { ...m, receivedAt: new Date().toISOString() };
      setInbox((xs) => [...xs, msg]);
      setBannerId(msg.id);
      setFocusId(msg.id);
      setOpenId(null);
      analyze(msg);
    },
    [analyze],
  );

  const deliverNext = useCallback(() => {
    if (nextIdx >= DEMO_INBOX.length) return;
    const m = DEMO_INBOX[nextIdx];
    setNextIdx((i) => i + 1);
    deliver({ ...m, id: `${m.id}-${Date.now()}` });
  }, [deliver, nextIdx]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, dialog") || e.metaKey || e.ctrlKey) return;
      if (e.key === "n" && tab === "protect") deliverNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deliverNext, tab]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const seenTypes = useMemo(
    () => [...new Set(Object.values(runs).flatMap((r) => (r.verdict && r.verdict.risk !== "safe" ? [r.verdict.scamType] : [])))].slice(0, 4),
    [runs],
  );

  const focusMsg = inbox.find((m) => m.id === focusId);
  const remaining = DEMO_INBOX.length - nextIdx;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-8 gap-y-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
              <circle cx="11" cy="14" r="8" fill="none" stroke="var(--color-ink)" strokeWidth="3" />
              <circle cx="17" cy="14" r="8" fill="none" stroke="var(--color-scam)" strokeWidth="3" />
            </svg>
            <span className="font-display text-xl font-extrabold tracking-tight">Second Look</span>
          </div>
          <nav className="flex gap-1" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${tab === t.id ? "bg-ink text-white" : "text-ink-soft hover:bg-wash"}`}
              >
                {t.label}
                <span className={`ml-1.5 text-[11px] font-medium ${tab === t.id ? "text-white/60" : "text-muted"}`}>{t.hint}</span>
              </button>
            ))}
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-3 text-[12px]">
            {status && (
              <span className={`rounded-full px-2.5 py-1 font-semibold ${status.live ? "bg-nv/10 text-nv" : "bg-caution-wash text-caution"}`} title={`${status.fastModel} + ${status.deepModel}`}>
                {status.live ? `Nemotron live: ${modelShort(status.fastModel)} + ${modelShort(status.deepModel)}` : "Offline mode: add NVIDIA_API_KEY for Nemotron"}
              </span>
            )}
            <label className="flex cursor-pointer items-center gap-2 font-semibold text-ink-soft" title="Stream saved Nemotron runs instead of calling the API. Use this if the venue Wi-Fi is bad.">
              <input type="checkbox" checked={replay} onChange={(e) => setReplay(e.target.checked)} className="accent-[var(--color-agent)]" />
              Replay saved runs{status ? ` (${status.recordings})` : ""}
            </label>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6">
        {tab === "protect" && (
          <div className="grid items-start gap-10 lg:grid-cols-[372px_minmax(0,1fr)]">
            <div className="flex flex-col items-center gap-4 lg:sticky lg:top-6">
              <Phone
                inbox={inbox}
                runs={runs}
                openId={openId}
                onOpen={(id) => {
                  setOpenId(id);
                  if (id) setFocusId(id);
                }}
                bannerId={bannerId}
                done={done}
                onAction={(id, a) => {
                  setDone((d) => ({ ...d, [id]: [...(d[id] ?? []), a] }));
                  const m = inbox.find((x) => x.id === id);
                  const make = TOASTS[a];
                  if (m && make) setToast(make(m));
                }}
              />
              <div className="flex w-full flex-wrap justify-center gap-2">
                <button
                  onClick={deliverNext}
                  disabled={remaining === 0}
                  className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-ink-soft disabled:opacity-40"
                  title="Shortcut: N"
                >
                  {remaining ? `Deliver next message (${remaining} left)` : "All demo messages delivered"}
                </button>
                <button onClick={() => setComposer(true)} className="rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold hover:border-ink/40">
                  Write your own
                </button>
                {inbox.length > 0 && (
                  <button
                    onClick={() => {
                      setInbox([]);
                      setNextIdx(0);
                      setOpenId(null);
                      setFocusId(null);
                      setBannerId(null);
                      setDone({});
                    }}
                    className="rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-ink"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            <Investigation msg={focusMsg} run={focusId ? runs[focusId] : undefined} onDeliver={deliverNext} />
          </div>
        )}
        {tab === "practice" && <ScamGym seenTypes={seenTypes} />}
        {tab === "results" && <Results />}
      </main>

      {composer && (
        <Composer
          onClose={() => setComposer(false)}
          onSend={(m) => {
            setComposer(false);
            deliver({ ...m, id: `custom-${Date.now()}` });
          }}
        />
      )}
      {toast && (
        <div role="status" className="animate-sheet-up fixed bottom-6 left-1/2 z-50 w-[min(520px,92vw)] -translate-x-1/2 rounded-2xl bg-ink px-5 py-3 text-sm leading-snug text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
