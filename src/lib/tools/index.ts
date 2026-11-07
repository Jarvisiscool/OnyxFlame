import type { Evidence } from "../types";
import type { ToolSchema } from "../nemotron";
import { extractIndicators, type Indicators } from "./extract";
import { checkLink, type LinkReport } from "./link";
import { checkSender } from "./sender";
import { findOrg } from "./directory";
import { matchPatterns } from "./patterns";

export interface ToolOutput {
  summary: string;
  signals: Evidence[];
  data: unknown;
}

export interface ToolContext {
  /** Redacted message text: the only message text the agent ever sees */
  text: string;
  from: string;
  displayName?: string;
}

export const TOOL_SCHEMAS: ToolSchema[] = [
  {
    type: "function",
    function: {
      name: "extract_indicators",
      description:
        "Parse the message for links, phone numbers, money amounts, organizations it claims to be, urgency language, payment methods, and requests for codes. Call this first.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "check_link",
      description:
        "Investigate one URL or domain: who owns it, whether it impersonates a known brand, how old the domain registration is, and risky traits (shorteners, risky endings). Call once per link.",
      parameters: {
        type: "object",
        properties: { url: { type: "string", description: "URL or bare domain exactly as it appears in the message" } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_sender",
      description:
        "Query carrier network intelligence for the sender: line type, number age, caller-ID verification, mass-texting volume, spam reports, and whether it is a registered business sender.",
      parameters: {
        type: "object",
        properties: {
          sender: { type: "string", description: "Sender phone number, short code or email" },
          claimed_name: { type: "string", description: "Organization or person the sender claims to be, if any" },
        },
        required: ["sender"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_official_contact",
      description:
        "Look up an organization's real domains, the safe way to contact it, and what it never asks for by text. Use for any organization the message claims to be from.",
      parameters: {
        type: "object",
        properties: { organization: { type: "string" } },
        required: ["organization"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "match_scam_patterns",
      description: "Compare the message against a library of known scam playbooks and the persuasion tactics they use.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_verdict",
      description: "Submit the final verdict. Call exactly once, after investigating.",
      parameters: {
        type: "object",
        properties: {
          risk: { type: "string", enum: ["safe", "suspicious", "scam"] },
          confidence: { type: "number", description: "0 to 1. Be honest: lower it when evidence is thin or conflicting." },
          scam_type: { type: "string", description: "Short name of the scam type, or 'Legitimate message'" },
          headline: { type: "string", description: "One plain-language sentence for the phone owner, max 12 words" },
          explanation: { type: "string", description: "2-3 sentences, plain language, refer to the concrete evidence found" },
          evidence: {
            type: "array",
            description: "The 3-5 most decisive findings",
            items: {
              type: "object",
              properties: {
                signal: { type: "string" },
                detail: { type: "string" },
                weight: { type: "string", enum: ["high", "medium", "low"] },
                direction: { type: "string", enum: ["risk", "safe"] },
                source: { type: "string", description: "Which tool produced it" },
              },
              required: ["signal", "detail", "direction"],
            },
          },
          actions: {
            type: "array",
            items: {
              type: "string",
              enum: ["block_sender", "report_7726", "delete_message", "verify_official", "warn_family", "mark_safe", "open_recovery"],
            },
          },
          verify_organization: { type: "string", description: "Organization the user should contact directly to double-check, if any" },
          uncertainty: { type: "string", description: "What you could not confirm, in one sentence. Empty if none." },
        },
        required: ["risk", "confidence", "scam_type", "headline", "explanation", "evidence", "actions"],
      },
    },
  },
];

export async function runTool(name: string, args: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput> {
  switch (name) {
    case "extract_indicators": {
      const ind = extractIndicators(ctx.text);
      const parts = [
        ind.urls.length ? `${ind.urls.length} link${ind.urls.length > 1 ? "s" : ""}` : "no links",
        ind.claimedOrgs.length ? `claims ${ind.claimedOrgs.join(", ")}` : null,
        ind.amounts.length ? `money ${ind.amounts.join(", ")}` : null,
        ind.urgency.length ? `urgency: ${ind.urgency.slice(0, 3).join(", ")}` : null,
        ind.threats.length ? `threats: ${ind.threats.slice(0, 3).join(", ")}` : null,
        ind.paymentMethods.length ? `payment: ${ind.paymentMethods.join(", ")}` : null,
        ind.asksForCode ? "asks for a code" : null,
        ind.deliversCode ? "delivers a one-time code" : null,
        ind.callbackAlarm ? "pushes a callback number" : null,
        ind.qrCode ? "QR code" : null,
        ind.offPlatformChat.length ? `moves chat to ${ind.offPlatformChat.join(", ")}` : null,
        ind.secrecy ? "asks for secrecy" : null,
      ].filter(Boolean);
      return { summary: parts.join(" · "), signals: messageSignals(ind, ctx.text), data: ind };
    }
    case "check_link": {
      const url = String(args.url ?? "");
      if (!url) return { summary: "no url given", signals: [], data: null };
      const r = await checkLink(url);
      return { summary: r.summary, signals: [...r.signals, ...linkContextSignals(r.report, ctx)], data: r.report };
    }
    case "check_sender": {
      const sender = String(args.sender ?? ctx.from);
      const r = checkSender(sender, (args.claimed_name as string) || ctx.displayName, ctx.text);
      return { summary: r.summary, signals: r.signals, data: r.data };
    }
    case "lookup_official_contact": {
      const org = findOrg(String(args.organization ?? ""));
      if (!org) return { summary: `no directory entry for "${args.organization}"`, signals: [], data: null };
      return {
        summary: `${org.org}: ${org.safeContact}`,
        signals: [],
        data: { org: org.org, officialDomains: org.domains, safeContact: org.safeContact, url: org.url, neverAsks: org.neverAsks },
      };
    }
    case "match_scam_patterns": {
      const r = matchPatterns(ctx.text);
      return { summary: r.summary, signals: r.signals, data: r.matches };
    }
    default:
      return { summary: `unknown tool ${name}`, signals: [], data: null };
  }
}

/* ------------------------------ message-level signals ------------------------------ */

const PRETTY: Record<string, string> = {
  zelle: "Zelle", venmo: "Venmo", "cash app": "Cash App", cashapp: "Cash App", "apple pay": "Apple Pay", paypal: "PayPal",
  wire: "wire transfer", whatsapp: "WhatsApp", telegram: "Telegram", wechat: "WeChat", kakaotalk: "KakaoTalk", "signal app": "Signal", bitcoin: "Bitcoin", btc: "Bitcoin", crypto: "crypto", usdt: "USDT (crypto)", "western union": "Western Union",
  moneygram: "MoneyGram", "cashier's check": "cashier's check", "money order": "money order", "bitcoin atm": "Bitcoin ATM",
};
const pretty = (xs: string[]) => [...new Set(xs.map((x) => PRETTY[x] ?? x))];
const listOf = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);

/** Penalties that are scary enough to push someone into acting without checking. */
const SEVERE_THREAT = /arrest|warrant|legal action|lawsuit|disconnect|shut ?off|suspen|frozen|freeze|deactivat|tow|los(?:e|ing)|bloquead|suspensi/;
const ALARM_SUBJECT = /\b(unauthori[sz]ed|did not authori[sz]e|didn'?t authori[sz]e|wasn'?t you|not you|pending|fraud|hacked|virus|refund|cancel|warrant|disconnect|shut ?off|suspend\w*|past due|forgiveness|on hold)\b/i;

function messageSignals(ind: Indicators, text: string): Evidence[] {
  const out: Evidence[] = [];
  const add = (signal: string, detail: string, weight: Evidence["weight"], direction: Evidence["direction"] = "risk") =>
    out.push({ signal, detail, weight, direction, source: "Message analysis" });

  if (ind.asksForCode) add("Asks for your code", "Requests a verification code or PIN, which no legitimate company does", "high");
  if (ind.secrecy) add("Asks for secrecy", "Tells you not to talk to anyone about it, a classic isolation tactic", "high");
  if (ind.moveMoney) add("Asks you to move money", "Wants your money moved into a \"safe\" or new account. Real banks never ask this.", "high");
  if (ind.giftCardPayment) add("Asks for gift cards", "Wants payment in gift cards or the codes on the back. No real business, agency or relative in trouble needs gift cards.", "high");

  const railsAsked = ind.railsAsked;
  const bigOrPressured = ind.maxAmount >= 100 || ind.urgency.length > 0 || ind.threats.length > 0 || ind.claimedOrgs.length > 0;
  if (railsAsked.length) {
    add("Hard-to-reverse payment", `Asks for payment by ${listOf(pretty(railsAsked))}, which is almost impossible to get back`, "medium");
  } else if (ind.p2pApps.length && ind.requestsPayment && bigOrPressured) {
    add("Hard-to-reverse payment", `Wants money sent by ${listOf(pretty(ind.p2pApps))}. Those payments work like cash, so you can't get them back.`, "medium");
  } else if (ind.p2pApps.length && ind.requestsPayment) {
    add("Payment app request", `Asks for a small ${listOf(pretty(ind.p2pApps))} payment. That's normal from someone you know, so make sure it's really them.`, "low");
  }
  if (ind.asksForPersonalInfo) add("Asks for personal details", "Wants card, bank or identity details. Companies don't collect these by text or through a link.", "medium");
  if (ind.qrCode) add("Asks you to scan a QR code", "A QR code hides where the link goes, so you can't check it before it opens", "medium");
  if (ind.offPlatformChat.length) add("Moves the chat to another app", `Wants to continue on ${listOf(pretty(ind.offPlatformChat))}, away from your carrier's spam protection`, "medium");

  if (ind.callbackAlarm) {
    const phone = ind.phones[0];
    const subject = ALARM_SUBJECT.test(text);
    if (ind.claimedOrgs.length && subject)
      add("Unverified callback number", `Asks you to call ${phone} about a problem with your ${ind.claimedOrgs[0]} account. Scammers put their own number in fake alerts, so use the number on your card or the official app instead.`, "high");
    else add("Pushes you to call a number", `Raises an alarm and asks you to call ${phone} right away. Look up the organization's number yourself instead.`, "medium");
  }

  const severe = ind.threats.filter((t) => SEVERE_THREAT.test(t));
  const hasAction = ind.urls.length > 0 || ind.asksToCall || ind.requestsPayment || ind.asksForPersonalInfo;
  if (severe.length && hasAction) add("Threatens a penalty", `Threatens ${listOf(severe.slice(0, 2).map((t) => `"${t}"`))} to rush you into acting`, "medium");
  else if (ind.threats.length) add("Mentions a penalty", `Mentions ${listOf(ind.threats.slice(0, 2).map((t) => `"${t}"`))}`, "low");

  if (ind.urgency.length >= 2 || ind.urgencyCount >= 3) add("Pressure to act fast", `Urgent wording: "${ind.urgency.slice(0, 3).join('", "')}"`, "medium");
  if (ind.capsRatio > 0.6) add("Written in all caps", "Most of the message is in capital letters, a pressure tactic real companies rarely use", "low");
  if (ind.wrongNameGreeting)
    add("Greets someone else", `Opens with "${ind.wrongNameGreeting}", which isn't your name. Many investment scams start with a friendly "wrong number" text.`, "low");

  // Code deliveries and pure notifications: tell the user why it looks fine.
  if (ind.deliversCode && !ind.asksForCode) add("Code delivered, not requested", "It sends you a one-time code and doesn't ask for it back", "low", "safe");
  const asksNothing =
    ind.urls.length === 0 && !ind.asksToCall && !ind.asksForCode && !ind.requestsPayment && !ind.asksForPersonalInfo && !ind.replyYesNo &&
    !ind.qrCode && !ind.offPlatformChat.length && !ind.secrecy && !ind.giftCardPayment && !ind.moveMoney && severe.length === 0 && ind.paymentMethods.length === 0;
  if (asksNothing && ind.claimedOrgs.length && !ind.deliversCode)
    add("Nothing to act on", "It only informs you. There's no link, number to call, payment or request for details.", "medium", "safe");
  return out;
}

const ACTION_RE = /\b(pay|settle|sign in|log ?in|verify|update|confirm|claim|redeem|donate|give|restore|reschedul\w*|choose|start|pague|reclam\w*|verifique)\b/i;

/** Signals that need both the link report and the message: does the link fit who the message claims to be? */
function linkContextSignals(r: LinkReport, ctx: ToolContext): Evidence[] {
  if (r.officialFor || r.impersonates || r.ipAddress || r.punycode) return [];
  const claimed = [ctx.displayName ? findOrg(ctx.displayName)?.org : undefined, ...extractIndicators(ctx.text).claimedOrgs].filter(Boolean)[0];
  if (claimed && !r.shortener)
    return [{ signal: "Link isn't the company's site", detail: `Claims to be ${claimed}, but the link goes to ${r.registrableDomain}, which ${claimed} doesn't own`, weight: "medium", direction: "risk", source: "Trusted directory" }];
  if (r.ageDays === undefined && !r.shortener && ACTION_RE.test(ctx.text))
    return [{ signal: "Unverified link", detail: `Wants you to act through ${r.registrableDomain}, a site I couldn't verify`, weight: "low", direction: "risk", source: "Link analysis" }];
  return [];
}
