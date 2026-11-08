"use client";

import { useEffect, useState } from "react";
import type { InboxMessage } from "@/lib/types";
import { useDemo } from "./demo";
import { summarize, insights } from "./events";
import { Icon, Logo, RISK_TITLE, senderName } from "./ui";
import { Home, Activity, FamilyLine } from "./Home";
import { Thread, CalmPause } from "./Thread";
import { Timeline } from "./Timeline";
import { Lesson } from "./Lesson";
import { Sheet } from "./Sheets";
import { Login } from "./Login";
import { Ask } from "./Ask";

function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const t = setInterval(tick, 20_000);
    return () => clearInterval(t);
  }, []);
  return now;
}

const hm = (d: Date | null) => (d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(/\s?[AP]M$/, "") : "9:41");

export function Phone({ notifId, dismissNotif, toastText }: { notifId: string | null; dismissNotif: () => void; toastText: string | null }) {
  const d = useDemo();
  const now = useClock();
  const s = d.screen;
  const notif = notifId ? d.find(notifId) : undefined;
  const notifRisk = notifId ? d.runs[notifId]?.verdict?.risk : undefined;

  // Safe messages only get a quiet tick: their heads-up slides away on its own.
  useEffect(() => {
    if (notifRisk !== "safe") return;
    const t = setTimeout(dismissNotif, 3500);
    return () => clearTimeout(t);
  }, [notifRisk, notifId, dismissNotif]);

  let view: React.ReactNode;
  if (!d.signedIn && s.name !== "lock") view = <Login />;
  else if (s.name === "lock") view = <LockScreen now={now} />;
  else if (s.name === "thread") view = <Thread id={s.id} />;
  else if (s.name === "pause") view = <CalmPause key={s.id} id={s.id} />;
  else if (s.name === "timeline") view = <Timeline key={s.id} id={s.id} recover={s.recover} />;
  else if (s.name === "practice") view = <Lesson />;
  else if (s.name === "ask") view = <Ask key={s.about ?? "all"} about={s.about} />;
  else if (s.name === "activity") view = <Activity />;
  else view = d.line === "maria" ? <Home focusChecker={s.focusChecker} /> : <FamilyLine id={d.line} />;

  return (
    <div className="device-box">
      <div className="device">
        <div className="screen" aria-label="Bob's phone" role="region">
          <div className="island" aria-hidden />
          <div className={`sb${s.name === "lock" ? " dark" : ""}`} aria-hidden>
            <span className="tnum">{s.name === "lock" ? "" : hm(now)}</span>
            <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor">
                <rect x="0" y="8" width="3" height="4" rx="1" />
                <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
                <rect x="10" y="3" width="3" height="9" rx="1" />
                <rect x="15" y="0" width="3" height="12" rx="1" />
              </svg>
              <svg width="25" height="12" viewBox="0 0 25 12">
                <rect x="0.5" y="0.5" width="21" height="11" rx="3" fill="none" stroke="currentColor" opacity=".5" />
                <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
              </svg>
            </span>
          </div>
          {view}
          {notif && s.name !== "lock" && !(s.name === "thread" && s.id === notif.id) && (
            <div className="headsup" role="status">
              <NotifCard msg={notif} onClose={dismissNotif} />
            </div>
          )}
          {d.sheet && <Sheet />}
          {toastText && (
            <div className="toast" role="status">
              {toastText}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Stage one of the two-stage warning: the notification (heads-up or lock screen). */
export function NotifCard({ msg, onClose }: { msg: InboxMessage; onClose?: () => void }) {
  const d = useDemo();
  const run = d.runs[msg.id];
  const v = run?.verdict;
  const decision = d.decisions[msg.id];
  const sum = summarize(run?.events ?? []);
  const app = msg.channel === "voicemail" ? "Voicemail" : msg.channel === "email" ? "Mail" : "Messages";
  const open = () => d.go({ name: "thread", id: msg.id });
  const x = onClose && (
    <button className="notif-x" onClick={onClose} aria-label="Dismiss notification">
      <Icon name="x" size={16} />
    </button>
  );

  if (!v) {
    return (
      <div className="notif quiet">
        {x}
        <div className="meta">
          <span className="app">
            <Logo size={16} />
          </span>
          Second Look · {app}
        </div>
        <button className="notif-open" onClick={open}>
          <h3 className="plain" style={{ fontSize: 15 }}>
            {run?.error ? (
              "Couldn't check this one yet"
            ) : (
              <>
                <span className="spin" aria-hidden /> Checking privately…
              </>
            )}
          </h3>
          <p>
            New {msg.channel === "voicemail" ? "voicemail" : msg.channel === "email" ? "email" : "text"} from {senderName(msg)}
            {run?.error ? ". Be careful with links until it's checked." : ""}
          </p>
        </button>
        {run?.error && (
          <div className="acts">
            <button className="btn small soft" onClick={() => d.retry(msg.id)}>
              Try again
            </button>
          </div>
        )}
      </div>
    );
  }

  if (v.risk === "safe") {
    const preview = sum.redaction?.redacted ?? msg.body;
    return (
      <div className="notif quiet">
        {x}
        <div className="meta">
          <span className="app" style={{ background: "var(--soft)" }}>
            <Icon name={msg.channel === "voicemail" ? "voicemail" : "msg"} size={14} />
          </span>
          {app} · {senderName(msg)}
          <span className="now tick" style={{ marginRight: onClose ? 26 : 0 }}>
            <Icon name="check" size={13} stroke={2.6} /> Looks safe
          </span>
        </div>
        <button className="notif-open" onClick={open}>
          <p style={{ marginTop: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{preview}</p>
        </button>
      </div>
    );
  }

  const ins = insights(msg, sum);
  return (
    <div className="notif">
      {x}
      <div className="meta">
        <span className="app">
          <Logo size={16} />
        </span>
        Second Look · {app}
        <span className="now" style={{ marginRight: onClose ? 26 : 0 }}>
          now
        </span>
      </div>
      <button className="notif-open" onClick={open} aria-label={`${RISK_TITLE[v.risk]}: ${v.scamType}. Open the message`}>
        <h3 className={v.risk}>
          <Icon name="alert" size={16} stroke={2.4} /> {RISK_TITLE[v.risk]}: {v.scamType.charAt(0).toLowerCase() + v.scamType.slice(1)}
        </h3>
        <p>{ins.reason}</p>
        <div className="from">
          From {msg.from}
          {msg.displayName ? ` (says "${msg.displayName}")` : " · not in your contacts"}
        </div>
      </button>
      {decision ? (
        <p style={{ marginTop: 8, fontWeight: 700 }} className="tick">
          <Icon name="check" size={14} stroke={2.6} /> {decision === "reported" ? "Reported and blocked" : "Marked as not a scam"}
        </p>
      ) : (
        <div className="acts">
          <button className="btn primary small" onClick={() => d.report(msg.id)}>
            Report &amp; block
          </button>
          <button className="btn soft small" onClick={() => d.markSafe(msg.id)}>
            Not a scam
          </button>
        </div>
      )}
      <div className="fine">
        <Icon name="lock" size={12} /> Checked privately on your phone
      </div>
    </div>
  );
}

function LockScreen({ now }: { now: Date | null }) {
  const d = useDemo();
  const recent = [...d.inbox].reverse().slice(0, 3);
  return (
    <div className="view lock">
      <div className="clock">
        <div className="d">{now ? now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Saturday, November 7"}</div>
        <div className="t tnum">{hm(now)}</div>
      </div>
      {recent.length ? (
        <div className="lock-list">
          {recent.map((m) => (
            <NotifCard key={m.id} msg={m} />
          ))}
        </div>
      ) : (
        <p className="lock-hint">No notifications yet. Press N to deliver the next message to Bob&apos;s phone.</p>
      )}
      <button className="lock-open" onClick={() => d.go({ name: "home" })}>
        Unlock
      </button>
    </div>
  );
}
