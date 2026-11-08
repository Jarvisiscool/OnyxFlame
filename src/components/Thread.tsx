"use client";

import { useEffect, useRef, useState } from "react";
import { useDemo } from "./demo";
import { WarnCard } from "./Home";
import { insights, summarize } from "./events";
import { Icon, Logo, VerdictPill, fmtTime, senderName, splitLinks } from "./ui";

export function Thread({ id }: { id: string }) {
  const d = useDemo();
  const msg = d.find(id);
  if (!msg) return null;
  const run = d.runs[id];
  const v = run?.verdict;
  const dec = d.decisions[id];
  const risky = v && v.risk !== "safe";
  const tapLink = (url: string) => {
    if (v?.risk === "safe") d.toast(`Opening ${url}. It checked out, so there's no pause.`);
    else d.go({ name: "pause", id });
  };
  return (
    <div className="view">
      <div className="thread-head">
        <button className="icon-btn" aria-label="Back to home" onClick={() => d.go({ name: "home" })}>
          <Icon name="left" size={22} />
        </button>
        <span className="avatar">
          <Icon name="user" size={17} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="nm">{senderName(msg)}</div>
          <div className="sub">{msg.displayName ? msg.from : "Not in your contacts"}</div>
        </div>
      </div>
      <div className="view-scroll">
        <div className="pad">
          <div className="day">Today {fmtTime(msg.receivedAt)}</div>
          {!v && !run?.error && (
            <div className="checking-card" role="status">
              <span className="spin" aria-hidden /> Checking privately before you act…
            </div>
          )}
          {!v && run?.error && (
            <div className="checking-card" role="alert" style={{ justifyContent: "space-between" }}>
              <span>Couldn&apos;t check this message. Be careful with links.</span>
              <button className="link-btn" onClick={() => d.retry(id)}>
                Try again
              </button>
            </div>
          )}
          {risky && !dec && <WarnCard msg={msg} where="thread" />}
          {risky && dec && (
            <div className="move" style={{ background: "var(--soft)", borderColor: "var(--line)" }}>
              <p style={{ marginTop: 0, color: "var(--ink)", fontWeight: 700, fontSize: 14 }}>
                {dec === "reported" ? "You reported and blocked this sender. Your report helps protect others." : "You marked this as not a scam."}
              </p>
            </div>
          )}
          {msg.channel === "voicemail" ? (
            <div className="vm">
              <div className="bar">
                <Icon name="voicemail" size={18} /> Voicemail · 0:38
                <span className="wave" aria-hidden />
              </div>
              <p>
                <span className="sr-only">Transcript: </span>
                {msg.body}
              </p>
            </div>
          ) : (
            <div className="bubble">
              {splitLinks(msg.body).map((p, i) =>
                p.link ? (
                  <button key={i} className="lnk" onClick={() => tapLink(p.text)}>
                    {p.text}
                  </button>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )}
            </div>
          )}
          <div className="under">{fmtTime(msg.receivedAt)}</div>
          {risky && /https?:|\.\w{2,}\//.test(msg.body) && (
            <div className="under">
              <Icon name="pause" size={14} /> Links in this text will pause before they open.
            </div>
          )}
          {v?.risk === "safe" && (
            <div className="under tick" style={{ color: "var(--safe)" }}>
              <Icon name="check" size={14} stroke={2.6} /> Checked privately · looks safe
            </div>
          )}
          {v && (
            <button className="link-btn" style={{ fontSize: 13.5, marginTop: 16 }} onClick={() => d.go({ name: "timeline", id })}>
              Protection timeline
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const PAUSE_S = 5;
const C = 2 * Math.PI * 52;

/** The calm pause: shown when a risky link is tapped. Safe paths work instantly; only "Open anyway" waits. */
export function CalmPause({ id }: { id: string }) {
  const d = useDemo();
  const msg = d.find(id);
  const run = d.runs[id];
  const v = run?.verdict;
  const [left, setLeft] = useState(PAUSE_S);
  const [confirm, setConfirm] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const keep = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    title.current?.focus();
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (confirm) keep.current?.focus();
  }, [confirm]);

  if (!msg) return null;
  const ins = insights(msg, summarize(run?.events ?? []));
  const ready = left === 0 && Boolean(v);
  const kind = v ? (v.risk === "suspicious" ? "a message we're not sure about" : `a likely scam (${v.scamType.toLowerCase()})`) : "a message we're still checking";
  const already = () => {
    if (!d.decisions[id]) d.report(id, true);
    if (!d.recovery[id]) d.recover(id, "clicked_link");
    d.go({ name: "timeline", id, recover: true });
  };

  return (
    <div className="view pause">
      <div className="view-scroll">
        <div className="pause-top">
          <Logo size={18} /> Second Look paused this link
        </div>
        <div className="ring-wrap" aria-hidden>
          <svg width="124" height="124" viewBox="0 0 124 124">
            <circle className="ring-halo" cx="62" cy="62" r="60" fill="#E2007414" />
            <circle cx="62" cy="62" r="52" fill="#fff" stroke="#E2007426" strokeWidth="6" />
            <circle
              className="ring-arc"
              cx="62"
              cy="62"
              r="52"
              fill="none"
              stroke="#E20074"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (left / PAUSE_S)}
              transform="rotate(-90 62 62)"
            />
            <path d="M55 48v28M69 48v28" stroke="#E20074" strokeWidth="7" strokeLinecap="round" />
          </svg>
        </div>
        <h1 ref={title} tabIndex={-1} style={{ outline: "none" }}>
          Let&apos;s slow down a second
        </h1>
        <p className="lead">You tapped the link in {kind}. We stopped it before it opened.</p>
        <section className="pause-card" aria-label="The key fact">
          {v ? (
            <VerdictPill v={v} long />
          ) : (
            <span className="pill neutral">
              <span className="spin" aria-hidden /> Still checking
            </span>
          )}
          <p className="fact">{v ? ins.keyFact : "We're checking who owns this link. It stays closed until we know."}</p>
          {v && ins.rush && (
            <p className="rush">
              <Icon name="timer" size={16} />
              <span>{ins.rush}</span>
            </p>
          )}
        </section>
        <div className="pause-acts">
          <p className="note">No rush. These are safe to tap right now.</p>
          {v?.verifyContact?.url && ins.officialHost ? (
            <a className="btn primary" href={v.verifyContact.url} target="_blank" rel="noopener noreferrer">
              <Icon name="shield" size={18} /> Go to {ins.officialHost} instead
            </a>
          ) : (
            <button className="btn primary" onClick={() => d.go({ name: "thread", id })}>
              <Icon name="shield" size={18} /> {v?.verifyContact ? v.verifyContact.how : "Keep me safe, go back"}
            </button>
          )}
          <button
            className="btn secondary"
            disabled={d.decisions[id] === "reported"}
            onClick={() => {
              d.report(id, true);
              d.toast("Blocked and reported. The link stays closed, and your report helps protect others.");
              d.go({ name: "timeline", id });
            }}
          >
            <Icon name="ban" size={18} /> {d.decisions[id] === "reported" ? "Blocked & reported" : "Block & report"}
          </button>
          <p className="open-anyway">
            <button disabled={!ready} onClick={() => setConfirm(true)} aria-describedby="oa-hint">
              Open anyway
            </button>{" "}
            <span id="oa-hint" aria-live="polite">
              {ready ? "after one more check" : left > 0 ? `available after the pause (${left} s)` : "available once the check finishes"}
            </span>
          </p>
          <p className="open-anyway">
            <button onClick={already}>I already tapped it</button>
          </p>
        </div>
      </div>
      {confirm && (
        <div className="confirm">
          <div className="confirm-box" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-d">
            <h2 id="cf-t">Open {ins.linkHost ?? "this link"}?</h2>
            <p id="cf-d">
              {ins.keyFact} If you go ahead, don&apos;t type passwords, card numbers or codes there.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
              <button ref={keep} className="btn primary" onClick={() => setConfirm(false)}>
                Keep me safe
              </button>
              <button
                className="btn secondary"
                onClick={() => {
                  setConfirm(false);
                  if (!d.recovery[id]) d.recover(id, "clicked_link");
                  d.toast("Opened in a protected view (demo: the fake site never loads). Here's what to do next.");
                  d.go({ name: "timeline", id, recover: true });
                }}
              >
                Open anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
