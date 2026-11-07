import type { Evidence } from "../types";
import { SIMULATED_NUMBERS, type SimNumber } from "@/data/simulated-network";
import { findOrg } from "./directory";

const SOURCE = "Carrier network signals (simulated)";

export function checkSender(sender: string, claimedName?: string) {
  const digits = sender.replace(/\D/g, "");
  const isEmail = sender.includes("@");
  const rec: SimNumber | undefined = digits ? SIMULATED_NUMBERS[digits] : undefined;
  const signals: Evidence[] = [];

  if (isEmail) {
    const domain = sender.split("@")[1]?.toLowerCase() ?? "";
    const org = claimedName ? findOrg(claimedName) : undefined;
    const freeMail = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com"].includes(domain);
    if (freeMail) signals.push({ signal: "Text sent from a personal email", detail: `Sent from a free ${domain} address, which companies don't use for alerts`, weight: "medium", direction: "risk", source: "Sender analysis" });
    if (org && !org.domains.some((d) => domain === d || domain.endsWith("." + d))) {
      signals.push({ signal: "Sender doesn't match brand", detail: `Claims to be ${org.org} but the address is @${domain}`, weight: "high", direction: "risk", source: "Sender analysis" });
    }
    return { data: { sender, kind: "email", domain }, signals, summary: `email sender @${domain}` };
  }

  const claimedOrg = claimedName ? findOrg(claimedName) : undefined;
  const registeredOrg = rec?.registeredBusiness ? findOrg(rec.registeredBusiness) : undefined;
  if (claimedOrg && registeredOrg?.org !== claimedOrg.org && rec?.registeredBusiness !== claimedOrg.org) {
    signals.push({ signal: "Not a registered sender", detail: `Claims to be ${claimedOrg.org}, but this number isn't on ${claimedOrg.org}'s registered sender list`, weight: "medium", direction: "risk", source: SOURCE });
  }

  if (!rec) {
    const kind = digits.length >= 5 && digits.length <= 6 ? "short code" : digits.length >= 10 ? "phone number" : "unknown";
    return {
      data: { sender, kind, history: "none in network dataset" },
      signals,
      summary: `${kind}: no network history available`,
    };
  }

  if (rec.registeredBusiness) {
    const claimed = claimedName ? findOrg(claimedName) : undefined;
    const reg = findOrg(rec.registeredBusiness);
    if (!claimed || !reg || claimed.org === reg.org) {
      signals.push({ signal: "Registered sender", detail: `This ${rec.lineType} is registered to ${rec.registeredBusiness}`, weight: "high", direction: "safe", source: SOURCE });
    }
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
