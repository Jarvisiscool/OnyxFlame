import type { Evidence } from "../types";
import { extractIndicators } from "./extract";

export interface ScamPattern {
  id: string;
  name: string;
  description: string;
  cues: RegExp[];
  tactics: string[];
  /** Cap evidence weight for playbooks whose openers are often innocent */
  maxWeight?: "medium";
  /** The first cue is the anchor: without it the playbook does not apply. */
  /** If any of these match, the playbook does not apply (e.g. a real code delivery) */
  veto?: RegExp[];
}

/** Knowledge base of common scam playbooks (paraphrased from public consumer-protection guidance). */
export const PATTERNS: ScamPattern[] = [
  {
    id: "toll_fee",
    name: "Unpaid toll text",
    description: "Fake toll agency demands a small payment through a link, threatening fees or license suspension.",
    cues: [/\b(?:tolls?|tolltag|txtag|ez-?pass|tollway|ntta|peaje)\b/i, /\b(?:unpaid|balance|outstanding|saldo)\b/i, /late fee|suspen|penalt|\bsettle\b|\bpay\b|\bpague\b/i],
    tactics: ["fear", "urgency", "small amount lowers guard"],
  },
  {
    id: "package_fee",
    name: "Package redelivery fee",
    description: "Fake courier says a package is held and asks for a fee or address update via link.",
    cues: [/\b(?:package|parcel|delivery|shipment|paquete|env[ií]o)\b/i, /redeliver|\bheld\b|on hold|\baddress\b|\bfee\b|customs|retenido|direcci[oó]n|\bpago\b/i],
    tactics: ["curiosity", "small amount lowers guard"],
  },
  {
    id: "safe_account",
    name: "Bank 'safe account' transfer",
    description: "Caller posing as bank fraud team convinces victim to move money to a 'secure' account they control.",
    cues: [/\b(?:safe|secure|holding|protected|new secure|new)\s+(?:account|wallet|vault)\b|\bcuenta segura\b/i, /\b(?:move|moving|transfer)\b|protect your (?:funds|money)/i, /\bfraud|unusual activity|suspicious activity|unusual login/i],
    tactics: ["authority", "fear", "urgency", "isolation"],
  },
  {
    id: "otp_theft",
    name: "Verification code theft / SIM swap",
    description: "Scammer triggers a real one-time code, then poses as support and asks the victim to read it back to take over the account or port the number.",
    cues: [/\b(?:codes?|pin|passcode|c[oó]digo)\b/i, /\b(?:reply|send|share|read|tell|forward)\b/i, /\b(?:support|upgrade|activation|verify|sim|recovery|locked out|by mistake|google voice)\b/i],
    // A message that delivers a code and warns you never to share it is the real thing.
    veto: [/\b(?:never|don'?t|do not)\s+(?:ever\s+)?(?:share|give|send|tell|forward)\b/i, /\bwill never\b(?:\s+\w+){0,4}\s+ask\b/i],
    tactics: ["authority", "urgency", "technical confusion"],
  },
  {
    id: "rewards",
    name: "Expiring rewards / prize",
    description: "Claims points, a prize or a refund will expire unless claimed through a link.",
    cues: [/\b(?:rewards?|points|prize|gift|won|winner|refund|sweepstakes|premio|reembolso)\b/i, /\b(?:expire|claim|redeem|release)|reclam|expira|canje/i],
    tactics: ["greed", "urgency"],
  },
  {
    id: "family_emergency",
    name: "'Hi Mom, new number'",
    description: "Impersonates a child or relative on a new number or in a crisis and asks for urgent money.",
    cues: [
      /\b(?:hi|hey|hola) (?:mom|mum|dad|grandma|grandpa|mam[aá]|pap[aá]|abuela|abuelo)\b|^\W*(?:grandma|grandpa|mom|dad)\b[^.?!]{0,10}\bit'?s me\b|\bit'?s me\b[^.?!]{0,30}\b(?:trouble|accident)/i,
      /new number|lost my phone|dropped my phone|broke my phone|n[uú]mero nuevo|se me cay[oó]|in trouble|car accident|arrested|\bbail\b|lawyer/i,
      /\b(?:pay|send|money|bill|zelle|venmo|cash app|bail|gift cards?|mandar|enviar|dinero)\b/i,
    ],
    tactics: ["emotion", "urgency", "trust"],
  },
  {
    id: "wrong_number",
    name: "Wrong-number opener (pig butchering)",
    description: "Friendly 'wrong number' text that builds a relationship before pitching crypto investments.",
    cues: [
      /\bis this (?:still )?(?:your|the) number\b|wrong number|are we still (?:on|meeting|good)|still (?:on|meeting) for|long time no (?:talk|see)|found your number|got your number from/i,
      /\b[Hh](?:i|ey|ello) [A-Z][a-z]+\b/,
    ],
    tactics: ["friendliness", "long con"],
    maxWeight: "medium",
  },
  {
    id: "gov_impersonation",
    name: "Government impersonation",
    description: "Poses as IRS, SSA, a court or police; threatens arrest or benefits loss; demands unusual payment.",
    cues: [
      /\b(?:irs|social security|ssa|warrant|arrest|federal|medicare|sheriff|jury duty|marshal|court)\b/i,
      /suspend|legal action|\brefund|reembolso|penalt|\bfine\b|\bpayment\b|\bbail\b|\bbenefits\b|on hold|\bresolve/i,
    ],
    tactics: ["authority", "fear"],
  },
  {
    id: "account_locked",
    name: "Account locked / verify identity",
    description: "Claims an account is locked or compromised and asks you to sign in through a link.",
    cues: [
      /locked|suspended|compromised|restricted|limited your account|on hold|unusual sign-?in|unusual (?:activity|login)|verify your (?:identity|account)|bloquead|suspendid|verifique/i,
      /https?:|\.com|\.net|\.(?:info|top|xyz|live|online|co|us|support)\b|link|click/i,
    ],
    tactics: ["fear", "urgency"],
  },
  {
    id: "job_task",
    name: "Task / job offer scam",
    description: "Unsolicited remote job paying for simple tasks, later requiring 'deposits' to unlock earnings.",
    cues: [
      /\b(?:job|hiring|recruit\w*|remote|part-time|position|empleo|personal para)\b|\btrabaj/i,
      /\$\d+.*(?:\bday|\bhour|\/hr|\bhr\b|d[ií]a)|daily pay|commission|\btasks?\b|no experience|al d[ií]a|por d[ií]a/i,
    ],
    tactics: ["greed", "legitimacy theater"],
  },
  {
    id: "payment_reversal",
    name: "Accidental payment / refund reversal",
    description: "Claims money was sent by mistake or overpaid and asks you to send it back.",
    cues: [/by mistake|accidentally|overpaid|\brefunded\b/i, /send (?:it )?back|return the|\breverse|devolver/i],
    tactics: ["guilt", "urgency"],
  },
  {
    id: "tech_support",
    name: "Tech support / virus alert",
    description: "Warns of a virus or hack and pushes you to call a number or allow remote access.",
    cues: [/\b(?:virus|hacked|malware|infected|security alert)\b/i, /\b(?:call|remote|support)\b/i],
    tactics: ["fear", "authority"],
  },
  {
    id: "utility_shutoff",
    name: "Utility shutoff threat",
    description: "Claims your power, gas or water will be cut off within hours unless you pay by phone or app right away.",
    // Real utilities announce maintenance shutoffs too; the scam always ties the shutoff to a payment.
    cues: [/disconnect|shut ?off|\bcut off\b|\bcorte\b/i, /past due|\bbalance\b|nonpayment|non-payment|\bpay(?:ment)?\b|\bpague\b/i],
    tactics: ["fear", "urgency"],
    maxWeight: "medium",
  },
  {
    id: "student_loan",
    name: "Student loan forgiveness",
    description: "Promises loan forgiveness or relief, then charges an enrollment fee or harvests your FSA login.",
    cues: [/student loan|student aid|dept\.? of education|department of education/i, /forgiv|discharg|\brelief\b|\bcancel/i, /\bfee\b|\bcall\b|\benroll|deadline|act (?:now|before)|\bcloses\b|\bends\b/i],
    tactics: ["greed", "urgency", "authority"],
  },
  {
    id: "rental",
    name: "Rental listing scam",
    description: "Fake landlord who can't show the place asks for a deposit before you see it.",
    cues: [/\brent\b|apartment|bedroom|\blease\b|\/mo\b|per month|for rent/i, /overseas|out of (?:the )?(?:country|state|town)|mission trip|can'?t show|abroad|deployed/i, /deposit|first month|keys/i],
    tactics: ["scarcity", "trust"],
  },
  {
    id: "overpayment",
    name: "Marketplace overpayment",
    description: "Buyer sends a check for more than the price, or asks you to pay a 'fee' first, then wants money sent back.",
    cues: [
      /cashier'?s check|money order|check for \$|overpa|extra \$|business account|upgrade (?:to|your account)/i,
      /marketplace|\blisting\b|\blisted\b|buy your|interested in your|\bmover\b|shipper|courier/i,
    ],
    tactics: ["greed", "legitimacy theater"],
  },
  {
    id: "investment",
    name: "Investment / crypto pitch",
    description: "Stranger or new 'friend' pitches a trading app, mining pool or crypto platform with outsized returns.",
    cues: [
      /\b(?:trading|invest\w*|crypto|bitcoin|usdt|mining|forex|passive income)\b/i,
      /\d+\s?%|\bprofits?\b|\breturns?\b|made \$|\bearn|\bgrow/i,
      /platform|\bapp\b|\bgroup\b|\bpool\b|show you|walk you through|\bteach|mentor|send you/i,
    ],
    tactics: ["greed", "friendliness", "long con"],
    maxWeight: "medium",
  },
  {
    id: "charity",
    name: "Disaster charity appeal",
    description: "Unsolicited donation request tied to a recent disaster, sent to strangers with a link or payment app.",
    cues: [/\bdonat|give what|\brelief\b|\bvictims\b|\bfamilies\b|\bgift\b/i, /\b(?:hurricane|earthquake|flood|wildfire|tornado|disaster|storm)s?\b/i, /https?:|\.org\b|\.com\b|\blink\b|zelle|cash app|venmo|gift card/i],
    tactics: ["emotion", "urgency"],
    maxWeight: "medium",
  },
];

export function matchPatterns(text: string) {
  // A message that delivers a code without asking for it back is the real thing, not code theft.
  const ind = extractIndicators(text);
  const codeDelivery = ind.deliversCode && !ind.asksForCode;
  const scored = PATTERNS.map((p) => {
    // The first cue is the playbook's anchor (the toll, the code, the landlord…). Without it, no match.
    const vetoed = p.veto?.some((v) => v.test(text)) || (p.id === "otp_theft" && codeDelivery);
    const hits = vetoed || !p.cues[0].test(text) ? 0 : p.cues.filter((c) => c.test(text)).length;
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
