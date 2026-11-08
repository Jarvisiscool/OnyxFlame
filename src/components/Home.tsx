"use client";

import { useEffect, useRef, useState } from "react";
import { FAMILY } from "@/data/demo-family";
import type { InboxMessage } from "@/lib/types";
import { useDemo, type Line } from "./demo";
import { insights, summarize } from "./events";
import { Icon, Logo, RISK_TITLE, VerdictPill, fmtTime, gradeWords, senderName } from "./ui";

export function Nav() {
  const d = useDemo();
  const cur = d.screen.name;
  const items = [
    { id: "home", label: "Home", icon: "home", go: () => d.go({ name: "home" }) },
    { id: "activity", label: "Activity", icon: "list", go: () => d.go({ name: "activity" }) },
    { id: "practice", label: "Practice", icon: "target", go: () => d.go({ name: "practice" }) },
  ] as const;
  return (
    <nav className="nav" aria-label="App">
      {items.map((it) => (
        <button key={it.id} onClick={it.go} aria-current={cur === it.id ? "page" : undefined}>
          <Icon name={it.icon} size={21} />
          {it.label}
        </button>
      ))}
    </nav>
  );
}

function LineSwitcher() {
  const d = useDemo();
  const lines: { id: Line; name: string; sub: string; initial: string; bg: string; fg: string; alert?: boolean }[] = [
    { id: "maria", name: "Maria", sub: "You", initial: "M", bg: "var(--av-m-bg, #fcdcec)", fg: "var(--av-m-fg, #8a0047)" },
    ...FAMILY.map((f) => ({
      id: f.id,
      name: f.relation,
      sub: f.status === "okay" ? "Okay" : "Needs help",
      initial: f.initial,
      bg: f.id === "dad" ? "var(--av-d-bg, #dfe7fb)" : "var(--av-s-bg, #dcf3e5)",
      fg: f.id === "dad" ? "var(--av-d-fg, #1d3f8a)" : "var(--av-s-fg, #0b5a3c)",
      alert: f.status !== "okay",
    })),
  ];
  return (
    <div className="lines" role="group" aria-label="Family lines">
      {lines.map((l) => (
        <button key={l.id} className="line" aria-pressed={d.line === l.id} onClick={() => d.setLine(l.id)} aria-label={`${l.name}: ${l.sub}`}>
          <span className={`av${l.alert ? " alert" : ""}`} style={{ background: l.bg, color: l.fg }}>
            {l.initial}
          </span>
          <span className="nm">
            {l.name}
            <span>{l.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

function Header() {
  const d = useDemo();
  return (
    <div className="home-head">
      <div className="wordmark">
        <Logo /> Second Look
      </div>
      <button className="icon-btn" aria-label="Scam label settings" onClick={() => d.openSheet("labels")}>
        <Icon name="gear" size={20} />
      </button>
    </div>
  );
}

/** Stage two of the two-stage warning (also used at the top of home). */
export function WarnCard({ msg, where }: { msg: InboxMessage; where: "home" | "thread" }) {
  const d = useDemo();
  const run = d.runs[msg.id];
  const v = run?.verdict;
  if (!v || v.risk === "safe") return null;
  const ins = insights(msg, summarize(run.events));
  const g = gradeWords(v);
  return (
    <section className={`warn ${v.risk}`} aria-label={`${RISK_TITLE[v.risk]} warning`}>
      {where === "home" ? (
        <div className="wt" style={{ justifyContent: "space-between", flexWrap: "nowrap", alignItems: "flex-start" }}>
          <h2 style={{ marginTop: 0, display: "flex", gap: 6, alignItems: "center" }}>
            <Icon name="alert" size={17} stroke={2.4} />
            {RISK_TITLE[v.risk]}: {v.scamType.charAt(0).toLowerCase() + v.scamType.slice(1)}
          </h2>
          <span className={`pill ${v.risk}`}>{g.pct}% sure</span>
        </div>
      ) : (
        <div className="wt">
          <span className={`pill ${v.risk}`}>
            <Icon name="alert" size={13} stroke={2.4} /> {RISK_TITLE[v.risk]}
          </span>
          <span className="pt">
            {v.scamType} · {g.pct}% sure
          </span>
        </div>
      )}
      <p>{ins.reason}</p>
      {where === "home" && (
        <div className="from">
          {msg.channel === "voicemail" ? "Voicemail" : "Text"} from {msg.from}
          {msg.displayName ? ` (says "${msg.displayName}")` : ""} · {fmtTime(msg.receivedAt)}
        </div>
      )}
      <div className="acts">
        <button className="btn primary small" onClick={() => d.report(msg.id)}>
          Report &amp; block
        </button>
        <button className="btn secondary small" onClick={() => d.markSafe(msg.id)}>
          Not a scam
        </button>
      </div>
      {where === "home" && (
        <div style={{ marginTop: 10, display: "flex", gap: 16 }}>
          <button className="link-btn" style={{ fontSize: 13.5 }} onClick={() => d.go({ name: "thread", id: msg.id })}>
            Open message
          </button>
          <button className="link-btn" style={{ fontSize: 13.5 }} onClick={() => d.go({ name: "timeline", id: msg.id })}>
            See how it was checked
          </button>
        </div>
      )}
      <div className="fine">
        <Icon name="lock" size={12} /> Checked privately on your phone. Your report helps protect others.
      </div>
    </section>
  );
}

function RowStatus({ id }: { id: string }) {
  const d = useDemo();
  const run = d.runs[id];
  const dec = d.decisions[id];
  if (!run || (!run.verdict && !run.error)) return <span className="spin" aria-label="Checking" />;
  if (!run.verdict) return <span className="pill neutral">Not checked</span>;
  if (run.verdict.risk === "safe")
    return (
      <span className="tick" aria-label="Looks safe">
        <Icon name="check" size={16} stroke={2.6} />
      </span>
    );
  if (dec === "reported") return <span className="pill neutral">Reported</span>;
  if (dec === "safe") return <span className="pill neutral">Marked safe</span>;
  return <VerdictPill v={run.verdict} />;
}

function Checker({ focus }: { focus?: boolean }) {
  const d = useDemo();
  const [text, setText] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focus) {
      ta.current?.scrollIntoView({ block: "center" });
      ta.current?.focus();
    }
  }, [focus]);
  const last = d.checks[d.checks.length - 1];
  const run = last ? d.runs[last.id] : undefined;
  const v = run?.verdict;
  const submit = () => {
    if (!text.trim()) return;
    d.check(text);
    setText("");
  };
  return (
    <section className="card checker" aria-labelledby="chk-t">
      <h2 id="chk-t" className="sec-title" style={{ margin: "0 0 8px" }}>
        Check something yourself
      </h2>
      <div className="checker-row">
        <label htmlFor="chk" className="sr-only">
          Paste a text, email or link
        </label>
        <textarea
          id="chk"
          ref={ta}
          rows={1}
          placeholder="Paste a text, email or link"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button className="round-btn" aria-label="Upload a saved message (.txt or .eml)" onClick={() => file.current?.click()}>
          <Icon name="clip" size={19} />
        </button>
        <input
          ref={file}
          type="file"
          accept=".txt,.eml,text/plain,message/rfc822"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 200_000) return d.toast("That file is too big. Paste the message text instead.");
            const t = (await f.text()).slice(0, 4000);
            if (t.trim()) d.check(t);
          }}
        />
        <button className="round-btn go" aria-label="Check it" disabled={!text.trim()} onClick={submit}>
          <Icon name="up" size={19} stroke={2.4} />
        </button>
      </div>
      {last && (
        <button className={`last-check ${v ? v.risk : "checking"}`} onClick={() => d.go({ name: "timeline", id: last.id })}>
          <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Last check: &ldquo;{last.body.slice(0, 40)}&rdquo;</span>
            {v ? <VerdictPill v={v} /> : run?.error ? <span className="pill neutral">Failed</span> : <span className="spin" aria-label="Checking" />}
          </span>
          <span style={{ display: "block", marginTop: 4 }}>
            {v ? (
              <>
                <b>{v.headline}</b> {v.risk !== "safe" && v.verifyContact ? `${v.verifyContact.how}.` : ""}
              </>
            ) : run?.error ? (
              run.error
            ) : (
              "Checking privately…"
            )}
          </span>
        </button>
      )}
    </section>
  );
}

