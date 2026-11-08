"use client";

import { useEffect, useRef } from "react";
import type { WhatHappened } from "@/lib/types";
import { useDemo } from "./demo";
import { insights, redactionWords, summarize } from "./events";
import { Icon, RISK_TITLE, fmtTime, friendlyModel, gradeWords, senderName, splitLinks } from "./ui";

const HAPPENED: { id: WhatHappened | "nothing"; label: string }[] = [
  { id: "nothing", label: "Nothing, I didn't tap" },
  { id: "clicked_link", label: "I tapped the link" },
  { id: "entered_info", label: "I typed my info" },
  { id: "sent_money", label: "I sent money" },
  { id: "shared_code", label: "I shared a code" },
  { id: "called_back", label: "I called back" },
];

type NodeState = "done" | "active" | "pending" | "alert" | "safe-n";

function Node({ state, children, label }: { state: NodeState; children: React.ReactNode; label?: string }) {
  return (
    <li className={`tl-node ${state}`} aria-label={label}>
      <span className="tl-dot" aria-hidden>
        {(state === "done" || state === "safe-n") && <Icon name="check" size={13} stroke={3} />}
        {state === "alert" && <b style={{ fontSize: 12 }}>!</b>}
      </span>
      {children}
    </li>
  );
}

export function Timeline({ id, recover }: { id: string; recover?: boolean }) {
  const d = useDemo();
  const msg = d.find(id);
  const recRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (recover) recRef.current?.scrollIntoView({ block: "start" });
  }, [recover]);
  if (!msg) return null;
  const run = d.runs[id];
  const s = summarize(run?.events ?? []);
  const v = s.verdict;
  const ins = insights(msg, s);
  const dec = d.decisions[id];
  const rec = d.recovery[id];
  const risky = v && v.risk !== "safe";
  const pasted = id.startsWith("check-");
  const fast = s.route?.decision === "fast_path";
  const g = v ? gradeWords(v) : undefined;
  const doneSteps = rec?.checked.filter(Boolean).length ?? 0;
  const firstOpen = rec?.plan ? rec.checked.findIndex((c) => !c) : -1;

  return (
    <div className="view">
      <div className="thread-head">
        <button className="icon-btn" aria-label="Back" onClick={() => d.go(pasted ? { name: "home" } : { name: "thread", id })}>
          <Icon name="left" size={22} />
        </button>
        <div>
          <div className="nm">{v ? v.scamType : "Checking…"}</div>
          <div className="sub">Protection timeline</div>
        </div>
      </div>
      <div className="view-scroll">
        <div className="pad" style={{ paddingTop: 10 }}>
          <div className={`tl-card ${v?.risk ?? ""}`}>
            <div className={`top${v ? "" : " checking"}`}>
              <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                {v ? <Icon name={v.risk === "safe" ? "check" : "alert"} size={14} stroke={2.4} /> : <span className="spin" aria-hidden />}
                {v ? RISK_TITLE[v.risk] : "Checking privately"}
              </span>
              {v && <span>{v.scamType}</span>}
            </div>
            <div className="snd">
              <span className="avatar" style={{ width: 32, height: 32 }}>
                <Icon name={msg.channel === "voicemail" ? "voicemail" : msg.channel === "email" ? "mail" : "msg"} size={15} />
              </span>
              <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                {pasted ? "You pasted this" : senderName(msg)}
                <small>{pasted ? "Check something" : msg.displayName ? msg.from : "Unknown sender"}</small>
              </span>
              <span style={{ fontSize: 12.5, color: "var(--ink-3)", fontWeight: 600 }}>{fmtTime(msg.receivedAt)}</span>
            </div>
            <div className="body">
              {splitLinks(msg.body).map((p, i) => (p.link && risky ? <s key={i}>{p.text}</s> : <span key={i}>{p.text}</span>))}
              {risky && splitLinks(msg.body).some((p) => p.link) && (
                <div className="paused">
                  <Icon name="lock" size={13} /> Link paused so it can&apos;t open by accident
                </div>
              )}
            </div>
          </div>

          <ol className="tl">
            <Node state="done">
              <div className="tl-row">
                <b>{pasted ? "Pasted" : "Received"}</b>
                <span className="meta">{pasted ? "by you" : risky ? "warned on lock screen" : "as a notification"}</span>
                <span className="r">{fmtTime(msg.receivedAt)}</span>
              </div>
            </Node>
            <Node state={s.redaction ? "done" : "active"}>
              <div className="tl-row">
                <b>Checked privately</b>
                <span className="meta">{s.redaction ? redactionWords(s).toLowerCase() : "removing personal details…"}</span>
              </div>
            </Node>
            {fast ? (
              <Node state="done">
                <div className="tl-row">
                  <b>Quick check</b>
                  <span className="meta">{friendlyModel(s.triage?.model, "fast")} was sure</span>
                </div>
                <div className="tl-sub">No deeper investigation needed, so no interruption.</div>
              </Node>
            ) : (
              <Node state={v ? "done" : s.route ? "active" : "pending"}>
                <div className="tl-row">
                  <b>Investigated</b>
                  {s.toolResults.length > 0 && <span className="r">{s.toolResults.length} checks</span>}
                </div>
                <div className="tl-sub">{ins.findings.length ? ins.findings.slice(0, 2).join(" · ") : s.route ? `${friendlyModel(s.deepModel, "deep")} is looking into it…` : "Waiting for the quick check"}</div>
                {ins.findings.length > 2 && (
                  <details>
                    <summary>See all {ins.findings.length} findings</summary>
                    <div className="findings">
                      {ins.findings.map((f) => (
                        <div key={f}>
                          <Icon name="check" size={13} stroke={2.6} /> {f}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </Node>
            )}
            <Node state={!v ? (run?.error ? "alert" : "pending") : v.risk === "safe" ? "safe-n" : "alert"}>
              {v && g ? (
                <>
                  <div className={`tl-verdict ${v.risk}`}>
                    Verdict: {g.label} · {v.risk === "suspicious" ? "be careful" : g.grade} ({g.pct}%)
                  </div>
                  <div className="tl-sub">{v.explanation}</div>
                  {s.guardrail?.changed && <div className="tl-sub">Safety rules adjusted the call{s.guardrail.note ? `: ${s.guardrail.note}` : "."}</div>}
                  {v.uncertainty && <div className="tl-sub">Not certain about: {v.uncertainty}</div>}
                </>
              ) : run?.error ? (
                <div className="tl-row" style={{ flexWrap: "wrap" }}>
                  <b>Couldn&apos;t finish the check</b>
                  <button className="link-btn" onClick={() => d.retry(id)}>
                    Try again
                  </button>
                  <div className="tl-sub" style={{ width: "100%" }}>
                    {run.error}
                  </div>
                </div>
              ) : (
                <div className="tl-row">
                  <b>Verdict</b>
                  <span className="meta">on its way</span>
                </div>
              )}
            </Node>

            {v?.risk === "safe" && (
              <Node state="safe-n">
                <div className="tl-row">
                  <b>Nothing to do</b>
                  <span className="meta">just a quiet tick, no interruption</span>
                </div>
              </Node>
            )}

            {risky &&
              (dec ? (
                <Node state="done">
                  <div className="tl-row">
                    <b>Your move</b>
                    <span className="meta">{dec === "reported" ? "reported and blocked" : "you marked it not a scam"}</span>
                  </div>
                  {dec === "reported" && <div className="tl-sub">Sent to 7726. Your report helps block this sender for everyone.</div>}
                </Node>
              ) : (
                <Node state="active">
                  <div className="move">
                    <h3>Your move</h3>
                    <p>{ins.rush ?? "No rush. Nothing here needs an answer right now."}</p>
                    <div className="acts">
                      <button className="btn primary small" onClick={() => d.report(id)}>
                        Report &amp; block
                      </button>
                      <button className="btn secondary small" onClick={() => d.markSafe(id)}>
                        Not a scam
                      </button>
                    </div>
                    <p style={{ marginTop: 8 }}>
                      One tap. Your report helps protect others.
                      {v.verifyContact ? (
                        <>
                          {" "}
                          Worried? <b>{v.verifyContact.how}.</b>
                        </>
                      ) : null}
                    </p>
                  </div>
                </Node>
              ))}

            {risky && (
              <li ref={recRef} className={`tl-node ${rec?.plan && doneSteps === rec.plan.steps.length ? "done" : rec ? "done" : "active"}`} style={{ scrollMarginTop: 8 }}>
                <span className="tl-dot" aria-hidden>
                  {rec && <Icon name="check" size={13} stroke={3} />}
                </span>
                <div className="tl-row">
                  <b>Did anything happen?</b>
                  {rec?.plan && (
                    <span className="r tnum">
                      {doneSteps} of {rec.plan.steps.length} done
                    </span>
                  )}
                </div>
                <div className="tl-sub">It&apos;s okay if you tapped. Tell us and we&apos;ll do the rest together.</div>
                <div className="chips" role="group" aria-label="What happened">
                  {HAPPENED.map((h) => (
                    <button
                      key={h.id}
                      className="chip"
                      aria-pressed={h.id === "nothing" ? Boolean(rec?.none) : rec?.what === h.id}
                      onClick={() => d.recover(id, h.id)}
                    >
                      {h.label}
                    </button>
                  ))}
                </div>
                {rec?.none && <div className="tl-sub" style={{ marginTop: 8, fontWeight: 700 }}>Good. Nothing else to do: the link never opened.</div>}
                {rec?.loading && (
                  <div className="checking-card" role="status" style={{ marginTop: 8 }}>
                    <span className="spin" aria-hidden /> Making your recovery plan…
                  </div>
                )}
                {rec?.plan && (
                  <div style={{ marginTop: 8 }} aria-live="polite">
                    <div className="tl-sub" style={{ fontWeight: 700 }}>
                      <span className={`pill ${rec.plan.urgency === "moderate" ? "suspicious" : "scam"}`} style={{ marginRight: 6 }}>
                        {rec.plan.urgency === "critical" ? "Act now" : rec.plan.urgency === "high" ? "Today" : "Low risk"}
                      </span>
                      {rec.plan.summary}
                    </div>
                    {rec.plan.steps.map((st, i) => (
                      <button
                        key={i}
                        role="checkbox"
                        aria-checked={Boolean(rec.checked[i])}
                        className={`step${i === firstOpen ? " first" : ""}`}
                        onClick={() => d.toggleStep(id, i)}
                      >
                        <span className="box" aria-hidden>
                          {rec.checked[i] && <Icon name="check" size={13} stroke={3} />}
                        </span>
                        <span>
                          {i === firstOpen && <span className="when">Do this first · </span>}
                          {i !== firstOpen && <span className="when">{st.when} · </span>}
                          <span className="t">{st.title}</span>
                          <span className="d" style={{ display: "block" }}>
                            {st.detail}
                          </span>
                        </span>
                      </button>
                    ))}
                    {rec.plan.reportDraft && (
                      <details style={{ marginTop: 8 }}>
                        <summary>Your FTC report, already drafted</summary>
                        <div className="draft">{rec.plan.reportDraft}</div>
                        <button
                          className="link-btn"
                          style={{ fontSize: 13, marginTop: 6 }}
                          onClick={() => {
                            navigator.clipboard?.writeText(rec.plan!.reportDraft).catch(() => {});
                            d.toast("Report copied. Paste it at reportfraud.ftc.gov.");
                          }}
                        >
                          Copy report
                        </button>
                      </details>
                    )}
                    <div className="fine" style={{ marginTop: 6 }}>
                      {rec.plan.source === "live" ? "Plan written by Nemotron 3.5 Super for what happened." : "Plan from Second Look's recovery playbook."}
                    </div>
                  </div>
                )}
              </li>
            )}

            {risky && (
              <Node state="pending">
                <div className="followup">
                  <span className="avatar" style={{ background: "#fff", color: "var(--mag-dark)" }}>
                    <Icon name="bell" size={17} />
                  </span>
                  <span>
                    <b>{rec?.plan && doneSteps === rec.plan.steps.length ? "All done. " : ""}We&apos;ll check in tomorrow</b>
                    {rec?.what === "sent_money" || rec?.what === "entered_info" ? " about any new charges," : ","} and keep watching this sender for 30 days.
                  </span>
                </div>
              </Node>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}
