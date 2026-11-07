"use client";

import { useEffect, useState } from "react";
import type { ActionId, InboxMessage, RecoveryPlan, WhatHappened } from "@/lib/types";
import type { Run } from "./useAnalysis";
import { Checking, ConfidenceBar, Pill, RISK_STYLE } from "./ui";

interface Props {
  inbox: InboxMessage[];
  runs: Record<string, Run>;
  openId: string | null;
  onOpen: (id: string | null) => void;
  bannerId: string | null;
  done: Record<string, ActionId[]>;
  onAction: (msgId: string, action: ActionId) => void;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function senderName(m: InboxMessage) {
  return m.displayName ?? m.from;
}

function Avatar({ m }: { m: InboxMessage }) {
  const name = senderName(m);
  const initial = /^[+\d(]/.test(name) ? "#" : name[0]?.toUpperCase();
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/8 font-display text-sm font-semibold text-ink-soft" aria-hidden>
      {m.channel === "voicemail" ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="6.5" cy="12" r="3.5" />
          <circle cx="17.5" cy="12" r="3.5" />
          <path d="M6.5 15.5h11" />
        </svg>
      ) : (
        initial
      )}
    </span>
  );
}

function StatusBar() {
  return (
    <div className="flex items-center justify-between px-7 pt-3 pb-1 text-[13px] font-semibold text-ink">
      <span className="tnum">2:47</span>
      <span className="flex items-center gap-1.5" aria-hidden>
        <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
          <rect x="0" y="7" width="3" height="4" rx="1" />
          <rect x="4.5" y="5" width="3" height="6" rx="1" />
          <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
          <rect x="13.5" y="0" width="3" height="11" rx="1" />
        </svg>
        <span className="text-[11px] font-bold">5G</span>
        <svg width="24" height="12" viewBox="0 0 24 12" fill="none">
          <rect x="0.5" y="0.5" width="20" height="11" rx="3" stroke="currentColor" opacity="0.4" />
          <rect x="2" y="2" width="14" height="8" rx="1.5" fill="currentColor" />
          <rect x="21.5" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.4" />
        </svg>
      </span>
    </div>
  );
}

function Banner({ m, run, onOpen }: { m: InboxMessage; run?: Run; onOpen: () => void }) {
  const v = run?.verdict;
  return (
    <button
      onClick={onOpen}
      className="animate-drop-in absolute inset-x-3 top-11 z-30 rounded-2xl border border-line bg-panel/95 p-3 text-left shadow-[0_12px_32px_-12px_rgba(25,28,51,0.45)] backdrop-blur"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-[13px] font-bold">Second Look</span>
        {v ? <Pill risk={v.risk} small /> : <Checking small />}
      </div>
      <p className="mt-1 text-[13px] leading-snug text-ink-soft">
        {v ? v.headline : `Checking a new ${m.channel === "voicemail" ? "voicemail" : "message"} from ${senderName(m)}…`}
      </p>
    </button>
  );
}

