import { chat, extractJson, hasNvidiaKey, DEEP_MODEL } from "@/lib/nemotron";
import { pickLesson } from "@/data/lessons";
import type { Channel, Flashcard, Lesson, LessonQuestion } from "@/lib/types";

export const maxDuration = 60;

const SYSTEM = `You write short scam-awareness lessons for a phone app, like a Quizlet session. Everything must be fictional:
- phone numbers in the 555-01XX range; short codes of 5 digits
- scam domains are invented lookalikes ending in .top, .info, .vip, .online or similar; legit senders use a made-up brand domain ending in .example, or no link
- no real people's names; banks are "Your bank" or invented brands; no real logos
Write 5 questions that mix "mcq" and "scam_or_legit". Cover SMS, voicemail AND email (at least two emails: one styled like Gmail, one like Outlook). About 1 in 3 should be legit.
Output JSON only, exactly this shape:
{"topic":"short scam type","lesson":{"title":"max 7 words","points":["3 points, each one sentence"],"example":"one short example message"},
"questions":[{"type":"mcq"|"scam_or_legit","channel":"sms"|"email"|"voicemail","look":"gmail"|"outlook" (email only),"from":"sender","subject":"email only","body":"the message, max 280 chars","prompt":"mcq only: the question","options":["mcq only: 3-4 options"],"answer":"mcq: the exact option text; scam_or_legit: scam or legit","tells":["2-3 short phrases copied word for word from body"],"explanation":"1-2 sentences"}],
"flashcards":[{"front":"a tell, max 8 words","back":"what it means and what to do, max 20 words"}]}`;

const CHANNELS: Channel[] = ["sms", "email", "voicemail"];
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function validQuestion(raw: unknown, i: number): LessonQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;
  const type = q.type === "mcq" || q.type === "scam_or_legit" ? q.type : null;
  const channel = CHANNELS.includes(q.channel as Channel) ? (q.channel as Channel) : null;
  const from = str(q.from, 100);
  const body = str(q.body, 400);
  const explanation = str(q.explanation, 300);
  if (!type || !channel || !from || !body || !explanation) return null;
  const tells = (Array.isArray(q.tells) ? q.tells : []).map((t) => str(t, 80)).filter(Boolean).slice(0, 3);
  if (!tells.length) return null;
  const base: LessonQuestion = {
    id: `q${i}`,
    type,
    channel,
    from,
    body,
    tells,
    explanation,
    answer: "",
    ...(channel === "email" ? { subject: str(q.subject, 100) || undefined, look: q.look === "outlook" ? "outlook" : "gmail" } : {}),
  };
  if (type === "scam_or_legit") {
    const a = str(q.answer, 10).toLowerCase();
    if (a !== "scam" && a !== "legit") return null;
    return { ...base, answer: a };
  }
  const options = (Array.isArray(q.options) ? q.options : []).map((o) => str(o, 90)).filter(Boolean);
  const unique = [...new Set(options)].slice(0, 4);
  const answer = str(q.answer, 90);
  const prompt = str(q.prompt, 140);
  if (unique.length < 3 || !unique.includes(answer) || !prompt) return null;
  return { ...base, prompt, options: unique, answer };
}

/** Strict: a lesson is used only if it has 3 points, 5 valid questions and at least 3 flashcards. */
function validLesson(j: unknown): Lesson | null {
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  const l = (o.lesson ?? {}) as Record<string, unknown>;
  const title = str(l.title, 70);
  const points = (Array.isArray(l.points) ? l.points : []).map((p) => str(p, 220)).filter(Boolean).slice(0, 3);
  const example = str(l.example, 300);
  const topic = str(o.topic, 50) || title;
  if (!title || points.length < 3 || !example) return null;
  const questions = (Array.isArray(o.questions) ? o.questions : [])
    .map(validQuestion)
    .filter((q): q is LessonQuestion => q !== null)
    .slice(0, 5)
    .map((q, i) => ({ ...q, id: `q${i + 1}` }));
  if (questions.length < 5) return null;
  // Must include both question types and at least one email, so the session covers other devices too.
  if (!questions.some((q) => q.type === "mcq") || !questions.some((q) => q.type === "scam_or_legit") || !questions.some((q) => q.channel === "email")) return null;
  const flashcards: Flashcard[] = (Array.isArray(o.flashcards) ? o.flashcards : [])
    .filter((f): f is Record<string, unknown> => Boolean(f) && typeof f === "object")
    .map((f) => ({ front: str(f.front, 80), back: str(f.back, 180) }))
    .filter((f) => f.front && f.back)
    .slice(0, 6);
  if (flashcards.length < 3) return null;
  return { id: `live-${Date.now()}`, topic, lesson: { title, points, example }, questions, flashcards, source: "live" };
}

export async function POST(req: Request) {
  const body = ((await req.json().catch(() => ({}))) ?? {}) as { seenTypes?: unknown };
  // seenTypes comes from the client: keep it short and plain before it reaches a prompt.
  const seenTypes = (Array.isArray(body.seenTypes) ? body.seenTypes : [])
    .filter((t): t is string => typeof t === "string")
    .map((t) => t.replace(/[^\w\s'&/-]/g, "").trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 6);
  const offline = (): Lesson => ({ ...pickLesson(seenTypes), source: "offline" });
  if (!hasNvidiaKey()) return Response.json(offline());

  try {
    const res = await chat({
      model: DEEP_MODEL,
      temperature: 0.8,
      maxTokens: 2600,
      thinking: "off",
      timeoutMs: 25_000,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Write one lesson for a T-Mobile family in Dallas-Fort Worth. ${
            seenTypes.length
              ? `Scams that recently reached their lines: ${seenTypes.join(", ")}. Make the lesson about the first one, and use new variations so they learn the pattern, not the exact text.`
              : "Teach how to spot a fake toll text."
          }`,
        },
      ],
    });
    const lesson = validLesson(extractJson(res.content || res.reasoning));
    return Response.json(lesson ?? offline());
  } catch {
    return Response.json(offline());
  }
}
