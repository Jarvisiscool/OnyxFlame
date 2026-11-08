"use client";

import { useEffect, useRef, useState } from "react";
import { useDemo, type Labels } from "./demo";
import { Icon, VerdictPill, senderName } from "./ui";

const TITLES = { labels: "Scam labels", blocklist: "Block list", report: "Report a scam", addMember: "Add a family member" } as const;

export function Sheet() {
  const d = useDemo();
  const h = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    h.current?.focus();
  }, [d.sheet]);
  if (!d.sheet) return null;
  const close = () => d.openSheet(null);
  const flagged = [...d.inbox, ...d.checks].filter((m) => {
    const v = d.runs[m.id]?.verdict;
    return v && v.risk !== "safe" && !d.decisions[m.id];
  });
  const toggle = (k: keyof Labels) => d.setLabels({ ...d.labels, [k]: !d.labels[k] });

  return (
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
        <div className="grab" aria-hidden />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 id="sheet-t" ref={h} tabIndex={-1} style={{ outline: "none" }}>
            {TITLES[d.sheet]}
          </h2>
          <button className="icon-btn" aria-label="Close" onClick={close}>
            <Icon name="x" size={20} />
          </button>
        </div>

        {d.sheet === "labels" && (
          <>
            <p className="lead">Second Look labels risky texts and calls before you open them. Everything is checked privately; personal details are removed first.</p>
            {(
              [
                ["texts", "Label likely-scam texts", "Warning on the notification and in the thread"],
                ["calls", "Label likely-scam calls and voicemails", "Shows \"Scam likely\" before you answer"],
                ["pause", "Pause risky links", "A 5-second calm pause before a scam link can open"],
              ] as const
            ).map(([k, t, sub]) => (
              <div className="set-row" key={k}>
                <div>
                  <b>{t}</b>
                  <small>{sub}</small>
                </div>
                <button className="switch" role="switch" aria-checked={d.labels[k]} aria-label={t} onClick={() => toggle(k)} />
              </div>
            ))}
            <div className="set-row" style={{ borderBottom: 0 }}>
              <div>
                <b>Safe messages</b>
                <small>Only a quiet tick. No pop-ups, no friction.</small>
              </div>
              <span className="tick" style={{ marginLeft: "auto" }}>
                <Icon name="check" size={16} stroke={2.6} />
              </span>
            </div>
          </>
        )}

        {d.sheet === "blocklist" && (
          <>
            <p className="lead">Blocked senders can&apos;t text or call this line. Reporting a scam blocks it automatically.</p>
            {d.blocked.length ? (
              d.blocked.map((b) => (
                <div className="set-row" key={b}>
                  <Icon name="ban" size={18} />
                  <b>{b}</b>
                  <button className="link-btn" style={{ marginLeft: "auto", fontSize: 13.5 }} onClick={() => d.unblock(b)}>
                    Unblock
                  </button>
                </div>
              ))
            ) : (
              <p className="empty">Nobody blocked yet.</p>
            )}
          </>
        )}

        {d.sheet === "report" && (
          <>
            <p className="lead">One tap sends the message to 7726 (SPAM) and blocks the sender. Reports help block it for every T-Mobile customer.</p>
            {flagged.length ? (
              flagged.map((m) => (
                <div className="set-row" key={m.id}>
                  <div style={{ minWidth: 0 }}>
                    <b>{senderName(m)}</b>
                    <small style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.runs[m.id]?.verdict?.scamType}</small>
                  </div>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                    <VerdictPill v={d.runs[m.id]!.verdict!} />
                    <button className="btn primary small" style={{ width: "auto", minHeight: 36 }} onClick={() => d.report(m.id)}>
                      Report
                    </button>
                  </span>
                </div>
              ))
            ) : (
              <p className="empty">Nothing flagged right now. {d.reports ? `You've sent ${d.reports} report${d.reports > 1 ? "s" : ""} today.` : ""}</p>
            )}
            <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => d.go({ name: "home", focusChecker: true })}>
              Something else? Paste it to check
            </button>
          </>
        )}
        {d.sheet === "addMember" && <AddMember />}
      </div>
    </div>
  );
}

const RELATIONS = ["Mom", "Dad", "Grandparent", "Partner", "Son", "Daughter", "Other"];

function AddMember() {
  const d = useDemo();
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("Grandparent");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const ageN = Number(age);
  const ok = name.trim().length > 0 && Number.isFinite(ageN) && ageN > 0 && ageN < 120;
  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (ok) d.addMember({ name, relation, age: ageN, phone: phone || undefined });
      }}
    >
      <p className="lead">They get Second Look on their own phone. You only see scam alerts and whether they&apos;re okay, never their messages.</p>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rosa" autoComplete="off" required />
      </label>
      <div className="form-row">
        <label>
          Relationship
          <select value={relation} onChange={(e) => setRelation(e.target.value)}>
            {RELATIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Age
          <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} inputMode="numeric" placeholder="72" required />
        </label>
      </div>
      <label>
        Their phone number <small>(demo: use a 555 number)</small>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="(469) 555-0142" autoComplete="off" />
      </label>
      <p className="note">
        <Icon name="lock" size={14} /> They&apos;ll get an invite and choose what to share. Adults can stop sharing any time.
      </p>
      <button className="btn primary" type="submit" disabled={!ok}>
        Send invite
      </button>
    </form>
  );
}
