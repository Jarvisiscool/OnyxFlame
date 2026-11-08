"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lesson as LessonT, LessonQuestion } from "@/lib/types";
import { useDemo } from "./demo";
import { Highlight, Icon, missingTells } from "./ui";

type Phase = "loading" | "intro" | "q" | "cards" | "done";

function QuestionMessage({ q, reveal }: { q: LessonQuestion; reveal: boolean }) {
  if (q.channel === "email") {
    const name = q.from.replace(/\s*<.*>\s*$/, "") || q.from;
    const addr = q.from.match(/<([^>]+)>/)?.[1];
    return (
      <div className={`email ${q.look ?? "gmail"}`}>
        <div className="bar">
          <Icon name="mail" size={14} /> {q.look === "outlook" ? "Outlook-style inbox" : "Gmail-style inbox"}
        </div>
        <div className="hd">
          <span className="avatar">{name.charAt(0).toUpperCase()}</span>
          <div style={{ minWidth: 0 }}>
            <div className="snd">{name}</div>
            {addr && (
              <div className="addr">
                <Highlight text={`<${addr}>`} tells={q.tells} on={reveal} />
              </div>
            )}
          </div>
        </div>
        {q.subject && (
          <div className="subj">
            <Highlight text={q.subject} tells={q.tells} on={reveal} />
          </div>
        )}
        <div className="bd">
          <Highlight text={q.body} tells={q.tells} on={reveal} />
        </div>
      </div>
    );
  }
  if (q.channel === "voicemail") {
    return (
      <div className="vm">
        <div className="bar">
          <Icon name="voicemail" size={18} /> Voicemail from {q.from}
          <span className="wave" aria-hidden />
        </div>
        <p>
          <Highlight text={q.body} tells={q.tells} on={reveal} />
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="sms-from">
        Text from <Highlight text={q.from} tells={q.tells} on={reveal} />
      </div>
      <div className="sms-q">
        <Highlight text={q.body} tells={q.tells} on={reveal} />
      </div>
    </>
  );
}

export function Lesson() {
  const d = useDemo();
  const [lesson, setLesson] = useState<LessonT | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [card, setCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState(false);
  const [seen] = useState(() => d.seenTypes);
  const { setLessonInfo, finishLesson } = d;
  const heading = useRef<HTMLHeadingElement>(null);

  const fetchLesson = useCallback(() => {
    fetch("/api/lesson", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seenTypes: seen }) })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((l: LessonT) => {
        setLesson(l);
        setPhase("intro");
        setLessonInfo({ source: l.source ?? "offline", title: l.lesson.title, personalized: seen.slice(0, 3) });
      })
      .catch(() => setError(true));
  }, [seen, setLessonInfo]);

  const load = () => {
    setPhase("loading");
    setError(false);
    setIdx(0);
    setPicked(null);
    setResults([]);
    setCard(0);
    setFlipped(false);
    fetchLesson();
  };

  useEffect(() => {
    fetchLesson();
    return () => setLessonInfo(null);
  }, [fetchLesson, setLessonInfo]);

  useEffect(() => {
    heading.current?.focus();
  }, [phase, idx]);

  const total = lesson?.questions.length ?? 5;
  const progress = phase === "intro" ? 0.05 : phase === "q" ? (idx + (picked ? 1 : 0)) / (total + 1) : phase === "cards" ? (total + 0.5) / (total + 1) : phase === "done" ? 1 : 0;
  const q = lesson?.questions[idx];
  const score = results.filter(Boolean).length;

  const answer = (a: string) => {
    if (!q || picked) return;
    setPicked(a);
    setResults((r) => [...r, a === q.answer]);
  };
  const next = () => {
    if (!lesson) return;
    setPicked(null);
    if (idx + 1 < lesson.questions.length) setIdx(idx + 1);
    else setPhase("cards");
  };

  return (
    <div className="view">
      <div className="lesson-head">
        <button className="icon-btn" aria-label="Close practice" onClick={() => d.go({ name: "home" })}>
          <Icon name="x" size={20} />
        </button>
        <div className="progress" role="progressbar" aria-label="Lesson progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <i style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="pill mag">
          <Icon name="flame" size={13} /> {d.streak}
        </span>
      </div>
      <div className="view-scroll">
        <div className="pad">
          {phase === "loading" &&
            (error ? (
              <div className="checking-card" role="alert" style={{ marginTop: 20, justifyContent: "space-between" }}>
                Couldn&apos;t load a lesson.
                <button className="link-btn" onClick={load}>
                  Try again
                </button>
              </div>
            ) : (
              <div className="checking-card" role="status" style={{ marginTop: 20 }}>
                <span className="spin" aria-hidden /> Nemotron is writing a lesson for the scams your family got…
              </div>
            ))}

          {phase === "intro" && lesson && (
            <>
              <div className="q-label" style={{ marginTop: 6 }}>
                <Icon name="target" size={14} /> Lesson · {lesson.source === "live" ? "written by Nemotron for you" : "offline lesson"}
              </div>
              <h1 ref={heading} tabIndex={-1} className="lesson-title" style={{ outline: "none" }}>
                {lesson.lesson.title}
              </h1>
              {seen.length > 0 && <p className="fine" style={{ marginTop: 6, fontSize: 13 }}>Picked because your family got: {seen.slice(0, 2).join(", ").toLowerCase()}.</p>}
              <ol className="points">
                {lesson.lesson.points.map((p, i) => (
                  <li key={i}>
                    <span>{i + 1}</span>
                    {p}
                  </li>
                ))}
              </ol>
              <div className="sms-from">Example</div>
              <div className="sms-q">{lesson.lesson.example}</div>
              <button className="btn primary" style={{ marginTop: 16 }} onClick={() => setPhase("q")}>
                Start: {total} questions
              </button>
            </>
          )}

          {phase === "q" && q && (
            <>
              <div className="q-label" style={{ marginTop: 6 }}>
                Question {idx + 1} of {total} · {q.channel === "sms" ? "Text" : q.channel === "email" ? "Email" : "Voicemail"}
              </div>
              <h1 ref={heading} tabIndex={-1} className="q-prompt" style={{ outline: "none" }}>
                {q.type === "mcq" ? q.prompt : "Scam or legit?"}
              </h1>
              <QuestionMessage q={q} reveal={Boolean(picked)} />
              {q.type === "scam_or_legit" ? (
                <div className="sol">
                  {(["scam", "legit"] as const).map((a) => (
                    <button
                      key={a}
                      className={`opt${picked && a === q.answer ? " right" : ""}${picked === a && a !== q.answer ? " wrong" : ""}`}
                      disabled={Boolean(picked)}
                      aria-pressed={picked === a}
                      onClick={() => answer(a)}
                    >
                      {a === "scam" ? "Scam" : "Legit"}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="opts">
                  {q.options?.map((o) => (
                    <button
                      key={o}
                      className={`opt${picked && o === q.answer ? " right" : ""}${picked === o && o !== q.answer ? " wrong" : ""}`}
                      disabled={Boolean(picked)}
                      aria-pressed={picked === o}
                      onClick={() => answer(o)}
                    >
                      {picked && o === q.answer && <Icon name="check" size={16} stroke={2.6} />}
                      {o}
                    </button>
                  ))}
                </div>
              )}
              {picked && (
                <div className={`feedback ${picked === q.answer ? "good" : "bad"}`} role="status">
                  <b>{picked === q.answer ? "Right!" : `Not quite. It's ${q.type === "scam_or_legit" ? (q.answer === "scam" ? "a scam" : "legit") : "the highlighted answer"}.`}</b>
                  {q.explanation}
                  {missingTells(`${q.from} ${q.subject ?? ""} ${q.body}`, q.tells).length > 0 && (
                    <div className="chips">
                      {missingTells(`${q.from} ${q.subject ?? ""} ${q.body}`, q.tells).map((t) => (
                        <span key={t} className="pill neutral">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ marginTop: 6, fontSize: 12.5, color: "var(--ink-2)" }}>The tells are highlighted in the message.</div>
                </div>
              )}
              {picked && (
                <button className="btn primary" style={{ marginTop: 12 }} onClick={next}>
                  {idx + 1 < total ? "Next question" : "Review the tells"}
                </button>
              )}
            </>
          )}

          {phase === "cards" && lesson && (
            <>
              <h1 ref={heading} tabIndex={-1} className="q-prompt" style={{ outline: "none", marginTop: 10 }}>
                Review the tells
              </h1>
              <p className="fine" style={{ fontSize: 13, marginTop: 4 }}>
                Card {card + 1} of {lesson.flashcards.length}. Tap to flip.
              </p>
              <div className="flash">
                <button className={`flash-in${flipped ? " flipped" : ""}`} onClick={() => setFlipped((f) => !f)} aria-label={flipped ? lesson.flashcards[card].back : `${lesson.flashcards[card].front}. Tap to see what it means.`}>
                  <span className="flash-face">
                    <small>Tell</small>
                    {lesson.flashcards[card].front}
                  </span>
                  <span className="flash-face back">
                    <small>What it means</small>
                    {lesson.flashcards[card].back}
                  </span>
                </button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  className="btn secondary"
                  disabled={card === 0}
                  onClick={() => {
                    setCard(card - 1);
                    setFlipped(false);
                  }}
                >
                  Back
                </button>
                {card + 1 < lesson.flashcards.length ? (
                  <button
                    className="btn primary"
                    onClick={() => {
                      setCard(card + 1);
                      setFlipped(false);
                    }}
                  >
                    Next card
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    onClick={() => {
                      finishLesson();
                      setPhase("done");
                    }}
                  >
                    Finish
                  </button>
                )}
              </div>
            </>
          )}

          {phase === "done" && lesson && (
            <div className="score">
              <h1 ref={heading} tabIndex={-1} className="q-prompt" style={{ outline: "none" }}>
                Lesson complete
              </h1>
              <div className="big tnum">
                {score}/{total}
              </div>
              <p style={{ fontWeight: 700 }}>{score === total ? "Perfect. You'd spot this one anywhere." : score >= 3 ? "Nice work. Review the tells you missed." : "Good start. The tells will stick with practice."}</p>
              <p className="pill mag" style={{ marginTop: 12, fontSize: 14 }}>
                <Icon name="flame" size={15} /> {d.streak}-day streak
              </p>
              <p className="fine" style={{ justifyContent: "center", marginTop: 12 }}>
                Covers texts, voicemail and email, so it works on every device you use.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 16 }}>
                <button className="btn primary" onClick={() => d.go({ name: "home" })}>
                  Back home
                </button>
                <button className="btn secondary" onClick={load}>
                  Another lesson
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