export function Home({ focusChecker }: { focusChecker?: boolean }) {
  const d = useDemo();
  const all = [...d.inbox].reverse();
  const pending = all.find((m) => {
    const v = d.runs[m.id]?.verdict;
    return v && v.risk !== "safe" && !d.decisions[m.id];
  });
  const checking = all.find((m) => d.runs[m.id] && !d.runs[m.id].verdict && !d.runs[m.id].error);
  const scams = d.inbox.filter((m) => d.runs[m.id]?.verdict?.risk === "scam").length;
  const checked = [...d.inbox, ...d.checks].filter((m) => d.runs[m.id]?.verdict).length;
  const tollSeen = d.seenTypes.some((t) => /toll/i.test(t));

  return (
    <div className="view">
      <div className="view-scroll">
        <div className="pad">
          <Header />
          <LineSwitcher />
          {pending ? (
            <div style={{ marginTop: 14 }}>
              <WarnCard msg={pending} where="home" />
            </div>
          ) : checking ? (
            <>
              <h1 className="hero">Breathe. We check the scary ones for you.</h1>
              <div className="checking-card" role="status">
                <span className="spin" aria-hidden /> Checking a new message from {senderName(checking)} privately…
              </div>
            </>
          ) : (
            <h1 className="hero">Breathe. We check the scary ones for you.</h1>
          )}
          <div className="card prot" style={{ marginTop: 12 }}>
            <span className="shield">
              <Icon name="shield" size={22} />
            </span>
            <div>
              <b>You&apos;re protected</b>
              <p className="tnum">
                {3 + scams} scams stopped this week · {41 + checked} checked privately
              </p>
            </div>
          </div>
          <div className="tools" role="group" aria-label="Scam Shield tools">
            <button className="tool" onClick={() => d.openSheet("labels")}>
              <Icon name="tag" size={20} />
              Scam
              <br />
              labels
            </button>
            <button className="tool" onClick={() => d.openSheet("blocklist")}>
              <Icon name="ban" size={20} />
              Block
              <br />
              list
            </button>
            <button className="tool" onClick={() => d.openSheet("report")}>
              <Icon name="flag" size={20} />
              Report
              <br />a scam
            </button>
            <button className="tool" onClick={() => d.go({ name: "activity" })}>
              <Icon name="list" size={20} />
              Activity
              <br />
              log
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            <Checker focus={focusChecker} />
          </div>
          <h2 className="sec-title">
            Messages <small>Second Look checks each one</small>
          </h2>
          <div className="card" style={{ padding: "0 12px" }}>
            {all.length ? (
              all.map((m) => (
                <button key={m.id} className="msg-row" onClick={() => d.go({ name: "thread", id: m.id })}>
                  <span className="avatar">
                    <Icon name={m.channel === "voicemail" ? "voicemail" : m.channel === "email" ? "mail" : "user"} size={17} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="who" style={{ display: "block" }}>
                      {senderName(m)}
                    </span>
                    <span className="prev" style={{ display: "block" }}>
                      {m.channel === "voicemail" ? "Voicemail · " : ""}
                      {m.body}
                    </span>
                  </span>
                  <RowStatus id={m.id} />
                </button>
              ))
            ) : (
              <p className="empty">No new messages. Press N (or &ldquo;Deliver a message&rdquo;) to send one to Maria&apos;s phone.</p>
            )}
          </div>
          <button className="teaser" onClick={() => d.go({ name: "practice" })}>
            <span className="row">
              Practice: {tollSeen ? "spot a fake toll text" : "spot the rush"}
              <span className="pill mag" style={{ marginLeft: "auto" }}>
                <Icon name="flame" size={13} /> {d.streak}-day streak
              </span>
              <Icon name="right" size={18} />
            </span>
            <span className="ex" style={{ display: "block" }}>
              Your parcel is on hold. Confirm your address <mark>within 1 hour</mark> or it goes back.
            </span>
          </button>
        </div>
      </div>
      <Nav />
    </div>
  );
}

