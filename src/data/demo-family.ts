import type { Channel, Risk } from "@/lib/types";

/**
 * Synthetic alert summaries for the other lines on Maria's family plan.
 * These are pre-computed (no live check): Maria only ever sees alerts, verdicts and recovery
 * status for these lines, never message contents, and only because each person opted in.
 */
export interface FamilyAlert {
  id: string;
  channel: Channel;
  when: string;
  risk: Risk;
  confidence: number;
  scamType: string;
  title: string;
  /** Why it was flagged, in plain words. Never the message text. */
  reasons: string[];
}

export interface FamilyLine {
  id: string;
  name: string;
  relation: string;
  initial: string;
  age: number;
  pronoun: "his" | "her" | "their";
  status: "okay" | "needs_help";
  headline: string;
  sub: string;
  consent: string;
  alerts: FamilyAlert[];
  recovery?: { title: string; steps: { label: string; detail?: string; done: boolean }[] };
  action: string;
  checkedThisWeek: number;
}

export const FAMILY: FamilyLine[] = [
  {
    id: "dad",
    name: "Frank",
    relation: "Dad",
    initial: "F",
    age: 68,
    pronoun: "his",
    status: "okay",
    headline: "Frank is okay",
    sub: "No money moved. Protection is on.",
    consent: "Dad shares scam alerts with you. His messages, calls and voicemails stay private.",
    alerts: [
      {
        id: "dad-1",
        channel: "voicemail",
        when: "Today, 2:14 PM",
        risk: "scam",
        confidence: 0.97,
        scamType: "Bank 'safe account' transfer",
        title: "Bank-impostor voicemail stopped",
        reasons: ["Caller ID \"PNC Bank\" wasn't verified", "Asked him to move money", "Asked him to keep it secret"],
      },
      {
        id: "dad-2",
        channel: "sms",
        when: "Tue, 10:02 AM",
        risk: "scam",
        confidence: 0.94,
        scamType: "Medicare card scam",
        title: "Fake Medicare text blocked",
        reasons: ["Lookalike website", "Asked for his Medicare number"],
      },
    ],
    recovery: {
      title: "Recovery",
      steps: [
        { label: "Frank paused and asked you first.", detail: "Second Look called you, his trusted contact, before any transfer.", done: true },
        { label: "Number blocked and reported", done: true },
        { label: "He called PNC using the number on his card", done: true },
        { label: "Check in with Dad tomorrow", done: false },
      ],
    },
    action: "Call Dad",
    checkedThisWeek: 23,
  },
  {
    id: "sofia",
    name: "Sofia",
    relation: "Sofia",
    initial: "S",
    age: 15,
    pronoun: "her",
    status: "okay",
    headline: "Sofia is okay",
    sub: "One gaming scam blocked this week. Nothing shared.",
    consent: "Sofia shares scam alerts with you. Her messages and DMs stay private.",
    alerts: [
      {
        id: "sofia-1",
        channel: "sms",
        when: "Yesterday, 6:47 PM",
        risk: "scam",
        confidence: 0.92,
        scamType: "Free game currency",
        title: "Free game-currency link blocked",
        reasons: ["Asked for her game login", "Site made 3 days ago", "Too-good-to-be-true offer"],
      },
      {
        id: "sofia-2",
        channel: "sms",
        when: "Mon, 4:15 PM",
        risk: "suspicious",
        confidence: 0.64,
        scamType: "Wrong-number opener",
        title: "Unknown sender, flagged for a look",
        reasons: ["New internet phone number", "Friendly opener from a stranger"],
      },
    ],
    recovery: {
      title: "Follow-up",
      steps: [
        { label: "Link paused before it opened", done: true },
        { label: "Sender blocked and reported", done: true },
        { label: "Sofia finished \"Spot a free-currency scam\"", detail: "Practice lesson, 5 of 5.", done: true },
      ],
    },
    action: "Text Sofia",
    checkedThisWeek: 31,
  },
];

/** A newly invited family line: protected, no alerts yet, sharing only after they accept. */
export function newFamilyLine(input: { name: string; relation: string; age: number; phone?: string }): FamilyLine {
  const name = input.name.trim();
  return {
    id: `m-${Date.now()}`,
    name,
    relation: input.relation,
    initial: name[0]?.toUpperCase() ?? "?",
    age: input.age,
    pronoun: "their",
    status: "okay",
    headline: `${name} is protected`,
    sub: "No scam alerts yet. Checks run privately on their phone.",
    consent: `${name} accepted sharing scam alerts with you. Their messages, calls and voicemails stay private.`,
    alerts: [],
    action: `Message ${name}`,
    checkedThisWeek: 0,
  };
}
