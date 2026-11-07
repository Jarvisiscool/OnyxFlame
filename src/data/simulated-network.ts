/**
 * SIMULATED network intelligence. Everything here is synthetic.
 *
 * A carrier already sees these signals (number age, line type, STIR/SHAKEN
 * caller-ID attestation, sending volume, spam reports). Second Look defines the
 * API shape and fakes the data so the agent can reason over it in the demo.
 */

export interface SimDomain {
  ageDays: number;
  registrar: string;
}

export const SIMULATED_REGISTRY: Record<string, SimDomain> = {
  "ntta-tollpay.top": { ageDays: 2, registrar: "NameSilo-like budget registrar (synthetic)" },
  "t-mobile-rewards.club": { ageDays: 4, registrar: "Offshore privacy registrar (synthetic)" },
  "usps-redelivery.info": { ageDays: 6, registrar: "Budget registrar (synthetic)" },
  "pnc-secure-verify.com": { ageDays: 11, registrar: "Privacy-protected registrar (synthetic)" },
  "amaz0n-orders.shop": { ageDays: 3, registrar: "Budget registrar (synthetic)" },
  "taskhub-earn.vip": { ageDays: 17, registrar: "Offshore registrar (synthetic)" },
  "irs-refund-portal.online": { ageDays: 9, registrar: "Budget registrar (synthetic)" },
  "applecare-id.support": { ageDays: 5, registrar: "Budget registrar (synthetic)" },
  "richardsonclinic.org": { ageDays: 4300, registrar: "Established registrar (synthetic)" },
};

export interface SimNumber {
  lineType: "mobile" | "voip" | "landline" | "short code" | "international";
  numberAgeDays: number;
  /** STIR/SHAKEN caller-ID attestation: A = verified, C = cannot vouch for caller ID */
  attestation?: "A" | "B" | "C";
  messages24h: number;
  distinctRecipients24h: number;
  spamReports7d: number;
  registeredBusiness?: string;
  note?: string;
}

const N = (n: string) => n.replace(/\D/g, "");

export const SIMULATED_NUMBERS: Record<string, SimNumber> = {
  [N("+63 915 555 0198")]: { lineType: "international", numberAgeDays: 1, messages24h: 41200, distinctRecipients24h: 40980, spamReports7d: 1873, note: "Bulk sender pattern" },
  [N("+1 (213) 555-0117")]: { lineType: "voip", numberAgeDays: 3, messages24h: 8800, distinctRecipients24h: 8790, spamReports7d: 412 },
  [N("52466")]: { lineType: "short code", numberAgeDays: 2900, messages24h: 950000, distinctRecipients24h: 949000, spamReports7d: 2, registeredBusiness: "T-Mobile" },
  [N("+1 (972) 555-0164")]: { lineType: "voip", numberAgeDays: 9, messages24h: 63, distinctRecipients24h: 61, spamReports7d: 27 },
  [N("+1 (877) 555-0199")]: { lineType: "voip", numberAgeDays: 14, attestation: "C", messages24h: 0, distinctRecipients24h: 380, spamReports7d: 96, note: "Caller ID shows 'PNC Bank' but the number is not registered to PNC" },
  [N("+1 (646) 555-0121")]: { lineType: "voip", numberAgeDays: 21, messages24h: 140, distinctRecipients24h: 138, spamReports7d: 3 },
  [N("73981")]: { lineType: "short code", numberAgeDays: 3100, messages24h: 2400000, distinctRecipients24h: 2390000, spamReports7d: 0, registeredBusiness: "Amazon" },
  [N("+1 (214) 555-0186")]: { lineType: "voip", numberAgeDays: 2, messages24h: 35, distinctRecipients24h: 35, spamReports7d: 8 },
  [N("+1 (972) 555-0100")]: { lineType: "landline", numberAgeDays: 4200, attestation: "A", messages24h: 210, distinctRecipients24h: 205, spamReports7d: 0, registeredBusiness: "Richardson Family Clinic" },
};

/**
 * The phone owner's address book (synthetic), as an on-device app would see it.
 * A text from a saved contact is shown with the contact's name; a scammer on a
 * "new number" cannot appear here. Keys are digits only.
 */
export const SAVED_CONTACTS: Record<string, string> = {
  [N("+1 (972) 555-0122")]: "Mom",
  [N("+1 (972) 555-0133")]: "Dad",
  [N("+1 (972) 555-0199")]: "Tía Carmen",
  [N("+1 (972) 555-0155")]: "Sis",
};
