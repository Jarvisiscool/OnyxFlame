"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDemo } from "./demo";
import { Nav } from "./Home";
import { Icon, senderName } from "./ui";

interface Turn {
  role: "user" | "assistant";
  text: string;
  links?: { title: string; url: string }[];
  followups?: string[];
  offTopic?: boolean;
  source?: "live" | "offline";
}

const STARTERS = ["How do I spot a fake text?", "I already clicked a link. What now?", "How do I protect my parents from scams?"];

/** "Ask Second Look": a Nemotron assistant that only answers questions about scams, fraud and prevention. */
export function Ask({ about }: { about?: string }) {
  const d = useDemo();
  const focus = about ? d.find(about) : undefined;
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  // What the assistant may look at: the messages Second Look checked (redacted again on the server).
  const context = useMemo(() => {
    const all = [...d.inbox, ...d.checks].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    const ordered = focus ? [focus, ...all.filter((m) => m.id !== focus.id)] : all;
    return ordered.slice(0, 10).map((m) => {
      const v = d.runs[m.id]?.verdict;
      return { from: senderName(m), body: m.body, verdict: v ? `${v.risk} ${Math.round(v.confidence * 100)}% · ${v.scamType}` : undefined };
    });
  }, [d.inbox, d.checks, d.runs, focus]);

  const starters = focus ? [`Is the message from ${senderName(focus)} a scam?`, "What should I do about it?", STARTERS[0]] : STARTERS;

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, busy]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setText("");
    const history = turns.map((t) => ({ role: t.role, content: t.text }));
    setTurns((ts) => [...ts, { role: "user", text: question }]);
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history, context }),
      });
      const j = await res.json();
      setTurns((ts) => [
        ...ts,
        res.ok
          ? { role: "assistant", text: j.answer, links: j.links, followups: j.followups, offTopic: j.scope === "off_topic", source: j.source }
          : { role: "assistant", text: "I couldn't answer that just now. Try again in a moment." },
      ]);
    } catch {
      setTurns((ts) => [...ts, { role: "assistant", text: "I couldn't reach Second Look. Check your connection and try again." }]);
    }
    setBusy(false);
  }

  const last = [...turns].reverse().find((t) => t.role === "assistant");
  const chips = turns.length === 0 ? starters : (last?.followups ?? []);

  return (
    <div className="view ask">
      <div className="view-scroll">
        <div className="pad">
          <h1 className="hero" style={{ marginTop: 8 }}>
            Ask about scams
          </h1>
          <p className="fine" style={{ fontSize: 13 }}>
            Answers questions about scams, fraud and staying safe, including the messages Second Look checked for you. Nothing else.
          </p>
          {focus && (
            <div className="ask-about">
              <Icon name="msg" size={15} /> About the message from <b>{senderName(focus)}</b>
            </div>
          )}

          <div className="ask-log" aria-live="polite">
            {turns.map((t, i) => (
              <div key={i} className={`bubble ${t.role}${t.offTopic ? " off" : ""}`}>
                <p>{t.text}</p>
                {t.links && t.links.length > 0 && (
                  <ul className="ask-links">
                    {t.links.map((l) => (
                      <li key={l.url}>
                        <a href={l.url} target="_blank" rel="noopener noreferrer">
                          <Icon name="globe" size={14} /> {l.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                {t.role === "assistant" && t.source && (
                  <small className="ask-src">{t.offTopic ? "Outside what I can help with" : t.source === "live" ? "Nemotron 3.5 Super · links from trusted sources only" : "Offline answer · trusted sources"}</small>
                )}
              </div>
            ))}
            {busy && <div className="bubble assistant typing">Checking…</div>}
            <div ref={end} />
          </div>

          {chips.length > 0 && !busy && (
            <div className="ask-chips">
              {chips.map((c) => (
                <button key={c} className="chip" onClick={() => ask(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <form
        className="ask-input"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about a scam or a message…" aria-label="Your question" maxLength={600} />
        <button type="submit" disabled={!text.trim() || busy} aria-label="Send">
          <Icon name="up" size={18} />
        </button>
      </form>
      <Nav />
    </div>
  );
}
