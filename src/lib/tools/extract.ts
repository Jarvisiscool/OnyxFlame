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
}

const URL_RE =
  /\b((?:https?:\/\/)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|gov|edu|co|us|io|info|biz|top|xyz|club|icu|click|link|live|online|site|shop|app|cc|me|ly|gl|vip|win|support|help|zip|mobi|cn|ru|tk|ml)(?:\/[^\s)]*)?)/gi;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const MONEY_RE = /\$\s?\d[\d,]*(?:\.\d{2})?/g;

const URGENCY = [
  "immediately",
  "urgent",
  "today",
  "tonight",
  "within 24 hours",
  "within 2 hours",
  "final notice",
  "last chance",
  "expire",
  "suspend",
  "suspension",
  "locked",
  "late fee",
  "act now",
  "asap",
  "right away",
  "before it's too late",
];
const PAYMENT = [
  "gift card",
  "zelle",
  "venmo",
  "cash app",
  "cashapp",
  "wire",
  "bitcoin",
  "crypto",
  "usdt",
  "western union",
  "moneygram",
  "apple pay",
  "safe account",
  "holding account",
];

function uniq<T>(xs: T[]) {
  return [...new Set(xs)];
}

export function extractIndicators(text: string): Indicators {
  const lower = text.toLowerCase();
  const emails = uniq(text.match(EMAIL_RE) ?? []);
  const textNoEmails = emails.reduce((t, e) => t.replace(e, " "), text);
  const urls = uniq(
    (textNoEmails.match(URL_RE) ?? []).map((u) => u.replace(/[.,!?]+$/, "")).filter((u) => !/^\d/.test(u)),
  );
  const phones = uniq((text.match(PHONE_RE) ?? []).map((p) => p.trim()));
  const asksForCode = [
    /\b(reply|send|text|share|give|read|tell)\b[^.?!]{0,40}\b(code|pin|passcode|otp)\b/gi,
    /\b(code|pin|passcode)\b[^.?!]{0,30}\b(to (?:me|us)|back to)\b/gi,
    /\b(code|pin|passcode)\b[\s\S]{0,80}?\b(reply|send|share|read|text|tell)\b[^.?!]{0,15}\b(it|that|this|them)\b/gi,
  ].some((re) =>
    [...text.matchAll(re)].some((m) => {
      const before = text.slice(Math.max(0, (m.index ?? 0) - 14), m.index).toLowerCase();
      const negated =
        /(don'?t|do not|never|won'?t|not)\s*$/.test(before) ||
        /\b(don'?t|do not|never|not)\s+(?:\w+\s+)?(reply|send|share|read|text|tell|give)\b/i.test(m[0]) ||
        /\bwith anyone\b/i.test(m[0]);
      return !negated;
    }),
  );
  const deliversCode =
    /\b(your|the)\b[^.?!]{0,25}\b(verification|security|login|one-time)?\s*code is\b/i.test(text) ||
    /\b(code|passcode)\s*(?:is|:)\s*(?:\[CODE\]|\d{4,8})/i.test(text);
  return {
    urls,
    phones,
    emails,
    amounts: uniq(text.match(MONEY_RE) ?? []),
    // Payment networks mentioned as "send by Zelle" are a payment method, not a claimed identity.
    claimedOrgs: claimedOrgs(text)
      .filter((o) => !(["Zelle", "PayPal"].includes(o.org) && new RegExp(`\\b(by|via|on|through|with)\\s+${o.org}\\b`, "i").test(text)))
      .map((o) => o.org),
    urgency: URGENCY.filter((w) => lower.includes(w)),
    paymentMethods: PAYMENT.filter((w) => lower.includes(w)),
    asksForCode,
    deliversCode: deliversCode && !asksForCode,
    asksToReply: /\breply\b/i.test(text),
    asksToCall: /\b(call|dial)\b/i.test(text) && phones.length > 0,
    secrecy: /\b(don'?t tell|do not (?:tell|discuss|share this)|keep this (?:between|private|confidential)|may be involved)\b/i.test(
      text,
    ),
  };
}
