/**
 * Regression test for the stage demo: every demo-inbox message must get the
 * expected verdict in offline mode, read cleanly, and be redacted properly.
 *
 *   npm run test:demo
 *
 * Exits non-zero on any failure.
 */
process.env.SECONDLOOK_NO_RDAP ??= "1";

import { runAnalysis } from "@/lib/agent";
import { redact } from "@/lib/redact";
import { DEMO_INBOX } from "@/data/demo-inbox";
import type { AgentEvent, Risk } from "@/lib/types";

const EXPECTED: Record<string, Risk> = {
  toll: "scam",
  otp: "safe",
  safe_account: "scam",
  bill: "safe",
  sim_swap: "scam",
  wrong_number: "suspicious",
  family: "scam",
  reward: "scam",
  clinic: "safe",
};

/** Doubled punctuation that slips in when sentences are joined: "..", ". .", ",.", ".," etc. */
const DOUBLED = /\.\s*\.|,\s*[.,]|\.\s*,|[!?]\s*\.|\.\s*[!?]/;

const failures: string[] = [];
const fail = (id: string, why: string) => failures.push(`${id}: ${why}`);

(async () => {
  for (const id of Object.keys(EXPECTED)) {
    if (!DEMO_INBOX.some((m) => m.id === id)) fail(id, "missing from demo-inbox.ts");
  }

  for (const m of DEMO_INBOX) {
    const events: AgentEvent[] = [];
    const v = await runAnalysis({ ...m, receivedAt: "", label: undefined }, (e) => events.push(e), { forceOffline: true, pace: false });
    const want = EXPECTED[m.id];
    const line = `${m.id.padEnd(13)} ${v.risk.padEnd(10)} ${String(Math.round(v.confidence * 100)).padStart(3)}%  ${v.headline}`;
    console.log(line);

    if (want && v.risk !== want) fail(m.id, `expected ${want}, got ${v.risk}`);
    for (const [field, text] of [["headline", v.headline], ["explanation", v.explanation]] as const) {
      // Ellipsis "…" is fine; two ASCII periods in a row are not. Ignore decimals like $6.89.
      const cleaned = text.replace(/\d\.\d/g, "0");
      if (DOUBLED.test(cleaned)) fail(m.id, `doubled punctuation in ${field}: "${text}"`);
      if (!text.trim()) fail(m.id, `empty ${field}`);
    }
    for (const e of v.evidence) {
      if (/\.\s*\.$/.test(e.detail)) fail(m.id, `evidence detail ends with doubled period: "${e.detail}"`);
    }
    if (v.confidence < 0 || v.confidence > 1) fail(m.id, `confidence out of range: ${v.confidence}`);

    // Redaction: what the models see must not contain the code or the owner's family names.
    const redEvent = events.find((e) => e.type === "redaction");
    const redacted = redEvent && redEvent.type === "redaction" ? redEvent.redacted : redact(m.body).redacted;
    for (const name of ["Bob", "Sofia"]) {
      if (m.body.includes(name) && redacted.includes(name)) fail(m.id, `name "${name}" not redacted`);
    }
    if (m.id === "otp") {
      const code = m.body.match(/\b\d{6}\b/)?.[0];
      if (!code) fail(m.id, "test setup: no 6-digit code in OTP message");
      else if (redacted.includes(code)) fail(m.id, `one-time code ${code} not redacted`);
      if (!redacted.includes("[CODE]")) fail(m.id, "OTP message has no [CODE] placeholder after redaction");
    }
    // The verdict text itself must not leak redacted values either.
    const out = `${v.headline} ${v.explanation} ${v.evidence.map((e) => e.detail).join(" ")}`;
    if (m.id === "otp" && /\b482913\b/.test(out)) fail(m.id, "verdict text leaks the one-time code");
    if (/\b(Bob|Sofia)\b/.test(out)) fail(m.id, "verdict text leaks a redacted name");
  }

  // Redaction unit checks (independent of the demo copy).
  const r = redact("Hi Bob Lopez, your code is 551203. Sofia's PIN: 4417. Card 4111 1111 1111 1111.");
  for (const leak of ["Bob", "Lopez", "Sofia", "551203", "4417", "4111 1111 1111 1111"]) {
    if (r.redacted.includes(leak)) fail("redact()", `"${leak}" survived redaction → ${r.redacted}`);
  }

  if (failures.length) {
    console.error(`\n✗ ${failures.length} failure${failures.length > 1 ? "s" : ""}:\n  ` + failures.join("\n  "));
    process.exit(1);
  }
  console.log(`\n✓ demo inbox: ${DEMO_INBOX.length} messages, all verdicts, wording and redaction checks pass`);
})();
