import type { Evidence } from "../types";

export interface ScamPattern {
  id: string;
  name: string;
  description: string;
  cues: RegExp[];
  tactics: string[];
  /** Cap evidence weight for playbooks whose openers are often innocent */
  maxWeight?: "medium";
}

/** Knowledge base of common scam playbooks (paraphrased from public consumer-protection guidance). */
export const PATTERNS: ScamPattern[] = [
  {
    id: "toll_fee",
    name: "Unpaid toll text",
    description: "Fake toll agency demands a small payment through a link, threatening fees or license suspension.",
    cues: [/\btoll|tolltag|ez-?pass|tollway|ntta\b/i, /unpaid|balance|outstanding/i, /late fee|suspen/i],
    tactics: ["fear", "urgency", "small amount lowers guard"],
  },
  {
    id: "package_fee",
    name: "Package redelivery fee",
    description: "Fake courier says a package is held and asks for a fee or address update via link.",
    cues: [/package|parcel|delivery|shipment/i, /redeliver|held|address|fee|customs/i],
    tactics: ["curiosity", "small amount lowers guard"],
  },
  {
    id: "safe_account",
    name: "Bank 'safe account' transfer",
    description: "Caller posing as bank fraud team convinces victim to move money to a 'secure' account they control.",
    cues: [/safe|secure|holding|protected/i, /account/i, /move|transfer|protect your (?:funds|money)/i, /fraud|unusual activity|suspicious activity/i],
    tactics: ["authority", "fear", "urgency", "isolation"],
  },
  {
    id: "otp_theft",
    name: "Verification code theft / SIM swap",
    description: "Scammer triggers a real one-time code, then poses as support and asks the victim to read it back to take over the account or port the number.",
    cues: [/code|pin|passcode/i, /reply|send|share|read|tell/i, /support|upgrade|activation|verify|sim/i],
    tactics: ["authority", "urgency", "technical confusion"],
  },
  {
    id: "rewards",
    name: "Expiring rewards / prize",
    description: "Claims points, a prize or a refund will expire unless claimed through a link.",
    cues: [/reward|points|prize|gift|won|winner|refund/i, /expire|claim|redeem/i],
    tactics: ["greed", "urgency"],
  },
  {
    id: "family_emergency",
    name: "'Hi Mom, new number'",
    description: "Impersonates a child or relative on a new number and asks for urgent money.",
    cues: [/\bhi (?:mom|mum|dad|grandma|grandpa)\b/i, /new number|lost my phone|dropped my phone|broke my phone/i, /pay|send|money|bill|zelle|venmo|cash app/i],
    tactics: ["emotion", "urgency", "trust"],
  },
  {
    id: "wrong_number",
    name: "Wrong-number opener (pig butchering)",
    description: "Friendly 'wrong number' text that builds a relationship before pitching crypto investments.",
    cues: [/\bis this (?:still )?(?:your|the) number\b|wrong number|are we still on/i, /\b[Hh](?:i|ey|ello) [A-Z][a-z]+\b/],
    tactics: ["friendliness", "long con"],
    maxWeight: "medium",
  },
  {
    id: "gov_impersonation",
    name: "Government impersonation",
    description: "Poses as IRS, SSA or police; threatens arrest or benefits loss; demands unusual payment.",
    cues: [/\birs|social security|ssa|warrant|arrest|federal|medicare\b/i, /suspend|legal action|refund|penalt/i],
    tactics: ["authority", "fear"],
  },
  {
    id: "account_locked",
    name: "Account locked / verify identity",
    description: "Claims an account is locked or compromised and asks you to sign in through a link.",
    cues: [/locked|suspended|compromised|unusual sign-?in|verify your (?:identity|account)/i, /https?:|\.com|\.net|link|click/i],
    tactics: ["fear", "urgency"],
  },
  {
    id: "job_task",
    name: "Task / job offer scam",
    description: "Unsolicited remote job paying for simple tasks, later requiring 'deposits' to unlock earnings.",
    cues: [/job|hiring|recruit|remote|part-time/i, /\$\d+.*(?:day|hour)|daily pay|commission|tasks?/i],
    tactics: ["greed", "legitimacy theater"],
  },
  {
    id: "payment_reversal",
    name: "Accidental payment / refund reversal",
    description: "Claims money was sent by mistake or overpaid and asks you to send it back.",
    cues: [/by mistake|accidentally|overpaid|refund/i, /send (?:it )?back|return the|reverse/i],
    tactics: ["guilt", "urgency"],
  },
  {
    id: "tech_support",
    name: "Tech support / virus alert",
    description: "Warns of a virus or hack and pushes you to call a number or allow remote access.",
    cues: [/virus|hacked|malware|infected|security alert/i, /call|remote|support/i],
    tactics: ["fear", "authority"],
  },
];

export function matchPatterns(text: string) {
  const scored = PATTERNS.map((p) => {
    const hits = p.cues.filter((c) => c.test(text)).length;
    return { id: p.id, name: p.name, description: p.description, tactics: p.tactics, score: hits / p.cues.length, maxWeight: p.maxWeight };
  })
    .filter((p) => p.score >= 0.5)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const signals: Evidence[] = scored
    .filter((m) => m.score >= 0.66)
    .map((m) => ({
      signal: `Matches "${m.name}" playbook`,
      detail: m.description,
      weight: m.score >= 0.99 && !m.maxWeight ? "high" : "medium",
      direction: "risk",
      source: "Scam pattern library",
    }));
  const summary = scored.length ? scored.map((m) => `${m.name} (${Math.round(m.score * 100)}%)`).join("; ") : "no known playbook matched";
  return { matches: scored, signals, summary };
}