function Inbox({ inbox, runs, onOpen }: { inbox: InboxMessage[]; runs: Record<string, Run>; onOpen: (id: string) => void }) {
  if (!inbox.length) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
        <p className="font-display text-lg font-semibold">No messages yet</p>
        <p className="mt-1 text-sm text-muted">Deliver a message to watch Second Look check it as it arrives.</p>
      </div>
    );
  }
  return (
    <ul className="phone-scroll flex-1 overflow-y-auto">
      {[...inbox].reverse().map((m) => {
        const run = runs[m.id];
        const v = run?.verdict;
        const held = v?.risk === "scam";
        return (
          <li key={m.id}>
            <button onClick={() => onOpen(m.id)} className="flex w-full gap-3 border-b border-line/70 px-4 py-3 text-left hover:bg-wash">
              <Avatar m={m} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[15px] font-semibold">{senderName(m)}</span>
                  <span className="shrink-0 text-xs text-muted">{timeLabel(m.receivedAt)}</span>
                </span>
                <span className={`mt-0.5 line-clamp-2 text-[13px] leading-snug ${held ? "text-muted/70 blur-[2.5px]" : "text-muted"}`}>
                  {m.channel === "voicemail" ? "Voicemail: " : ""}
                  {m.body}
                </span>
                <span className="mt-1.5 flex items-center gap-2">
                  {v ? <Pill risk={v.risk} small /> : <Checking small />}
                  {held && <span className="text-[11px] text-muted">Hidden until you open it</span>}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

const HAPPENED: { id: WhatHappened; label: string }[] = [
  { id: "clicked_link", label: "I tapped the link" },
  { id: "entered_info", label: "I entered my info or password" },
  { id: "shared_code", label: "I shared a code or PIN" },
  { id: "sent_money", label: "I sent money" },
  { id: "called_back", label: "I called them back" },
];

function Recovery({ m, run, onClose }: { m: InboxMessage; run: Run; onClose: () => void }) {
  const [plan, setPlan] = useState<RecoveryPlan | null>(null);
  const [loading, setLoading] = useState<WhatHappened | null>(null);

  async function choose(what: WhatHappened) {
    setLoading(what);
    const res = await fetch("/api/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: m, verdict: run.verdict, what }),
    });
    setPlan(await res.json());
    setLoading(null);
  }

  return (
    <div className="animate-sheet-up absolute inset-0 z-40 flex flex-col bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <button onClick={onClose} className="text-sm font-semibold text-agent">
          Back
        </button>
        <span className="font-display text-[15px] font-bold">Recovery plan</span>
        <span className="w-9" />
      </div>
      <div className="phone-scroll flex-1 overflow-y-auto px-4 py-4">
        {!plan ? (
          <>
            <p className="font-display text-xl font-semibold leading-tight">What happened?</p>
            <p className="mt-1 text-sm text-muted">It&apos;s okay. Acting in the next few minutes makes the biggest difference.</p>
            <div className="mt-4 grid gap-2">
              {HAPPENED.map((h) => (
                <button
                  key={h.id}
                  onClick={() => choose(h.id)}
                  disabled={loading !== null}
                  className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-left text-[15px] font-medium hover:border-ink/30 disabled:opacity-60"
                >
                  {h.label}
                  {loading === h.id && <Checking small />}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${plan.urgency === "critical" ? "bg-scam text-white" : plan.urgency === "high" ? "bg-caution-wash text-caution" : "bg-wash text-ink-soft"}`}
            >
              {plan.urgency === "critical" ? "Act now" : plan.urgency === "high" ? "Act today" : "Low risk, still worth doing"}
            </span>
            <p className="mt-2 text-[15px] leading-snug">{plan.summary}</p>
            <ol className="mt-4 space-y-3">
              {plan.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-white tnum">{i + 1}</span>
                  <span>
                    <span className="flex items-baseline gap-2">
                      <span className="text-[15px] font-semibold leading-tight">{s.title}</span>
                      <span className="text-[11px] font-semibold text-muted">{s.when}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-soft">{s.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
            <details className="mt-5 rounded-xl bg-wash p-3">
              <summary className="cursor-pointer text-sm font-semibold">FTC report, pre-filled</summary>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-snug text-ink-soft">{plan.reportDraft}</p>
              <button onClick={() => navigator.clipboard?.writeText(plan.reportDraft)} className="mt-2 text-sm font-semibold text-agent">
                Copy report
              </button>
            </details>
            <p className="mt-4 text-[11px] text-muted">{plan.source === "live" ? "Written for your situation by Nemotron" : "Standard recovery checklist (offline)"}</p>
          </>
        )}
      </div>
    </div>
  );
}

const ACTION_DONE: Partial<Record<ActionId, string>> = {
  block_sender: "Sender blocked",
  report_7726: "Reported to 7726",
  delete_message: "Message deleted",
  warn_family: "Family alert sent",
  mark_safe: "Marked as safe",
};

function Thread({ m, run, done, onBack, onAction }: { m: InboxMessage; run?: Run; done: ActionId[]; onBack: () => void; onAction: (a: ActionId) => void }) {
  const v = run?.verdict;
  const [reveal, setReveal] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const hidden = v?.risk === "scam" && !reveal;
  const s = v ? RISK_STYLE[v.risk] : null;

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-3 py-2.5">
        <button onClick={onBack} className="px-1 text-sm font-semibold text-agent" aria-label="Back to messages">
          ‹ Back
        </button>
        <Avatar m={m} />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{senderName(m)}</span>
          {m.displayName && <span className="block truncate text-xs text-muted">{m.from}</span>}
        </span>
      </div>

      <div className="phone-scroll flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 text-center text-[11px] text-muted">
          {m.channel === "voicemail" ? "Voicemail transcript · " : ""}
          {timeLabel(m.receivedAt)}
        </p>
        <div className="relative max-w-[85%]">
          <div className={`rounded-2xl rounded-bl-md bg-wash px-3.5 py-2.5 text-[15px] leading-snug ${hidden ? "select-none blur-[5px]" : ""}`}>{m.body}</div>
          {hidden && (
            <button onClick={() => setReveal(true)} className="absolute inset-0 grid place-items-center text-xs font-semibold text-ink">
              <span className="rounded-full bg-panel px-3 py-1.5 shadow">Show anyway</span>
            </button>
          )}
        </div>

        {/* The Second Look sheet: the verdict lives right under the message it judges. */}
        <div className={`mt-4 overflow-hidden rounded-2xl border-2 ${s ? s.border : "border-agent/30"} bg-panel`}>
          {!v ? (
            <div className="p-4">
              <Checking />
              <p className="mt-2 text-sm text-muted">Investigating the sender, links and wording before you act…</p>
            </div>
          ) : (
            <div className="animate-sheet-up">
              <div className={`${s!.bg} flex items-center justify-between px-4 py-2 text-white`}>
                <span className="font-display text-lg font-bold">{s!.word}</span>
                <span className="text-xs font-semibold opacity-90">{v.scamType}</span>
              </div>
              <div className="space-y-3 p-4">
                <p className="font-display text-[17px] font-semibold leading-tight">{v.headline}</p>
                <ConfidenceBar value={v.confidence} risk={v.risk} />
                <ul className="space-y-1.5">
                  {v.evidence.slice(0, 3).map((e, i) => (
                    <li key={i} className="flex gap-2 text-[13px] leading-snug">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${e.direction === "risk" ? "bg-scam" : "bg-safe"}`} aria-hidden />
                      <span>
                        <span className="font-semibold">{e.signal}.</span> <span className="text-ink-soft">{e.detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                {v.uncertainty && <p className="rounded-lg bg-caution-wash px-3 py-2 text-[12px] leading-snug text-caution">{v.uncertainty}</p>}
                {showVerify && v.verifyContact && (
                  <p className="rounded-lg bg-agent-wash px-3 py-2 text-[13px] leading-snug text-agent">
                    <span className="font-semibold">Check with {v.verifyContact.org}:</span> {v.verifyContact.how}. Don&apos;t use any number or link from this message.
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  {v.actions.map((a) => {
                    const isDone = done.includes(a.id);
                    const primary = a.id === "block_sender" || a.id === "mark_safe";
                    return (
                      <button
                        key={a.id}
                        disabled={isDone}
                        onClick={() => {
                          if (a.id === "open_recovery") return setRecovery(true);
                          if (a.id === "verify_official") return setShowVerify(true);
                          onAction(a.id);
                        }}
                        className={`rounded-full px-3 py-1.5 text-[13px] font-semibold ${
                          isDone ? "bg-safe-wash text-safe" : primary ? "bg-ink text-white" : "border border-line text-ink hover:border-ink/40"
                        }`}
                      >
                        {isDone ? `✓ ${ACTION_DONE[a.id] ?? a.label}` : a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      {recovery && run && <Recovery m={m} run={run} onClose={() => setRecovery(false)} />}
    </div>
  );
}

export function Phone({ inbox, runs, openId, onOpen, bannerId, done, onAction }: Props) {
  const open = inbox.find((m) => m.id === openId);
  const bannerMsg = inbox.find((m) => m.id === bannerId);
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const showBanner = Boolean(bannerId && dismissedId !== bannerId);

  const bannerRun = bannerId ? runs[bannerId] : undefined;
  useEffect(() => {
    if (bannerRun?.status !== "done" || !bannerId) return;
    const t = setTimeout(() => setDismissedId(bannerId), 4500);
    return () => clearTimeout(t);
  }, [bannerRun?.status, bannerId]);

  return (
    <div className="relative mx-auto h-[760px] w-full max-w-[372px] shrink-0 rounded-[52px] bg-ink p-3 shadow-[0_30px_60px_-30px_rgba(25,28,51,0.6)]">
      <div className="relative flex h-full flex-col overflow-hidden rounded-[42px] bg-panel">
        <div className="absolute left-1/2 top-2.5 z-40 h-7 w-28 -translate-x-1/2 rounded-full bg-ink" aria-hidden />
        <StatusBar />
        {showBanner && bannerMsg && bannerId !== openId && (
          <Banner
            key={bannerId}
            m={bannerMsg}
            run={bannerRun}
            onOpen={() => {
              setDismissedId(bannerMsg.id);
              onOpen(bannerMsg.id);
            }}
          />
        )}
        {open ? (
          <Thread key={open.id} m={open} run={runs[open.id]} done={done[open.id] ?? []} onBack={() => onOpen(null)} onAction={(a) => onAction(open.id, a)} />
        ) : (
          <>
            <div className="px-4 pb-2 pt-3">
              <h2 className="font-display text-[28px] font-bold leading-none">Messages</h2>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-safe" aria-hidden />
                Second Look is checking new messages
              </p>
            </div>
            <Inbox inbox={inbox} runs={runs} onOpen={onOpen} />
          </>
        )}
        <div className="mx-auto mb-2 mt-1 h-1 w-28 shrink-0 rounded-full bg-ink/80" aria-hidden />
      </div>
    </div>
  );
}
