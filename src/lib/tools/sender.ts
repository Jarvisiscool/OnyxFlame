import type { Evidence } from "../types";
import { SIMULATED_NUMBERS, SAVED_CONTACTS, type SimNumber } from "@/data/simulated-network";
import { findOrg } from "./directory";
import { extractIndicators } from "./extract";
import { brandCheck, registrable } from "./link";

const SOURCE = "Carrier network signals (simulated)";
const FREE_MAIL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com"];

/** "Reply YES or NO" / "Reply 1 or 2": the format banks use for real fraud alerts, from short codes. */
const YES_NO_RE = /\breply\s+"?(?:yes|y|1)"?\b[^.?!]{0,40}\b(?:no|n|2)\b/i;

/**
 * Who sent this? Carrier intelligence for numbers, domain checks for email, and the
 * phone owner's address book. `text` (redacted) lets it judge whether the sender fits what the message claims.
 */
export function checkSender(sender: string, claimedName?: string, text = "") {
  const digits = sender.replace(/\D/g, "");
  const isEmail = sender.includes("@");
  const rec: SimNumber | undefined = digits && !isEmail ? SIMULATED_NUMBERS[digits] : undefined;
  const signals: Evidence[] = [];
  const textOrgName = text ? extractIndicators(text).claimedOrgs[0] : undefined;
  const textOrg = textOrgName ? findOrg(textOrgName) : undefined;

  if (isEmail) {
    const domain = sender.split("@")[1]?.toLowerCase() ?? "";
    const org = (claimedName ? findOrg(claimedName) : undefined) ?? textOrg;
    const freeMail = FREE_MAIL.includes(domain);
    const brand = freeMail ? {} : brandCheck(domain, registrable(domain));
    if (brand.officialFor && (!org || org.org === brand.officialFor)) {
      signals.push({ signal: "Official sender domain", detail: `Sent from @${domain}, which belongs to ${brand.officialFor}`, weight: "medium", direction: "safe", source: "Sender analysis" });
    }
    if (brand.impersonates) {
      signals.push({ signal: "Lookalike sender address", detail: `The address @${domain} ${brand.lookalikeReason}. It is not ${brand.impersonates}'s real domain.`, weight: "high", direction: "risk", source: "Lookalike detector" });
    }
    if (freeMail && org) {
      signals.push({ signal: "Sender doesn't match brand", detail: `Claims to be ${org.org} but was sent from a personal @${domain} address`, weight: "high", direction: "risk", source: "Sender analysis" });
    } else if (freeMail) {
      signals.push({ signal: "Sent from a personal email", detail: `Sent from a free ${domain} address, which companies don't use for alerts`, weight: "medium", direction: "risk", source: "Sender analysis" });
    } else if (org && !brand.officialFor && !brand.impersonates && !org.domains.some((d) => domain === d || domain.endsWith("." + d))) {
      signals.push({ signal: "Sender doesn't match brand", detail: `Claims to be ${org.org} but the address is @${domain}`, weight: "high", direction: "risk", source: "Sender analysis" });
    }
    return { data: { sender, kind: "email", domain, official: brand.officialFor ?? null }, signals, summary: `email sender @${domain}${brand.officialFor ? ` (official ${brand.officialFor} domain)` : brand.impersonates ? ` (imitates ${brand.impersonates})` : ""}` };
  }

  const kind = rec?.lineType ?? (digits.length >= 5 && digits.length <= 6 ? "short code" : digits.length >= 10 ? "phone number" : "unknown");
  const isShortCode = kind === "short code";
  const saved = SAVED_CONTACTS[digits];

  // The phone's own address book: a scammer on a "new number" can't be in it.
  if (saved) {
    signals.push({ signal: "Saved contact", detail: `This number is saved in your contacts as "${saved}"`, weight: "high", direction: "safe", source: "Your contacts (on device)" });
    return { data: { sender, kind, savedAs: saved }, signals, summary: `${kind}: saved contact "${saved}"` };
  }

  const claimedOrg = (claimedName ? findOrg(claimedName) : undefined) ?? textOrg;
  const registeredOrg = rec?.registeredBusiness ? findOrg(rec.registeredBusiness) : undefined;
  const isRegisteredForClaim = Boolean(claimedOrg && (registeredOrg?.org === claimedOrg.org || rec?.registeredBusiness === claimedOrg.org));

  if (claimedOrg && !isRegisteredForClaim && !isShortCode) {
    signals.push({ signal: "Not a registered sender", detail: `Claims to be ${claimedOrg.org}, but comes from an ordinary phone number that isn't on ${claimedOrg.org}'s registered sender list`, weight: "medium", direction: "risk", source: SOURCE });
  }
  if (claimedOrg && !isRegisteredForClaim && rec?.registeredBusiness && isShortCode) {
    signals.push({ signal: "Not a registered sender", detail: `Claims to be ${claimedOrg.org}, but this short code is registered to ${rec.registeredBusiness}`, weight: "high", direction: "risk", source: SOURCE });
  }
  if (!isShortCode && YES_NO_RE.test(text) && (claimedOrg || /fraud|alert|purchase|charge|payment/i.test(text))) {
    signals.push({ signal: "Fraud-alert format from a regular number", detail: "Banks send \"reply YES or NO\" fraud alerts from short codes, not from an ordinary 10-digit number like this one", weight: "medium", direction: "risk", source: "Sender analysis" });
  }

  if (!rec) {
    if (isShortCode)
      signals.push({ signal: "Business short code", detail: "Sent from a short code. Carriers lease these only to vetted businesses, so scammers rarely use them.", weight: "low", direction: "safe", source: SOURCE });
    return {
      data: { sender, kind, history: "none in network dataset" },
      signals,
      summary: `${kind}: no network history available`,
    };
  }

  if (rec.registeredBusiness && (!claimedOrg || isRegisteredForClaim)) {
    signals.push({ signal: "Registered sender", detail: `This ${rec.lineType} is registered to ${rec.registeredBusiness}`, weight: "high", direction: "safe", source: SOURCE });
  }
  if (rec.attestation === "C") {
    signals.push({ signal: "Caller ID can't be verified", detail: rec.note ?? "The network could not vouch for the caller ID (STIR/SHAKEN level C), a sign of spoofing", weight: "high", direction: "risk", source: SOURCE });
  } else if (rec.attestation === "A") {
    signals.push({ signal: "Caller ID verified", detail: "The network fully verified this caller ID (STIR/SHAKEN level A)", weight: "medium", direction: "safe", source: SOURCE });
  }
  if (rec.numberAgeDays < 30 && !rec.registeredBusiness) {
    signals.push({ signal: "New number", detail: `This number was activated ${rec.numberAgeDays} day${rec.numberAgeDays === 1 ? "" : "s"} ago`, weight: "medium", direction: "risk", source: SOURCE });
  }
  if (rec.lineType === "voip" && !rec.registeredBusiness) {
    signals.push({ signal: "Internet phone number", detail: "VoIP numbers are cheap to create and discard", weight: "low", direction: "risk", source: SOURCE });
  }
  if (rec.lineType === "international" && !rec.registeredBusiness) {
    signals.push({ signal: "Overseas sender", detail: "Sent from an international number while claiming to be a local service", weight: "medium", direction: "risk", source: SOURCE });
  }
  if (!rec.registeredBusiness && rec.distinctRecipients24h > 500) {
    signals.push({ signal: "Mass texting", detail: `Messaged ${rec.distinctRecipients24h.toLocaleString("en-US")} different people in the last 24 hours`, weight: "high", direction: "risk", source: SOURCE });
  }
  if (rec.spamReports7d >= 5) {
    signals.push({ signal: "Reported by others", detail: `${rec.spamReports7d.toLocaleString("en-US")} people reported this sender this week`, weight: "high", direction: "risk", source: SOURCE });
  }

  const summary = [rec.lineType, `${rec.numberAgeDays}d old`, rec.registeredBusiness ? `registered to ${rec.registeredBusiness}` : null, rec.spamReports7d ? `${rec.spamReports7d} reports` : null]
    .filter(Boolean)
    .join(", ");
  return { data: { sender, ...rec }, signals, summary };
}
