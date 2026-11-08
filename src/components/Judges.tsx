"use client";

import { useEffect, useRef } from "react";
import results from "@/data/eval-results.json";
import { useDemo } from "./demo";
import { insights, redactionWords, summarize } from "./events";
import { Icon, VerdictPill, fmtMs, friendlyModel, gradeWords } from "./ui";

type Status = { live: boolean; fastModel: string; deepModel: string; recordings: number } | null;

const MODE: Record<string, { label: string; cls: string }> = {
  live: { label: "Live · Nemotron", cls: "" },
  replay: { label: "Replay of a live run", cls: "" },
  offline: { label: "Offline rules", cls: "offline" },
};

function Card({ title, mode, children }: { title: string; mode?: string; children: React.ReactNode }) {
  return (
    <div className="judges">
      <div className="for">
        <span>For judges</span>
        {mode && MODE[mode] && <span className={`mode ${MODE[mode].cls}`}>{MODE[mode].label}</span>}
      </div>
      <h2>{title}</h2>
      <div className="dash" />
      {children}
    </div>
  );
}

export function Judges({ id, status }: { id: string | null; status: Status }) {
  const d = useDemo();
  const idleMode = status ? (status.live ? "live" : "offline") : undefined;

  if (d.line !== "maria" && d.screen.name === "home") {
    const f = d.family.find((x) => x.id === d.line);
    if (!f) return null;
    return (
      <Card title={`What Maria can see on ${f.relation === "Dad" ? "Dad's" : `${f.name}'s`} line`}>
        <div className="rb">
          <div className="rl">
            <b>Shared with Maria</b>
          </div>
          <div className="checks">
            {["Scam alerts, verdict and confidence", "Why it was flagged, in plain words", "Recovery progress and \"is okay\" status"].map((t) => (
              <div key={t}>
                <Icon name="check" size={13} stroke={2.6} /> {t}
              </div>
            ))}
          </div>
        </div>
        <div className="rb">
          <div className="rl">
            <b>Never shared</b>
          </div>
          <div className="checks">
            {["Message text, voicemails and call audio", "Contacts, links and attachments", "Anything marked safe"].map((t) => (
              <div key={t}>
                <Icon name="lock" size={13} /> {t}
              </div>
            ))}
          </div>
        </div>
        <div className="dash" />
        <p className="priv">
          {f.relation} opted in to share alerts with Maria and can turn it off any time. These family alerts are pre-computed demo data; Maria&apos;s own messages are checked live.
        </p>
      </Card>
    );
  }

  if (d.screen.name === "practice") {
    const li = d.lessonInfo;
    return (
      <Card title="How this lesson was made" mode={li?.source}>
        <div className="rb">
          <div className="rl">
            <b>Writer</b>
            <span className="v">{li?.source === "live" ? "Nemotron 3.5 Super" : "Offline lesson"}</span>
          </div>
          <div className="rs">{li?.source === "live" ? "Thinking off, JSON validated strictly; any malformed lesson falls back to a vetted one." : "No API key or the model's lesson failed validation, so a vetted synthetic lesson is used."}</div>
        </div>
        <div className="rb">
          <div className="rl">
            <b>Personalized to</b>
          </div>
          <div className="rs">{li?.personalized.length ? li.personalized.join(", ") : "General scam patterns"}</div>
        </div>
        <div className="rb">
          <div className="rl">
            <b>Format</b>
          </div>
          <div className="rs">Short lesson, 5 questions (multiple choice and scam-or-legit) across text, voicemail and email, tells highlighted, then flashcards.</div>
        </div>
        <div className="dash" />
        <p className="priv">All examples are synthetic: fictional 555 numbers, invented domains, no real logos.</p>
      </Card>
    );
  }

  const msg = id ? d.find(id) : undefined;
  const run = id ? d.runs[id] : undefined;
  if (!msg || !run) {
    return (
      <Card title="How it was checked" mode={idleMode}>
        <p className="rs" style={{ fontSize: 13.5 }}>
          Deliver a message (press <kbd>N</kbd>) to watch it get checked: privacy filter, quick check with Nemotron 3.5 Lightning, an investigation with Nemotron 3.5 Super and real tools, safety rules, then a verdict.
        </p>
      </Card>
    );
  }

  const s = summarize(run.events);
  const v = s.verdict;
  const ins = insights(msg, s);
  const fast = s.route?.decision === "fast_path";
  const g = v ? gradeWords(v) : undefined;
  const isLink = d.screen.name === "pause";

  return (
    <Card title={isLink ? "How this link was checked" : "How it was checked"} mode={run.mode ?? idleMode}>
      <div className={`rb${s.redaction ? "" : " pending"}`}>
        <div className="rl">
          <b>Privacy filter</b>
          <span className="v">{s.redaction ? "Done" : "…"}</span>
        </div>
        <div className="rs">{s.redaction ? redactionWords(s) : "Removing names, codes and card numbers"}</div>
      </div>
      <div className={`rb${s.triage ? "" : " pending"}`}>
        <div className="rl">
          <b>Quick check</b>
          <span className="v">{fmtMs(s.triage?.ms)}</span>
        </div>
        <div className="rs">
          {friendlyModel(s.triage?.model, "fast")}
          {s.triage ? ` · ${s.triage.reason.replace(/\.$/, "")}` : ""}
        </div>
      </div>
      <div className={`rb${s.route && (s.toolResults.length || fast) ? "" : " pending"}`}>
        <div className="rl">
          <b>{fast ? "Investigation skipped" : `Investigation${s.toolResults.length ? `, ${s.toolResults.length} checks` : ""}`}</b>
          <span className="v">{fast ? "" : fmtMs(s.investigateMs || undefined)}</span>
        </div>
        <div className="rs">{fast ? "The quick check was confident, so no interruption" : `${friendlyModel(s.deepModel ?? s.start?.models.deep, "deep")}${s.plan?.source === "model" ? " · planned its own checks" : ""}`}</div>
        {!fast && ins.findings.length > 0 && (
          <div className="checks">
            {ins.findings.map((f) => (
              <div key={f}>
                <Icon name="check" size={13} stroke={2.6} /> {f}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={`rb${s.guardrail ? "" : " pending"}`}>
        <div className="rl">
          <b>Safety rules</b>
          <span className={`v ${s.guardrail?.changed ? "chg" : "ok"}`}>{s.guardrail ? (s.guardrail.changed ? "Adjusted" : "Passed") : ""}</span>
        </div>
        <div className="rs">{s.guardrail?.changed ? (s.guardrail.note ?? "Changed the model's call") : "Verdict and next steps double-checked"}</div>
      </div>
      <div className="dash" />
      {v && g ? (
        <>
          <div className="rl" style={{ alignItems: "center" }}>
            <b style={{ fontSize: 15 }}>Verdict</b>
            <VerdictPill v={v} />
          </div>
          <div className="rl" style={{ marginTop: 6 }}>
            <span className="rs">Scam type</span>
            <span className="v">{v.scamType}</span>
          </div>
          <div className="rl">
            <span className="rs">Total time</span>
            <span className="v">{fmtMs(s.done?.totalMs)}</span>
          </div>
          <div className="rl">
            <span className="rs">Model calls · tools</span>
            <span className="v">
              {s.llmCalls} · {s.toolCalls}
            </span>
          </div>
          {s.tokens > 0 && (
            <div className="rl">
              <span className="rs">Tokens</span>
              <span className="v">{s.tokens.toLocaleString("en-US")}</span>
            </div>
          )}
          {s.done?.metrics?.fallback && <p className="rs">The rules finished this run with the evidence gathered (model too slow).</p>}
        </>
      ) : run.error ? (
        <div>
          <p className="rs" role="alert">
            {run.error}
          </p>
          <button className="link-btn" style={{ fontSize: 13 }} onClick={() => d.retry(msg.id)}>
            Try again
          </button>
        </div>
      ) : (
        <div className="rl">
          <b>Verdict</b>
          <span className="spin" aria-label="Working" />
        </div>
      )}
      <p className="priv">Checked privately. Personal details were removed before any model saw the message.</p>
    </Card>
  );
}

type M = { n: number; accuracy: number; recall: number; precision: number; falsePositiveRate: number } | null | undefined;
const pct = (x: number | undefined) => (x == null ? "–" : `${Math.round(x * 100)}%`);

export function HowItWorks({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const r = results as unknown as { rules: M; nemotron: M; holdout: { rules: M; nemotron: M }; redteam: { rules: M; nemotron: M } };
  const sets: { name: string; note: string; rules: M; nemo: M }[] = [
    { name: "Red-team (hard, unseen)", note: "the honest number", rules: r.redteam?.rules, nemo: r.redteam?.nemotron },
    { name: "Held-out", note: "written with the rules", rules: r.holdout?.rules, nemo: r.holdout?.nemotron },
    { name: "Dev set", note: "used while building", rules: r.rules, nemo: r.nemotron },
  ];
  const anyNemo = sets.some((s) => s.nemo);
  return (
    <div className="modal-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="how-t">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 id="how-t">How Second Look works</h2>
          <button ref={close} className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="flow">
          <div>
            <b>1 · Privacy filter</b>Names, codes and card numbers removed on the phone first.
          </div>
          <div>
            <b>2 · Quick check</b>Nemotron 3.5 Lightning triages in under a second.
          </div>
          <div>
            <b>3 · Investigation</b>Nemotron 3.5 Super plans and calls tools: link owner, domain age, sender, reports, official contact.
          </div>
          <div>
            <b>4 · Safety rules</b>Deterministic checks can raise or correct the model&apos;s call.
          </div>
          <div>
            <b>5 · One action</b>Graded verdict, named pattern, one primary move. Safe = a quiet tick.
          </div>
        </div>
        <h3>Results</h3>
        <p>
          The red-team set is the honest number: hard scams we didn&apos;t tune for. The rules alone miss many of them, and that gap is why the Nemotron agent exists.
          {anyNemo ? "" : " The Nemotron agent's scores weren't recorded in this build, so only the rules baseline is shown. We don't quote numbers we didn't measure."}
        </p>
        <table className="metrics">
          <thead>
            <tr>
              <th scope="col">Set</th>
              <th scope="col">Engine</th>
              <th scope="col">Messages</th>
              <th scope="col">Accuracy</th>
              <th scope="col">Scams caught</th>
              <th scope="col">False alarms</th>
            </tr>
          </thead>
          <tbody>
            {sets.flatMap((s) =>
              [
                ["Rules only", s.rules],
                ["Nemotron agent", s.nemo],
              ]
                .filter(([, m]) => m)
                .map(([eng, m]) => {
                  const mm = m as NonNullable<M>;
                  return (
                    <tr key={s.name + eng}>
                      <td>
                        <b>{s.name}</b>
                        <br />
                        <small style={{ color: "var(--ink-3)" }}>{s.note}</small>
                      </td>
                      <td>{eng as string}</td>
                      <td>{mm.n}</td>
                      <td>{pct(mm.accuracy)}</td>
                      <td>{pct(mm.recall)}</td>
                      <td>{pct(mm.falsePositiveRate)}</td>
                    </tr>
                  );
                }),
            )}
          </tbody>
        </table>
        <p style={{ marginTop: 8, fontSize: 12.5 }}>All test messages are synthetic. Dev and held-out scores are 100% because those sets were written alongside the rules; don&apos;t read them as real-world accuracy.</p>
        <h3>Privacy and family</h3>
        <ul style={{ paddingLeft: 18, marginTop: 4 }}>
          <li>Every check runs on redacted text. Safe messages get a quiet tick only.</li>
          <li>Family lines share alerts and recovery status only, never message contents, and only with consent.</li>
          <li>Live runs can be recorded and replayed so the demo never depends on conference Wi-Fi.</li>
        </ul>
      </div>
    </div>
  );
}
