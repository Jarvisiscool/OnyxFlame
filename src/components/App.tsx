"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DEMO_INBOX } from "@/data/demo-inbox";
import { FAMILY } from "@/data/demo-family";
import type { InboxMessage, RecoveryPlan, WhatHappened } from "@/lib/types";
import { useAnalysis } from "./useAnalysis";
import { DemoCtx, baseId, type Ctl, type Decision, type LessonInfo, type Labels, type Line, type RecoveryState, type Screen, type SheetName } from "./demo";
import { Phone } from "./Phone";
import { Judges, HowItWorks } from "./Judges";
import { Logo, gradeWords, senderName } from "./ui";
import { ThemeToggle } from "./ThemeToggle";
import { TOUR } from "./tour";

type Status = { live: boolean; fastModel: string; deepModel: string; recordings: number };

const NEXT_LABEL: Record<string, string> = {
  toll: "fake toll text",
  otp: "real Amazon code",
  safe_account: "bank-impostor voicemail",
  bill: "real T-Mobile bill",
  sim_swap: "SIM-swap text",
  wrong_number: "wrong-number opener",
  family: "\"Hi Mom\" text",
  reward: "fake rewards text",
  clinic: "clinic reminder",
};

interface Step {
  key: string;
  label: string;
  group: "Maria's phone" | "Family lines" | "Practice & check";
  screen?: Screen;
  line: Line;
  disabled?: boolean;
}

