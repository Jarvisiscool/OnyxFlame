import { chat, extractJson, hasNvidiaKey, DEEP_MODEL } from "@/lib/nemotron";
import { GYM_DECK } from "@/data/gym-deck";
import type { GymCard } from "@/lib/types";

export const maxDuration = 60;

const SYSTEM = `You write realistic practice messages for a scam-awareness trainer on a phone. Everything must be fictional:
- phone numbers in the 555-01XX range, short codes of 5 digits
- scam domains must be invented lookalikes (never real working domains); legit messages use the company's real domain or no link
- no real people's names
Mix scams and legitimate messages (about 60/40). Make them hard: legit ones can sound urgent, scams can sound calm.
Output JSON only: {"cards":[{"from":"...","displayName":"optional","body":"...","isScam":true|false,"tells":["2-3 short clues, max 10 words each"]}]}`;

export async function POST(req: Request) {
  const { seenTypes = [] } = (await req.json().catch(() => ({}))) as { seenTypes?: string[] };
  const shuffled = [...GYM_DECK].sort(() => Math.random() - 0.5);
  if (!hasNvidiaKey()) return Response.json({ cards: shuffled, source: "offline" });

  try {
    const res = await chat({
      model: DEEP_MODEL,
      temperature: 0.9,
      maxTokens: 2200,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Write 5 practice messages for a T-Mobile customer in Dallas-Fort Worth. ${
            seenTypes.length ? `They were recently targeted by: ${seenTypes.join(", ")}. Include new variations of those so they learn to spot them.` : "Cover a variety of current scam types."
          }`,
        },
      ],
    });
    const j = extractJson<{ cards: Omit<GymCard, "id">[] }>(res.content || res.reasoning);
    const cards = (j?.cards ?? [])
      .filter((c) => c?.body && c?.from && typeof c.isScam === "boolean")
      .slice(0, 6)
      .map((c, i) => ({ ...c, id: `n${Date.now()}${i}`, tells: Array.isArray(c.tells) ? c.tells.slice(0, 3) : [] }));
    if (cards.length < 3) return Response.json({ cards: shuffled, source: "offline" });
    return Response.json({ cards, source: "live" });
  } catch {
    return Response.json({ cards: shuffled, source: "offline" });
  }
}
