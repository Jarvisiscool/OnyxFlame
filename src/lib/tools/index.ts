import type { Evidence } from "../types";
import type { ToolSchema } from "../nemotron";
import { extractIndicators } from "./extract";
import { checkLink } from "./link";
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
        ind.paymentMethods.length ? `payment: ${ind.paymentMethods.join(", ")}` : null,
        ind.asksForCode ? "asks for a code" : null,
        ind.deliversCode ? "delivers a one-time code" : null,
        ind.secrecy ? "asks for secrecy" : null,
      ].filter(Boolean);
      const signals: Evidence[] = [];
      if (ind.asksForCode)
        signals.push({ signal: "Asks for your code", detail: "Requests a verification code or PIN, which no legitimate company does", weight: "high", direction: "risk", source: "Message analysis" });
      if (ind.secrecy)
        signals.push({ signal: "Asks for secrecy", detail: "Tells you not to talk to anyone about it, a classic isolation tactic", weight: "high", direction: "risk", source: "Message analysis" });
      const moveMoney = ind.paymentMethods.filter((p) => p.endsWith("account"));
      const payRails = ind.paymentMethods.filter((p) => !p.endsWith("account"));
      if (moveMoney.length)
        signals.push({ signal: "Asks you to move money", detail: `Wants your money moved into a "${moveMoney[0]}". Real banks never ask this.`, weight: "high", direction: "risk", source: "Message analysis" });
      if (payRails.length)
        signals.push({ signal: "Hard-to-reverse payment", detail: `Asks for payment by ${payRails.join(", ")}, which is almost impossible to get back`, weight: "medium", direction: "risk", source: "Message analysis" });
      if (ind.urgency.length >= 2)
        signals.push({ signal: "Pressure to act fast", detail: `Urgent wording: "${ind.urgency.slice(0, 3).join('", "')}"`, weight: "medium", direction: "risk", source: "Message analysis" });
      return { summary: parts.join(" · "), signals, data: ind };
    }
    case "check_link": {
      const url = String(args.url ?? "");
      if (!url) return { summary: "no url given", signals: [], data: null };
      const r = await checkLink(url);
      return { summary: r.summary, signals: r.signals, data: r.report };
    }
    case "check_sender": {
      const sender = String(args.sender ?? ctx.from);
      const r = checkSender(sender, (args.claimed_name as string) || ctx.displayName);
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
