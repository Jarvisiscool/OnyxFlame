import { claimedOrgs } from "./directory";

export interface Indicators {
  urls: string[];
  phones: string[];
  emails: string[];
  amounts: string[];
  claimedOrgs: string[];
  urgency: string[];
  paymentMethods: string[];
  asksForCode: boolean;
  deliversCode: boolean;
  asksToReply: boolean;
  asksToCall: boolean;
  secrecy: boolean;
  /** Threatened penalties: arrest, disconnection, suspension, towing, fees… */
  threats: string[];
  /** Hard-to-reverse rails that are almost never legitimate for strangers (wire, crypto, money order…) */
  riskyRails: string[];
  /** Risky rails with a payment verb in front ("in USDT", "by wire") */
  railsAsked: string[];
  /** Person-to-person apps that friends also use every day (Zelle, Venmo, Cash App…) */
  p2pApps: string[];
  /** The message asks YOU to send or pay money (not just mentions a payment) */
  requestsPayment: boolean;
  /** Wants payment in gift cards, or the codes on the back of them */
  giftCardPayment: boolean;
  /** Wants money moved to a "safe", "secure" or "new" account or wallet */
  moveMoney: boolean;
  /** Asks for card numbers, bank details, SSN or to "confirm your information" */
  asksForPersonalInfo: boolean;
  /** Asks you to call a number while sounding an alarm (unauthorized charge, warrant, shutoff…) */
  callbackAlarm: boolean;
  /** "Reply YES or NO" fraud-alert format */
  replyYesNo: boolean;
  /** Asks you to scan a QR code */
  qrCode: boolean;
  /** Wants to continue on Telegram, WhatsApp or similar */
  offPlatformChat: string[];
  /** Greets the recipient by a name that isn't theirs (owner's names are redacted to [NAME]) */
  wrongNameGreeting?: string;
  /** The largest dollar amount mentioned */
  maxAmount: number;
  /** Total urgency-word occurrences (catches "URGENT URGENT URGENT…") */
  urgencyCount: number;
  /** Share of letters in capitals, for messages long enough to judge */
  capsRatio: number;
}

const TLDS =
  "com|org|net|gov|edu|mil|co|us|io|info|biz|top|xyz|club|icu|click|link|live|online|site|shop|app|cc|me|ly|gl|vip|win|support|help|zip|mobi|cn|ru|tk|ml|ga|cf|gq|pw|ca|uk|de|fr|in|tv|ai|pro|sbs|cfd|bond|cyou|rest|fun|space|store|tech|website|today|life|world|pay|page|finance|money|loan|cam|buzz|lol|monster|quest|cloud|digital|services|center|host|delivery|express|claims";
/** Bare domains with a known ending, in any letter case or script (homoglyph domains included). */
const DOMAIN_RE = new RegExp(
  `(?<![\\p{L}\\p{N}@.-])((?:https?:\\/\\/)?(?:[\\p{L}\\p{N}](?:[\\p{L}\\p{N}-]{0,61}[\\p{L}\\p{N}])?\\.)+(?:${TLDS})(?![\\p{L}\\p{N}-])(?:[/?#][^\\s)]*)?)`,
  "giu",
);
/**
 * Any other ending (.sbs, .lat, .zone…) when it clearly looks like a link: a hyphenated or multi-label host,
 * or a path. Plain "word.word" without either is left alone so typos like "today.See" don't become links.
 */
