"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { DEMO_INBOX } from "@/data/demo-inbox";
import type { ActionId, InboxMessage } from "@/lib/types";
import { useAnalysis } from "./useAnalysis";
import { Phone } from "./Phone";
import { Investigation } from "./Investigation";
import { Composer } from "./Composer";
import { ScamGym } from "./ScamGym";
import { Results } from "./Results";
import { Kbd, Logo, RISK_STYLE, prettyModel } from "./ui";

type Tab = "protect" | "practice" | "results";
type Status = { live: boolean; fastModel: string; deepModel: string; recordings: number };

const TABS: { id: Tab; label: string; short: string; hint: string }[] = [
  { id: "protect", label: "Live protection", short: "Protection", hint: "During" },
  { id: "practice", label: "Practice", short: "Practice", hint: "Before" },
  { id: "results", label: "Results", short: "Results", hint: "Proof" },
];

const TOASTS: Partial<Record<ActionId, (m: InboxMessage) => string>> = {
  block_sender: (m) => `Blocked ${m.from}. Future texts and calls from this number won't reach you.`,
  report_7726: () => "Reported to 7726. Carriers use reports to block the sender for everyone.",
  delete_message: () => "Message deleted.",
  warn_family: () => "Sent to your family group: “Heads up: scam texts going around pretending to be a company we use. Don't tap links, check in the official app.”",
  mark_safe: (m) => `Marked ${m.displayName ?? m.from} as safe.`,
};

const PHONE_W = 372;
const PHONE_H = 760;

/** Scales the phone to fit the column: by height on desktop (projector), by width on mobile. */
function usePhoneScale() {
  // A callback ref (stored in state) so the observer re-attaches when the tab remounts the column.
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!el) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const measure = () => {
      const s = desktop.matches ? el.clientHeight / PHONE_H : el.clientWidth / PHONE_W;
      setScale(Math.round(Math.max(0.6, Math.min(1, s)) * 1000) / 1000);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    desktop.addEventListener("change", measure);
    return () => {
      ro.disconnect();
      desktop.removeEventListener("change", measure);
    };
  }, [el]);
  return [setEl, scale] as const;
}

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
  const { runs, analyze, reset } = useAnalysis(replay);
  const [phoneRef, phoneScale] = usePhoneScale();

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
      if ((e.key === "n" || e.key === "N") && !e.altKey && tab === "protect") deliverNext();
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
  const focusRun = focusId ? runs[focusId] : undefined;
  const remaining = DEMO_INBOX.length - nextIdx;
  const models = status ? { fast: status.fastModel, deep: status.deepModel } : undefined;

  // Screen readers hear the verdict when it lands, not every trace step.
  const announcement = !focusMsg
    ? ""
    : focusRun?.verdict
      ? `Second Look: ${RISK_STYLE[focusRun.verdict.risk].word}, ${Math.round(focusRun.verdict.confidence * 100)}% sure. ${focusRun.verdict.headline}`
      : focusRun?.status === "done"
        ? `Second Look couldn't check the message from ${focusMsg.displayName ?? focusMsg.from}.`
        : `Second Look is checking a new message from ${focusMsg.displayName ?? focusMsg.from}.`;

  const protect = tab === "protect";

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={deliverNext}
        disabled={remaining === 0}
        className="inline-flex min-h-9 items-center gap-2 rounded-full bg-ink pr-2 pl-4 text-sm font-semibold text-white hover:bg-ink-soft disabled:pr-4 disabled:opacity-40"
        title={remaining ? `${remaining} demo message${remaining === 1 ? "" : "s"} left. Shortcut: N` : undefined}
      >
        {remaining ? (
          <>
            {inbox.length ? "Next message" : "Deliver the first message"}
            {inbox.length > 0 && <span className="tnum text-[12px] font-medium text-white/70">{remaining} left</span>}
            <Kbd dark>N</Kbd>
          </>
        ) : (
          "All demo messages delivered"
        )}
      </button>
      <button onClick={() => setComposer(true)} className="min-h-9 rounded-full border border-line bg-panel px-4 text-sm font-semibold hover:border-ink/40">
        Write your own
      </button>
      {inbox.length > 0 && (
        <button
          onClick={() => {
            reset();
            setInbox([]);
            setNextIdx(0);
            setOpenId(null);
            setFocusId(null);
            setBannerId(null);
            setDone({});
          }}
          className="min-h-9 rounded-full px-3 text-sm font-semibold text-muted hover:text-ink"
        >
          Reset
        </button>
      )}
    </div>
  );

  return (
    <div className={`flex min-h-dvh flex-col ${protect ? "lg:h-dvh" : ""}`}>
      <header className="shrink-0 border-b border-line bg-panel">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-display text-xl font-extrabold tracking-tight">Second Look</span>
          </div>
          <nav className="order-last grid w-full grid-cols-3 gap-1 rounded-full bg-wash p-1 sm:order-none sm:flex sm:w-auto sm:bg-transparent sm:p-0" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={`min-h-9 min-w-0 rounded-full px-2 text-sm font-semibold whitespace-nowrap sm:px-3 ${tab === t.id ? "bg-ink text-white" : "text-ink-soft hover:bg-ink/5"}`}
              >
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
                <span className={`ml-1.5 hidden text-[11px] font-medium md:inline ${tab === t.id ? "text-white/70" : "text-muted"}`}>{t.hint}</span>
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-[12px]">
            {status && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${status.live ? "bg-nv-wash text-nv" : "bg-caution-wash text-caution"}`}
                title={`${status.fastModel} + ${status.deepModel}`}
              >
                {status.live && <span className="h-2 w-2 rounded-[2px] bg-nv-bright" aria-hidden />}
                {status.live ? (
                  <>
                    <span className="sm:hidden">Nemotron live</span>
                    <span className="hidden sm:inline">
                      Live: {prettyModel(status.fastModel)} + {prettyModel(status.deepModel)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">Offline mode</span>
                    <span className="hidden sm:inline">Offline mode: add NVIDIA_API_KEY for Nemotron</span>
                  </>
                )}
              </span>
            )}
            <label
              className="hidden min-h-8 cursor-pointer items-center gap-2 font-semibold text-ink-soft sm:flex"
              title="Stream saved Nemotron runs instead of calling the API. Use this if the venue Wi-Fi is bad."
            >
              <input type="checkbox" checked={replay} onChange={(e) => setReplay(e.target.checked)} className="h-4 w-4 accent-[var(--color-agent)]" />
              Replay saved runs{status ? ` (${status.recordings})` : ""}
            </label>
          </div>
        </div>
      </header>

      <main className={`mx-auto w-full max-w-[1600px] px-4 sm:px-6 ${protect ? "py-4 lg:min-h-0 lg:flex-1" : "py-8 lg:py-10"}`}>
        {protect && (
          <div className="grid gap-6 lg:h-full lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-8">
            <div className="flex flex-col items-center lg:h-full lg:min-h-0">
              <div ref={phoneRef} className="flex w-full justify-center lg:min-h-0 lg:flex-1">
                <Phone
                  scale={phoneScale}
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
              </div>
            </div>
            <Investigation msg={focusMsg} run={focusRun} onRetry={(m) => analyze(m)} models={models} controls={controls} />
          </div>
        )}
        {tab === "practice" && <ScamGym seenTypes={seenTypes} />}
        {tab === "results" && <Results />}
      </main>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {protect ? announcement : ""}
      </div>

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