export function FamilyLine({ id }: { id: Line }) {
  const d = useDemo();
  const f = FAMILY.find((x) => x.id === id);
  if (!f) return null;
  const done = f.recovery?.steps.filter((s) => s.done).length ?? 0;
  return (
    <div className="view">
      <div className="view-scroll">
        <div className="pad">
          <Header />
          <LineSwitcher />
          <div className="consent">
            <Icon name="lock" size={16} />
            <span>
              <b>{f.consent.split(". ")[0]}.</b> {f.consent.split(". ").slice(1).join(". ")}
            </span>
          </div>
          <div className="okay">
            <span className="ic">
              <Icon name="check" size={24} stroke={2.6} />
            </span>
            <div>
              <h1>{f.headline}</h1>
              <p>{f.sub}</p>
            </div>
          </div>
          {f.alerts.map((a) => (
            <article key={a.id} className="card alert-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <VerdictPill v={a} />
                <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{a.when}</span>
              </div>
              <h2>{a.title}</h2>
              <ul>
                {a.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </article>
          ))}
          {f.recovery && (
            <section className="card alert-card" aria-label={f.recovery.title}>
              <h2 style={{ marginTop: 0 }}>
                {f.recovery.title} · {done} of {f.recovery.steps.length} done
              </h2>
              <ul className="rec-list">
                {f.recovery.steps.map((s) => (
                  <li key={s.label}>
                    <span className={`c${s.done ? " on" : ""}`} aria-hidden>
                      {s.done && <Icon name="check" size={12} stroke={3} />}
                    </span>
                    <span>
                      <span className="sr-only">{s.done ? "Done: " : "To do: "}</span>
                      {s.label}
                      {s.detail && <small>{s.detail}</small>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => d.toast(`${f.action}: this would open your phone app. (Demo)`)}>
            <Icon name={f.id === "dad" ? "phone" : "msg"} size={18} /> {f.action}
          </button>
          <p className="fine" style={{ marginTop: 10, justifyContent: "center" }}>
            {f.checkedThisWeek} messages checked privately on {f.pronoun} line this week
          </p>
        </div>
      </div>
      <Nav />
    </div>
  );
}

export function Activity() {
  const d = useDemo();
  const all = [...d.inbox, ...d.checks].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const scams = all.filter((m) => d.runs[m.id]?.verdict?.risk === "scam").length;
  return (
    <div className="view">
      <div className="view-scroll">
        <div className="pad">
          <h1 className="hero" style={{ marginTop: 8 }}>
            Activity
          </h1>
          <p className="fine tnum" style={{ fontSize: 13 }}>
            {all.length} checked privately · {scams} scams caught · {d.reports} reports sent to 7726 · {d.blocked.length} blocked
          </p>
          <div className="card" style={{ padding: "0 12px", marginTop: 12 }}>
            {all.length ? (
              all.map((m) => (
                <button key={m.id} className="msg-row" onClick={() => d.go({ name: "timeline", id: m.id })}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="who" style={{ display: "block" }}>
                      {m.id.startsWith("check-") ? "You checked a pasted message" : senderName(m)}
                    </span>
                    <span className="prev" style={{ display: "block" }}>
                      {fmtTime(m.receivedAt)} · {d.runs[m.id]?.verdict?.scamType ?? (d.runs[m.id]?.error ? "Check failed" : "Checking…")}
                    </span>
                  </span>
                  <RowStatus id={m.id} />
                  <Icon name="right" size={16} />
                </button>
              ))
            ) : (
              <p className="empty">Nothing checked yet today.</p>
            )}
          </div>
          <h2 className="sec-title">Family alerts</h2>
          <div className="card" style={{ padding: "0 12px" }}>
            {FAMILY.flatMap((f) =>
              f.alerts.map((a) => (
                <button key={a.id} className="msg-row" onClick={() => d.setLine(f.id)}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span className="who" style={{ display: "block" }}>
                      {f.relation}: {a.title}
                    </span>
                    <span className="prev" style={{ display: "block" }}>
                      {a.when} · alert only, message stays private
                    </span>
                  </span>
                  <VerdictPill v={a} />
                </button>
              )),
            )}
          </div>
        </div>
      </div>
      <Nav />
    </div>
  );
}
