"use client";

import { useCallback, useEffect, useState } from "react";
import type { GymCard } from "@/lib/types";

export function ScamGym({ seenTypes }: { seenTypes: string[] }) {
  const [cards, setCards] = useState<GymCard[]>([]);
  const [source, setSource] = useState<"live" | "offline" | null>(null);
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);

  const apply = useCallback((j: { cards: GymCard[]; source: "live" | "offline" }) => {
    setCards(j.cards);
    setSource(j.source);
    setI(0);
    setScore(0);
    setAnswer(null);
    setLoading(false);
  }, []);

  const fetchRound = useCallback(
    () => fetch("/api/gym", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seenTypes }) }).then((r) => r.json()),
    [seenTypes],
  );

  const load = useCallback(() => {
    setLoading(true);
    fetchRound().then(apply);
  }, [fetchRound, apply]);

  useEffect(() => {
    // Load once when the tab opens; "New round" reloads with the latest scam types.
    let alive = true;
    fetchRound().then((j) => alive && apply(j));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = cards[i];
  const finished = cards.length > 0 && i >= cards.length;
  const correct = card && answer !== null ? answer === card.isScam : null;

  return (
    <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_380px]">
      <div>
        <h2 className="font-display text-[34px] font-bold leading-[1.05]">Practice spotting scams before they reach you</h2>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink-soft">
          {seenTypes.length
            ? `This round is built around what reached your phone today: ${seenTypes.join(", ")}. Some messages are real. Decide, then see the tells.`
            : "A mix of real messages and scams. Decide, then see the tells."}
        </p>
        <p className="mt-6 font-display text-5xl font-bold tnum">
          {score}
          <span className="text-2xl text-muted">/{cards.length || 0}</span>
        </p>
        <p className="text-sm text-muted">correct this round</p>
        <button onClick={load} disabled={loading} className="mt-6 rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold hover:border-ink/40 disabled:opacity-60">
          {loading ? "Writing new messages…" : "New round"}
        </button>
        {source && <p className="mt-3 text-[12px] text-muted">{source === "live" ? "Messages written by Nemotron for this round" : "Practice deck (offline)"}</p>}
      </div>

      <div className="rounded-[28px] bg-panel p-5 ring-1 ring-line">
        {loading || !cards.length ? (
          <p className="py-24 text-center text-sm text-muted">Writing practice messages…</p>
        ) : finished ? (
          <div className="py-16 text-center">
            <p className="font-display text-3xl font-bold">
              {score} of {cards.length}
            </p>
            <p className="mt-2 text-sm text-muted">{score === cards.length ? "Perfect round. Scammers will have a hard time with you." : "Run another round to sharpen the ones you missed."}</p>
            <button onClick={load} className="mt-6 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white">
              New round
            </button>
          </div>
        ) : (
          <>
            <p className="text-[12px] text-muted tnum">
              Message {i + 1} of {cards.length}
            </p>
            <p className="mt-3 text-[13px] font-semibold">{card.displayName ? `${card.displayName} · ${card.from}` : card.from}</p>
            <div className="mt-2 rounded-2xl rounded-bl-md bg-wash px-4 py-3 text-[15px] leading-snug">{card.body}</div>
            {answer === null ? (
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setAnswer(true);
                    if (card.isScam) setScore((s) => s + 1);
                  }}
                  className="rounded-xl bg-scam py-3 text-[15px] font-bold text-white"
                >
                  Scam
                </button>
                <button
                  onClick={() => {
                    setAnswer(false);
                    if (!card.isScam) setScore((s) => s + 1);
                  }}
                  className="rounded-xl bg-safe py-3 text-[15px] font-bold text-white"
                >
                  Legit
                </button>
              </div>
            ) : (
              <div className="animate-sheet-up mt-5">
                <p className={`font-display text-xl font-bold ${correct ? "text-safe" : "text-scam"}`}>
                  {correct ? "Right." : "Not quite."} It&apos;s {card.isScam ? "a scam" : "legit"}.
                </p>
                <ul className="mt-2 space-y-1">
                  {card.tells.map((t, k) => (
                    <li key={k} className="flex gap-2 text-[14px] leading-snug text-ink-soft">
                      <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${card.isScam ? "bg-scam" : "bg-safe"}`} aria-hidden />
                      {t}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    setI((x) => x + 1);
                    setAnswer(null);
                  }}
                  className="mt-4 w-full rounded-xl bg-ink py-3 text-sm font-semibold text-white"
                >
                  {i + 1 === cards.length ? "See score" : "Next message"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