/** Scale the 406×816 device to the viewport height (projectors: 1280×720, 1440×900). */
function usePhoneScale() {
  const [s, setS] = useState(0.85);
  useLayoutEffect(() => {
    const measure = () => setS(Math.round(Math.max(0.55, Math.min(1, (window.innerHeight - 32) / 816)) * 1000) / 1000);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return s;
}

export function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [replay, setReplay] = useState(false);
  const [inbox, setInbox] = useState<InboxMessage[]>([]);
  const [checks, setChecks] = useState<InboxMessage[]>([]);
  const [nextIdx, setNextIdx] = useState(0);
  const [screen, setScreen] = useState<Screen>({ name: "home" });
  const [line, setLine] = useState<Line>("maria");
  const [notifId, setNotifId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [blocked, setBlocked] = useState<string[]>([]);
  const [reports, setReports] = useState(0);
  const [recovery, setRecovery] = useState<Record<string, RecoveryState>>({});
  const [toastText, setToastText] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetName | null>(null);
  const [tour, setTour] = useState<{ i: number; caption: string } | null>(null);
  const [labels, setLabels] = useState<Labels>({ texts: true, calls: true, pause: true });
  const [streak, setStreak] = useState(3);
  const [lessonInfo, setLessonInfo] = useState<LessonInfo | null>(null);
  const [how, setHow] = useState(false);
  const { runs, analyze, reset } = useAnalysis(replay);
  const scale = usePhoneScale();
  const howBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((s: Status) => {
        setStatus(s);
        if (s.recordings > 0 && !s.live) setReplay(true);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!toastText) return;
    const t = setTimeout(() => setToastText(null), 4200);
    return () => clearTimeout(t);
  }, [toastText]);

  const all = useMemo(() => [...inbox, ...checks], [inbox, checks]);
  const find = useCallback((id: string) => all.find((m) => m.id === id), [all]);

  const go = useCallback((s: Screen) => {
    setSheet(null);
    setScreen(s);
    if (s.name === "thread" || s.name === "timeline" || s.name === "pause") {
      setFocusId(s.id);
      setNotifId((n) => (n === s.id ? null : n));
    }
  }, []);

  const deliverNext = useCallback(() => {
    if (nextIdx >= DEMO_INBOX.length) return;
    const m = DEMO_INBOX[nextIdx];
    setNextIdx((i) => i + 1);
    const msg: InboxMessage = { ...m, id: `${m.id}-${Date.now()}`, receivedAt: new Date().toISOString() };
    setInbox((xs) => [...xs, msg]);
    setNotifId(msg.id);
    setFocusId(msg.id);
    setLine("maria");
    setScreen((s) => (s.name === "lock" || s.name === "home" ? s : { name: "home" }));
    analyze(msg);
  }, [analyze, nextIdx]);

  const report = useCallback(
    (id: string, quiet?: boolean) => {
      const m = find(id);
      setDecisions((d) => ({ ...d, [id]: "reported" }));
      if (m) setBlocked((b) => (b.includes(m.from) ? b : [...b, m.from]));
      setReports((n) => n + 1);
      setNotifId((n) => (n === id ? null : n));
      if (!quiet) setToastText(`Reported and blocked ${m ? senderName(m) : "the sender"}. Your report helps block it for every T-Mobile customer.`);
    },
    [find],
  );

  const markSafe = useCallback((id: string) => {
    setDecisions((d) => ({ ...d, [id]: "safe" }));
    setNotifId((n) => (n === id ? null : n));
    setToastText("Marked as not a scam. Thanks: this helps Second Look learn your contacts.");
  }, []);

  const recover = useCallback(
    (id: string, what: WhatHappened | "nothing") => {
      if (what === "nothing") {
        setRecovery((r) => ({ ...r, [id]: { none: true, checked: [] } }));
        return;
      }
      const m = find(id);
      const verdict = runs[id]?.verdict;
      if (!m || !verdict) return;
      setRecovery((r) => ({ ...r, [id]: { what, loading: true, checked: [] } }));
      fetch("/api/recover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: m, verdict, what }) })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((plan: RecoveryPlan) =>
          setRecovery((r) => (r[id]?.what === what ? { ...r, [id]: { what, plan, checked: plan.steps.map(() => false) } } : r)),
        )
        .catch(() => {
          setRecovery((r) => ({ ...r, [id]: { what, checked: [] } }));
          setToastText("Couldn't load the recovery steps. Try again in a moment.");
        });
    },
    [find, runs],
  );

  const toggleStep = useCallback((id: string, i: number) => {
    setRecovery((r) => {
      const cur = r[id];
      if (!cur) return r;
      const checked = [...cur.checked];
      checked[i] = !checked[i];
      return { ...r, [id]: { ...cur, checked } };
    });
  }, []);

  const check = useCallback(
    (text: string) => {
      const body = text.trim().slice(0, 4000);
      if (!body) return;
      const email = /^\s*(from|subject):/im.test(body);
      const from = body.match(/^\s*from:\s*(.+)$/im)?.[1]?.trim().slice(0, 100) || "Pasted by you";
      const msg: InboxMessage = { id: `check-${Date.now()}`, channel: email ? "email" : "sms", from, body, receivedAt: new Date().toISOString() };
      setChecks((c) => [...c, msg]);
      setFocusId(msg.id);
      analyze(msg);
    },
    [analyze],
  );

  const retry = useCallback(
    (id: string) => {
      const m = find(id);
      if (m) analyze(m);
    },
    [analyze, find],
  );

  const seenTypes = useMemo(() => {
    const mine = all.flatMap((m) => {
      const v = runs[m.id]?.verdict;
      return v && v.risk !== "safe" ? [v.scamType] : [];
    });
    const fam = FAMILY.flatMap((f) => f.alerts.filter((a) => a.risk === "scam").map((a) => a.scamType));
    return [...new Set([...mine.reverse(), ...fam])].slice(0, 5);
  }, [all, runs]);

  const dismissNotif = useCallback(() => setNotifId(null), []);

  const doReset = useCallback(() => {
    reset();
    setInbox([]);
    setChecks([]);
    setNextIdx(0);
    setScreen({ name: "home" });
    setLine("maria");
    setNotifId(null);
    setFocusId(null);
    setDecisions({});
    setBlocked([]);
    setReports(0);
    setRecovery({});
    setSheet(null);
    setToastText(null);
  }, [reset]);

  /* ---------------- Presenter stepper ---------------- */
  const target = useMemo(
    () => inbox.find((m) => baseId(m.id) === "toll") ?? [...inbox].reverse().find((m) => runs[m.id]?.verdict?.risk === "scam"),
    [inbox, runs],
  );
  const steps: Step[] = useMemo(() => {
    const t = target?.id;
    return [
      { key: "home", label: "Before", group: "Maria's phone", screen: { name: "home" }, line: "maria" },
      { key: "lock", label: "Warned: lock screen", group: "Maria's phone", screen: { name: "lock" }, line: "maria" },
      { key: "thread", label: "Warned: in the thread", group: "Maria's phone", screen: t ? { name: "thread", id: t } : undefined, line: "maria", disabled: !t },
      { key: "pause", label: "The calm pause", group: "Maria's phone", screen: t ? { name: "pause", id: t } : undefined, line: "maria", disabled: !t },
      { key: "timeline", label: "After: timeline", group: "Maria's phone", screen: t ? { name: "timeline", id: t, recover: true } : undefined, line: "maria", disabled: !t },
      { key: "activity", label: "Activity log", group: "Maria's phone", screen: { name: "activity" }, line: "maria" },
      { key: "dad", label: "Dad (Frank, 68)", group: "Family lines", screen: { name: "home" }, line: "dad" },
      { key: "sofia", label: "Sofia (15)", group: "Family lines", screen: { name: "home" }, line: "sofia" },
      { key: "practice", label: "Practice lesson", group: "Practice & check", screen: { name: "practice" }, line: "maria" },
      { key: "checker", label: "Check something", group: "Practice & check", screen: { name: "home", focusChecker: true }, line: "maria" },
    ];
  }, [target]);
  const activeKey =
    line !== "maria" && screen.name === "home"
      ? line
      : screen.name === "home"
        ? screen.focusChecker
          ? "checker"
          : "home"
        : screen.name === "timeline"
          ? "timeline"
          : screen.name;
  const runStep = useCallback(
    (st: Step) => {
      if (!st.screen || st.disabled) return;
      setLine(st.line);
      go(st.screen);
    },
    [go],
  );

  /* ---------------- Video mode: scripted auto-play with captions ---------------- */
  const tourApi = useRef({ deliverNext, runStep, steps, doReset });
  useEffect(() => {
    tourApi.current = { deliverNext, runStep, steps, doReset };
  });
  const tourToken = useRef(0);
  const stopTour = useCallback(() => {
    tourToken.current++;
    setTour(null);
  }, []);
  const playTour = useCallback(async () => {
    const token = ++tourToken.current;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    tourApi.current.doReset();
    await sleep(400);
    for (let i = 0; i < TOUR.length; i++) {
      if (tourToken.current !== token) return;
      const sc = TOUR[i];
      const api = tourApi.current;
      if (sc.action.kind === "deliver") api.deliverNext();
      if (sc.action.kind === "reset") api.doReset();
      if (sc.action.kind === "step") {
        const key = sc.action.key;
        const st = api.steps.find((x) => x.key === key);
        if (st) api.runStep(st);
      }
      setTour({ i, caption: sc.caption });
      await sleep(sc.ms);
    }
    if (tourToken.current === token) setTour(null);
  }, []);


  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (e.key === "Escape") {
        setSheet(null);
        stopTour();
        return;
      }
      if (el.closest("input, textarea, select, [role=dialog]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "p" || e.key === "P") {
        playTour();
        return;
      }
      if (e.key === "n" || e.key === "N") deliverNext();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const enabled = steps.filter((s) => !s.disabled);
        const i = enabled.findIndex((s) => s.key === activeKey);
        const next = enabled[e.key === "ArrowRight" ? Math.min(enabled.length - 1, i + 1) : Math.max(0, i - 1)];
        if (next) {
          e.preventDefault();
          runStep(next);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deliverNext, steps, activeKey, runStep, playTour, stopTour]);


  const ctl: Ctl = {
    inbox,
    checks,
    runs,
    screen,
    go,
    line,
    setLine: (l) => {
      setLine(l);
      setScreen({ name: "home" });
    },
    decisions,
    report,
    markSafe,
    blocked,
    unblock: (s) => setBlocked((b) => b.filter((x) => x !== s)),
    recovery,
    recover,
    toggleStep,
    check,
    retry,
    toast: setToastText,
    sheet,
    openSheet: setSheet,
    labels,
    setLabels,
    seenTypes,
    streak,
    finishLesson: () => setStreak((s) => s + 1),
    reports,
    lessonInfo,
    setLessonInfo,
    find,
  };

  const remaining = DEMO_INBOX.length - nextIdx;
  const judgeId = "id" in screen ? screen.id : focusId;
  const focusMsg = focusId ? find(focusId) : undefined;
  const focusRun = focusId ? runs[focusId] : undefined;
  const announce = !focusMsg
    ? ""
    : focusRun?.verdict
      ? `Second Look: ${gradeWords(focusRun.verdict).label}, ${gradeWords(focusRun.verdict).pct}% sure. ${focusRun.verdict.headline}`
      : focusRun?.error
        ? `Second Look couldn't check the message from ${senderName(focusMsg)}.`
        : `Checking a new message from ${senderName(focusMsg)} privately.`;

  const groups = ["Maria's phone", "Family lines", "Practice & check"] as const;

  return (
    <DemoCtx.Provider value={ctl}>
      <main className={tour ? "stage touring" : "stage"} style={{ ["--s" as string]: scale }}>
        <section className="stage-left" aria-label="Presenter controls">
          <div>
            <div className="brand">
              <Logo /> Second Look
            </div>
            <div className="brand-sub">Calm scam protection for the whole family</div>
          </div>
          <nav className="stepper" aria-label="Demo steps">
            <div style={{ marginBottom: 16 }}>
              <button className="deliver" onClick={deliverNext} disabled={remaining === 0} aria-keyshortcuts="N">
                {remaining ? (inbox.length ? "Next message" : "Deliver a message") : "All messages delivered"}
                {remaining > 0 && <small className="tnum">{remaining} left</small>}
                <kbd>N</kbd>
              </button>
              {remaining > 0 && <div className="next-up">Next: {NEXT_LABEL[DEMO_INBOX[nextIdx].id] ?? DEMO_INBOX[nextIdx].id}</div>}
            </div>
            {groups.map((g) => (
              <div key={g}>
                <div className="grp">{g}</div>
                <div className="list">
                  {steps
                    .filter((s) => s.group === g)
                    .map((s) => (
                      <button
                        key={s.key}
                        className={`stp${activeKey === s.key ? " on" : ""}`}
                        aria-current={activeKey === s.key ? "step" : undefined}
                        disabled={s.disabled}
                        title={s.disabled ? "Deliver the toll text first (N)" : undefined}
                        onClick={() => runStep(s)}
                      >
                        <i />
                        {s.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}
            <div className="keys">
              <kbd>←</kbd>
              <kbd>→</kbd> step through
            </div>
          </nav>
          <div className="stage-links">
            <button ref={howBtn} onClick={() => setHow(true)}>
              How it works &amp; results
            </button>
            <button onClick={() => (tour ? stopTour() : playTour())} aria-keyshortcuts="P">{tour ? "Stop video mode" : "Play video demo (P)"}</button>
            <button onClick={doReset}>Reset demo</button>
            <ThemeToggle />
            {status && status.recordings > 0 && (
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <input type="checkbox" checked={replay} onChange={(e) => setReplay(e.target.checked)} /> Replay saved runs
              </label>
            )}
          </div>
        </section>

        <Phone notifId={notifId} dismissNotif={dismissNotif} toastText={toastText} />

        <aside className="stage-right" aria-label="For judges: how it was checked">
          <Judges id={judgeId ?? null} status={status} />
        </aside>
        <div className="sr-only" aria-live="polite">
          {announce}
        </div>
        {tour && (
          <div className="tour-cap" role="status" aria-live="polite">
            <span className="tour-n tnum">
              {tour.i + 1} / {TOUR.length}
            </span>
            {tour.caption}
          </div>
        )}
      </main>
      {how && (
        <HowItWorks
          onClose={() => {
            setHow(false);
            howBtn.current?.focus();
          }}
        />
      )}
    </DemoCtx.Provider>
  );
}
