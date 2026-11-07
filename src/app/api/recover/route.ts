import { chat, extractJson, hasNvidiaKey, DEEP_MODEL } from "@/lib/nemotron";
import { redact } from "@/lib/redact";
import type { InboxMessage, RecoveryPlan, RecoveryStep, Verdict, WhatHappened } from "@/lib/types";

export const maxDuration = 60;

const HAPPENED: Record<WhatHappened, string> = {
  clicked_link: "clicked the link but did not type anything",
  entered_info: "entered personal or login information on the site",
  sent_money: "sent money",
  shared_code: "shared a verification code or PIN",
  called_back: "called the number back and talked to them",
};

const SYSTEM = `You help someone who just responded to a scam. Be calm, specific and fast. Output JSON only:
{"urgency":"critical"|"high"|"moderate","summary":"one sentence","steps":[{"title":"max 6 words","detail":"1-2 sentences, concrete","when":"now"|"today"|"this week"}],"reportDraft":"a short factual first-person report for reportfraud.ftc.gov with [placeholders] for details you don't know"}
Rules: 4-6 steps, most urgent first. Contact organizations only through the official contact given, never numbers from the scam. Money sent by Zelle, wire, gift card or crypto: call the bank or card issuer immediately. Shared codes: secure the account and ask the carrier for SIM/port-out protection. Entered info: change passwords, turn on 2-step verification, consider a credit freeze. Always: forward scam texts to 7726 and report at reportfraud.ftc.gov.`;

function fallback(what: WhatHappened, v: Verdict): RecoveryPlan {
  const org = v.verifyContact;
  const steps: RecoveryStep[] = [];
  if (what === "sent_money")
    steps.push({ title: "Call your bank right now", detail: "Use the number on the back of your card. Say you were scammed and ask them to stop or recall the payment and open a fraud claim.", when: "now" });
  if (what === "shared_code")
    steps.push(
      { title: "Lock down the account", detail: "Sign in through the official app, change the password, and sign out of all other devices.", when: "now" },
      { title: "Protect your phone number", detail: "Dial 611 (T-Mobile) or your carrier and ask for SIM and port-out protection so nobody can move your number.", when: "now" },
    );
  if (what === "entered_info")
    steps.push(
      { title: "Change exposed passwords", detail: "Change the password you typed, and anywhere else you reuse it. Turn on 2-step verification.", when: "now" },
      { title: "Freeze your credit", detail: "Freezes at Equifax, Experian and TransUnion are free and stop new accounts in your name.", when: "today" },
    );
  if (what === "clicked_link")
    steps.push({ title: "Close the page, don't type anything", detail: "Just opening the link rarely causes harm. Update your phone's software and don't revisit the site.", when: "now" });
  if (what === "called_back")
    steps.push({ title: "Hang up and don't call back", detail: "If they call again, don't answer. Anything you told them should be treated as exposed.", when: "now" });
  if (org) steps.push({ title: `Confirm with the real ${org.org}`, detail: org.how + ".", when: "today" });
  steps.push(
    { title: "Report the text", detail: "Forward the message to 7726 (SPAM) so carriers can block the sender for everyone.", when: "today" },
    { title: "File an FTC report", detail: "Report at reportfraud.ftc.gov. You'll need it for bank disputes.", when: "this week" },
  );
  return {
    urgency: what === "sent_money" || what === "shared_code" ? "critical" : what === "entered_info" ? "high" : "moderate",
    summary: `You ${HAPPENED[what]}. Here's what to do, most urgent first.`,
    steps: steps.slice(0, 6),
    reportDraft: `On [date], I received a ${v.scamType.toLowerCase()} message claiming to be ${org?.org ?? "a company"}. I ${HAPPENED[what]}. ${
      what === "sent_money" ? "I sent [amount] via [payment method] to [recipient details]. " : ""
    }The message came from [sender number] and contained [link/phone]. I am reporting this so it can be investigated.`,
    source: "offline",
  };
}

export async function POST(req: Request) {
  const { message, verdict, what } = (await req.json()) as { message: InboxMessage; verdict: Verdict; what: WhatHappened };
  if (!message || !verdict || !(what in HAPPENED)) return Response.json({ error: "message, verdict and what are required" }, { status: 400 });

  if (!hasNvidiaKey()) return Response.json(fallback(what, verdict));
  try {
    const res = await chat({
      model: DEEP_MODEL,
      maxTokens: 1800,
      temperature: 0.3,
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Scam message (redacted): """${redact(message.body).redacted}"""
Sender: ${message.from}
Investigation verdict: ${verdict.scamType}: ${verdict.explanation}
Official contact: ${verdict.verifyContact ? `${verdict.verifyContact.org}: ${verdict.verifyContact.how}` : "none identified"}
What the person did: they ${HAPPENED[what]}.`,
        },
      ],
    });
    const j = extractJson<RecoveryPlan>(res.content || res.reasoning);
    if (!j?.steps?.length) return Response.json(fallback(what, verdict));
    return Response.json({ ...j, steps: j.steps.slice(0, 6), source: "live" } satisfies RecoveryPlan);
  } catch {
    return Response.json(fallback(what, verdict));
  }
}