const GENERIC_DOMAIN_RE =
  /(?<![\p{L}\p{N}@.-])((?:www\.)?(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+[a-z]{2,24}(?![\p{L}\p{N}-])(?:[/?#][^\s)]*)?)/giu;
const looksLikeLink = (u: string) => /^www\./i.test(u) || /[/?#]/.test(u) || /-[^.]*\.[a-z]+(?:[/?#]|$)/i.test(u) || u.split("/")[0].split(".").length >= 3;
/** Anything with an explicit scheme, whatever its ending. */
const SCHEME_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;
/** Links to a bare IP address, with or without scheme. */
const IP_URL_RE = /(?<![\d.])((?:https?:\/\/)?\d{1,3}(?:\.\d{1,3}){3}(?::\d{2,5})?\/[^\s)]*)/gi;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const MONEY_RE = /\$\s?\d[\d,]*(?:\.\d{2})?/g;

const URGENCY: (string | RegExp)[] = [
  "immediately",
  "urgent",
  "today",
  "tonight",
  /within \d+ (?:hours?|hrs?|minutes?|mins?|days?)/,
  /in \d+ (?:minutes?|mins?)\b/,
  "final notice",
  "final enrollment",
  "last chance",
  "expire",
  "act now",
  "act before",
  "asap",
  "right away",
  "right now",
  "before it's too late",
  "end of the day",
  "before midnight",
  "deadline",
  "urgente",
  "de inmediato",
  "inmediatamente",
  "hoy mismo",
  "expira",
];
const THREATS: RegExp[] = [
  /\barrest\w*/,
  /\bwarrant\b/,
  /\blegal action\b/,
  /\blawsuit\b/,
  /\bdisconnect\w*/,
  /\bshut ?off\b|\bshut off\b/,
  /\bsuspen(?:d|ded|sion)\b/,
  /\b(?:frozen|freeze)\b/,
  /\bdeactivat\w*/,
  /\btow(?:ed|ing)\b/,
  /\bpenalt(?:y|ies)\b/,
  /\blate fee/,
  /\blos(?:e|ing) (?:your )?(?:service|access|account|benefits)\b/,
  /\bbloquead[ao]\b/,
  /\bsuspensi[oó]n\b/,
];
const RISKY_RAILS = ["wire", "bitcoin", "btc", "crypto", "usdt", "western union", "moneygram", "cashier's check", "money order", "bitcoin atm"];
const P2P_APPS = ["zelle", "venmo", "cash app", "cashapp", "apple pay", "paypal"];
/** Kept for the "move money" signal and older consumers of paymentMethods */
const MOVE_ACCOUNTS = ["safe account", "holding account", "secure account"];

/** Words that look like a name after "Hi" but are not someone else's name. */
const GREETING_STOP = new Set(
  "mom mum mama mommy dad papa daddy grandma grandpa granny nana sweetie honey hon babe baby love dear there all everyone everybody team friend friends guys folks neighbor neighbors customer member sir madam maam mija mijo mami papi tia tio abuela abuelo sis bro brother sister son daughter auntie aunt uncle cousin coach doc dr mr mrs ms officer this it its again good happy welcome thanks thank".split(
    " ",
  ),
);

function uniq<T>(xs: T[]) {
  return [...new Set(xs)];
}

const wordRe = (w: string) => new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[^\\p{L}\\p{N}]|$)`, "iu");

/** Payment apps and other brands are only "claimed" when the message speaks as them, not when it says "Venmo me". */
const PAYMENT_ORGS = ["Zelle", "PayPal", "Venmo", "Cash App"];
function speaksAs(org: string, text: string) {
  const o = org.replace(/ /g, "\\s?");
  return new RegExp(`(\\b${o}\\s*(?::|alert|security|support|team|notice|fraud|refunds?)|\\b(?:from|this is)\\s+${o}\\b|\\byour\\s+${o}\\s+(?:account|verification|code|payment|balance|wallet))`, "i").test(text);
}

export function extractIndicators(text: string): Indicators {
  const lower = text.toLowerCase();
  const emails = uniq(text.match(EMAIL_RE) ?? []);
  const textNoEmails = emails.reduce((t, e) => t.replace(e, " "), text);
  const ipUrls = (textNoEmails.match(IP_URL_RE) ?? []).map((u) => u.replace(/[.,!?]+$/, ""));
  const genericUrls = (textNoEmails.match(GENERIC_DOMAIN_RE) ?? []).filter((u) => looksLikeLink(u) && !/^[\d.]+$/.test(u.split("/")[0]));
  const domainUrls = [...(textNoEmails.match(SCHEME_RE) ?? []), ...(textNoEmails.match(DOMAIN_RE) ?? []), ...genericUrls]
    .map((u) => u.replace(/[.,!?]+$/, ""))
    .filter((u) => !/^\d/.test(u) && !/^https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/i.test(u));
  // Drop bare domains already covered by a scheme URL ("https://x.com/a" also matches "x.com/a").
  const urls = uniq([...ipUrls, ...domainUrls]).filter((u, _i, all) => !all.some((o) => o !== u && o.length > u.length && o.toLowerCase().endsWith(u.toLowerCase())));
  const phones = uniq((text.match(PHONE_RE) ?? []).map((p) => p.trim()));
  const asksForCode = [
    /\b(reply|send|text|share|give|read|tell|forward)\b[^.?!]{0,40}\b(code|pin|passcode|otp|c[oó]digo)\b/gi,
    /\b(code|pin|passcode|c[oó]digo)\b[^.?!]{0,30}\b(to (?:me|us)|back to)\b/gi,
    /\b(code|pin|passcode|c[oó]digo)\b[\s\S]{0,80}?\b(reply|send|share|read|text|tell|forward)\b[^.?!]{0,15}\b(it|that|this|them)\b/gi,
  ].some((re) =>
    [...text.matchAll(re)].some((m) => {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 14), m.index).toLowerCase();
      const negated =
        /(don'?t|do not|never|won'?t|not)\s*$/.test(before) ||
        /\b(don'?t|do not|never|not)\s+(?:\w+\s+)?(reply|send|share|read|text|tell|give|forward)\b/i.test(m[0]) ||
        /\bwith anyone\b/i.test(m[0]);
      return !negated;
    }),
  );
  const deliversCode =
    /\b(your|the)\b[^.?!]{0,25}\b(verification|security|login|one-time)?\s*code is\b/i.test(text) ||
    /\b(code|passcode|c[oó]digo)\s*(?:is|es|:)\s*(?:\[CODE\]|\d{4,8})/i.test(text) ||
    /(?:\[CODE\]|\b[A-Z]?-?\d{4,8})\s+is your\b[^.?!]{0,30}\bcode\b/i.test(text);

  const amounts = uniq(text.match(MONEY_RE) ?? []);
  const maxAmount = Math.max(0, ...amounts.map((a) => Number(a.replace(/[^\d.]/g, "")) || 0));
  const riskyRails = RISKY_RAILS.filter((w) => wordRe(w).test(lower));
  // A rail counts as a payment ask only with a payment verb in front of it ("in USDT", "by wire"), not "0.42 BTC is pending".
  const railsAsked = riskyRails.filter((r) =>
    new RegExp(`\\b(pay|paid|send|deposit|buy|load|transfer|in|via|by|through|with|accepts?|using)\\b[^.?!]{0,25}\\b${r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text),
  );
  const p2pApps = P2P_APPS.filter((w) => wordRe(w).test(lower));
  const requestsPayment =
    /\b(send|pay|venmo me|zelle me|cash ?app me|transfer|wire|deposit|return|settle|donate|give)\b[^.?!]{0,60}(\$|\bmoney\b|\bfunds\b|\bdeposit\b|\bdifference\b|\bit back\b|\bfee\b|\bbalance\b|\bzelle\b|\bvenmo\b|\bcash ?app\b|\bgift cards?\b)/i.test(text) ||
    /\b(m[aá]nd(?:a|ar|ame)|env[ií](?:a|ar|ame)|pag(?:a|ar|ue))\b/i.test(text) ||
    /\b(processing|enrollment|release|customs|redelivery|shipping) fee\b/i.test(text);
  const giftCardPayment =
    /\b(pay|paid|buy|purchase|pick up|get|grab|accepts?|in|with|by|using)\b[^.?!]{0,30}\b(?:gift ?cards?|google play(?: cards?)?|itunes(?: cards?)?|steam(?: cards?)?|tarjetas? de regalo)\b/i.test(text) ||
    /\bcodes? (?:on|from) the back\b/i.test(text);
  const moveMoney =
    MOVE_ACCOUNTS.some((w) => lower.includes(w)) ||
    /\b(move|transfer|send)\b[^.?!]{0,30}\b(funds|money|balance|savings|crypto)\b[^.?!]{0,30}\b(safe|secure|holding|protected|new)\b[^.?!]{0,15}\b(account|wallet|vault)\b/i.test(text);
  const asksForPersonalInfo =
    /\b(card number|card details|bank details|bank info|account number|routing number|social security number|ssn|date of birth|mother'?s maiden)\b/i.test(text) ||
    /\b(confirm|verify|update|submit|provide)\b[^.?!]{0,15}\b(your )?(information|info|details|identity|card|billing|payment (?:info|details|method))\b/i.test(text) ||
    /\bverifique sus datos|\bsus datos\b|\bconfirme su\b/i.test(text);
  const threats = uniq(THREATS.map((re) => lower.match(re)?.[0]).filter((x): x is string => Boolean(x)));
  const urgency = URGENCY.map((w) => (typeof w === "string" ? (lower.includes(w) ? w : null) : (lower.match(w)?.[0] ?? null))).filter((x): x is string => Boolean(x));
  const urgencyCount = URGENCY.reduce<number>(
    (n, w) => n + (typeof w === "string" ? lower.split(w).length - 1 : (lower.match(new RegExp(w.source, "g")) ?? []).length),
    0,
  );
  const letters = text.replace(/\[[A-Z ]+\]|https?:\/\/\S+/g, "").match(/\p{L}/gu) ?? [];
  const capsRatio = letters.length >= 20 ? letters.filter((c) => c !== c.toLowerCase()).length / letters.length : 0;
  const asksToCall = /\b(call|dial|ll[aá]me|llamar)\b/i.test(text) && phones.length > 0;
  const alarm =
    threats.length > 0 ||
    /\b(unauthori[sz]ed|did not (?:authori[sz]e|request|make|recogni[sz]e)|didn'?t (?:authori[sz]e|request|make|recogni[sz]e)|do not recogni[sz]e|wasn'?t you|not you\b|pending|fraud|hacked|virus|infected|unusual|suspicious|refund|cancel|forgiveness|on hold|past due|nonpayment)\b/i.test(text);
  const greet = text.match(/^\W*(?:hi|hey|hello|hola|dear|good (?:morning|afternoon|evening))[,!]?\s+([A-Z][a-z]{2,})\b/);
  const wrongName = greet && !GREETING_STOP.has(greet[1].toLowerCase()) ? greet[1] : undefined;

  return {
    urls,
    phones,
    emails,
    amounts,
    claimedOrgs: claimedOrgs(text)
      .filter((o) => !PAYMENT_ORGS.includes(o.org) || speaksAs(o.org, text))
      .map((o) => o.org),
    urgency: uniq(urgency),
    // Only payment methods the message actually asks you to use ("Venmo will never call you" is not a payment ask).
    paymentMethods: uniq([...railsAsked, ...(requestsPayment ? p2pApps : []), ...(giftCardPayment ? ["gift card"] : []), ...MOVE_ACCOUNTS.filter((w) => lower.includes(w))]),
    asksForCode,
    deliversCode: deliversCode && !asksForCode,
    asksToReply: /\breply\b|\bresponda\b/i.test(text),
    asksToCall,
    secrecy:
      /\b(don'?t tell|do not (?:tell|discuss|share this)|keep (?:this|it) (?:between|private|confidential|quiet|secret)|may be involved|between us|no le digas|no se lo digas)\b/i.test(text),
    threats,
    riskyRails,
    railsAsked,
    p2pApps,
    requestsPayment,
    giftCardPayment,
    moveMoney,
    asksForPersonalInfo,
    callbackAlarm: asksToCall && alarm,
    replyYesNo: /\breply\s+"?(?:yes|y|1|s[ií])"?\b[^.?!]{0,40}\b(?:no|n|2)\b/i.test(text) || /\bresponda\s+s[ií]\b/i.test(text),
    qrCode: /\bQR\b/i.test(text) && /\bscan\w*|escane\w*/i.test(text),
    offPlatformChat: uniq((lower.match(/\b(telegram|whatsapp|signal app|wechat|kakaotalk)\b/g) ?? []).map((s) => s)),
    wrongNameGreeting: wrongName,
    maxAmount,
    urgencyCount,
    capsRatio,
  };
}
