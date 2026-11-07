/**
 * Privacy by design: strip personal data BEFORE any text reaches a model.
 * Links, sender numbers and brand names are kept because they are the evidence.
 */

interface Rule {
  kind: string;
  re: RegExp;
  replace: (m: string, ...groups: string[]) => string;
}

function luhn(num: string) {
  const digits = num.replace(/\D/g, "");
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

const RULES: Rule[] = [
  {
    kind: "card number",
    re: /\b(?:\d[ -]?){13,19}\b/g,
    replace: (m) => (luhn(m) ? "[CARD •••• " + m.replace(/\D/g, "").slice(-4) + "]" : m),
  },
  { kind: "SSN", re: /\b\d{3}-\d{2}-\d{4}\b/g, replace: () => "[SSN]" },
  {
    kind: "one-time code",
    re: /\b(code|passcode|pin|otp)(\s*(?:is|:)?\s*)(\d{4,8})\b/gi,
    replace: (_m, word, sep) => `${word}${sep}[CODE]`,
  },
  {
    kind: "account number",
    re: /\b(account|acct|routing)(\s*(?:#|no\.?|number)?\s*:?\s*)(\d{6,17})\b/gi,
    replace: (_m, word, sep, num) => `${word}${sep}[ACCT ••${num.slice(-2)}]`,
  },
  {
    kind: "date of birth",
    re: /\b(dob|date of birth|born)(\s*:?\s*)(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/gi,
    replace: (_m, word, sep) => `${word}${sep}[DOB]`,
  },
  {
    kind: "street address",
    re: /\b\d{2,5}\s+(?:[A-Z][a-z]+\s){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Dr|Drive|Ln|Lane|Ct|Way)\b\.?/g,
    replace: () => "[ADDRESS]",
  },
];

/** Names of the (synthetic) phone owner and family, as an on-device app would know them. */
const KNOWN_NAMES = ["Maria", "Maria Lopez", "Sofia", "Sofia Lopez"];

export interface RedactionResult {
  redacted: string;
  items: { kind: string; count: number }[];
}

export function redact(text: string): RedactionResult {
  let out = text;
  const counts = new Map<string, number>();
  for (const rule of RULES) {
    out = out.replace(rule.re, (...args) => {
      const m = args[0] as string;
      const groups = args.slice(1, -2) as string[];
      const replaced = rule.replace(m, ...groups);
      if (replaced !== m) counts.set(rule.kind, (counts.get(rule.kind) ?? 0) + 1);
      return replaced;
    });
  }
  for (const name of [...KNOWN_NAMES].sort((a, b) => b.length - a.length)) {
    const re = new RegExp(`\\b${name}\\b`, "g");
    out = out.replace(re, () => {
      counts.set("personal name", (counts.get("personal name") ?? 0) + 1);
      return "[NAME]";
    });
  }
  return { redacted: out, items: [...counts].map(([kind, count]) => ({ kind, count })) };
}
