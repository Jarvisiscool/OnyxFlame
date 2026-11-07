"use client";

import { useCallback, useEffect, useState } from "react";
import type { GymCard } from "@/lib/types";
import { Kbd } from "./ui";

export function ScamGym({ seenTypes }: { seenTypes: string[] }) {
  const [cards, setCards] = useState<GymCard[]>([]);
  const [source, setSource] = useState<"live" | "offline" | null>(null);
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const apply = useCallback((j: { cards: GymCard[]; source: "live" | "offline" }) => {
    setCards(j.cards);
    setSource(j.source);
    setI(0);
    setAnswers([]);
    setLoading(false);
    setFailed(false);
  }, []);

  const fetchRound = useCallback(
    () =>
      fetch("/api/gym", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seenTypes }) }).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      }),
    [seenTypes],
  );

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    fetchRound()
      .then(apply)
      .catch(() => {
        setLoading(false);
        setFailed(true);
      });
  }, [fetchRound, apply]);

  useEffect(() => {
    // Load once when the tab opens; "New round" reloads with the latest scam types.
    let alive = true;
    fetchRound()
      .then((j) => alive && apply(j))
      .catch(() => {
        if (!alive) return;
        setLoading(false);
        setFailed(true);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const card = cards[i];
  const finished = cards.length > 0 && i >= cards.length;
  const answered = answers.length > i;
  const guess = answered ? answers[i] : null;
  const correct = card && guess !== null ? guess === card.isScam : null;
  const score = answers.filter((a, k) => cards[k] && a === cards[k].isScam).length;

  const answer = useCallback(
    (isScam: boolean) => {
      if (!card || answered) return;
      setAnswers((xs) => [...xs, isScam]);
    },
    [card, answered],
  );
  const next = useCallback(() => {
    if (answered) setI((x) => x + 1);
  }, [answered]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, dialog") || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "s") answer(true);
      else if (k === "l") answer(false);
      // A focused button already handles Enter itself.
      else if (k === "enter" && !el.closest("button")) next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [answer, next]);

  const learned = cards.slice(0, answers.length);

  return (
    <div className="mx-auto grid max-w-6xl gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_460px]">
      <div className="min-w-0">
        <h2 className="max-w-xl font-display text-[34px] leading-[1.05] font-bold">Practice spotting scams before they reach you</h2>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-soft">
          {seenTypes.length && source === "live"
            ? `This round is built around what reached your phone today: ${seenTypes.join(", ")}. Some messages are real. Decide, then see the tells.`
            : "A mix of real messages and scams. Decide, then see the tells."}
        </p>

        <div className="mt-7 flex flex-wrap items-end gap-x-8 gap-y-4">
          <div>
            <p className="font-display text-5xl font-bold tnum">
              {score}
              <span className="text-2xl text-muted">/{cards.length || 0}</span>
            </p>
            <p className="text-sm text-muted">correct this round</p>
          </div>
          {cards.length > 0 && (
            <ol className="flex gap-1.5 pb-2" aria-label="Round progress">
              {cards.map((c, k) => {
                const a = answers[k];
                const state = a === undefined ? (k === i ? "current" : "todo") : a === c.isScam ? "right" : "wrong";
                return (
                  <li
                    key={c.id + k}
                    aria-label={`Message ${k + 1}: ${state === "right" ? "correct" : state === "wrong" ? "missed" : state === "current" ? "current" : "not answered"}`}
                    className={`h-2.5 w-7 rounded-full ${
                      state === "right" ? "bg-safe" : state === "wrong" ? "bg-scam" : state === "current" ? "bg-agent/25 ring-2 ring-agent" : "bg-ink/10"
                    }`}
                  />
                );
              })}
            </ol>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button onClick={load} disabled={loading} className="min-h-9 rounded-full border border-line bg-panel px-4 text-sm font-semibold hover:border-ink/40 disabled:opacity-60">
            {loading ? "Writing new messages…" : "New round"}
          </button>
          {source && <p className="text-[12px] text-muted">{source === "live" ? "Messages written by Nemotron for this round" : "Practice deck (offline)"}</p>}
        </div>

        <section aria-label="Tells from this round" className="mt-9 border-t border-line pt-6">
          <h3 className="font-display text-xl font-bold">What gave it away</h3>
          {learned.length === 0 ? (
            <p className="mt-2 max-w-md text-[14px] leading-snug text-muted">Answer a message and the tells collect here, so you leave with a short list of what to watch for.</p>
          ) : (
            <ul className="mt-3 grid gap-x-8 gap-y-4 xl:grid-cols-2">
              {learned.map((c, k) => (
                <li key={c.id + k} className="min-w-0">
                  <p className="flex items-center gap-2 text-[13px] font-semibold">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${c.isScam ? "bg-scam" : "bg-safe"}`} aria-hidden />
                    <span className="truncate">{c.displayName ?? c.from}</span>
                    <span className={`shrink-0 font-semibold ${c.isScam ? "text-scam" : "text-safe"}`}>{c.isScam ? "Scam" : "Real"}</span>
                  </p>
                  <ul className="mt-1 space-y-0.5 pl-4">
                    {c.tells.map((t, j) => (
                      <li key={j} className="text-[13px] leading-snug text-ink-soft">
                        {t}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="self-start rounded-[28px] bg-panel p-6 shadow-[0_24px_48px_-32px_rgba(25,28,51,0.45)] ring-1 ring-line lg:sticky lg:top-6">
        {failed ? (
          <div className="py-16 text-center">
            <p className="font-display text-xl font-bold">Couldn&apos;t load a practice round</p>
            <button onClick={load} className="mt-4 min-h-9 rounded-full bg-ink px-5 text-sm font-semibold text-white">
              Try again
            </button>
          </div>
        ) : loading || !cards.length ? (
          <p className="py-28 text-center text-sm text-muted">Writing practice messages…</p>
        ) : finished ? (
          <div className="py-16 text-center">
            <p className="font-display text-4xl font-bold tnum">
              {score} of {cards.length}
            </p>
            <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
              {score === cards.length ? "Perfect round. Scammers will have a hard time with you." : "Run another round to sharpen the ones you missed."}
            </p>
            <button onClick={load} className="mt-6 min-h-10 rounded-full bg-ink px-5 text-sm font-semibold text-white">
              New round
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink/8 font-display text-sm font-semibold text-ink-soft" aria-hidden>
                {/^[+\d(]/.test(card.displayName ?? card.from) ? "#" : (card.displayName ?? card.from)[0]?.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{card.displayName ?? card.from}</span>
                {card.displayName && <span className="block truncate text-[12px] text-muted">{card.from}</span>}
              </span>
              <span className="shrink-0 text-[12px] text-muted tnum">
                {i + 1} of {cards.length}
              </span>
            </div>
            <div className="mt-4 rounded-2xl rounded-bl-md bg-wash px-4 py-3.5 text-[16px] leading-snug">{card.body}</div>
            {!answered ? (
              <>
                <p className="mt-5 text-[13px] font-semibold text-ink-soft">Would you trust this?</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button onClick={() => answer(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-scam text-[15px] font-bold text-white">
                    Scam <Kbd dark>S</Kbd>
                  </button>
                  <button onClick={() => answer(false)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-safe text-[15px] font-bold text-white">
                    Legit <Kbd dark>L</Kbd>
                  </button>
                </div>
              </>
            ) : (
              <div className="animate-sheet-up mt-5" aria-live="polite">
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
                <button onClick={next} className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-semibold text-white">
                  {i + 1 === cards.length ? "See score" : "Next message"}
                  <Kbd dark>Enter</Kbd>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
