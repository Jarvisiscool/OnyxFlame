import type { Lesson } from "@/lib/types";

/**
 * Offline practice lessons. Synthetic only: every number uses a fictional 555 range,
 * every scam domain is invented, and brands are generic ("Your bank") or made up.
 * With an API key, Nemotron writes a fresh lesson tailored to what reached the family's lines.
 */
export const LESSONS: Lesson[] = [
  {
    id: "toll",
    topic: "Unpaid toll text",
    lesson: {
      title: "Spot a fake toll text",
      points: [
        "Toll agencies send bills to your address or account. They don't collect payment through a link in a text.",
        "The amount is small on purpose ($3 to $12) so paying feels easier than checking.",
        "A tight deadline plus a scary penalty (late fee, registration suspension) is the rush that makes you skip a second look.",
      ],
      example: "Toll Services: Unpaid balance of $4.15. Pay by 11:59 PM to avoid a $40 fee: tollpay-notice.top/dfw",
    },
    questions: [
      {
        id: "t1",
        type: "scam_or_legit",
        channel: "sms",
        from: "+1 (469) 555-0142",
        body: "Toll Services Notice: you have an outstanding toll of $5.30. Pay within 12 hours to avoid a $45 penalty: paytoll-dfw.info/pay",
        answer: "scam",
        tells: ["paytoll-dfw.info", "within 12 hours", "$45 penalty"],
        explanation: "An ordinary phone number, an invented payment site and a 12-hour deadline. Real toll bills come by mail or in your toll account.",
      },
      {
        id: "t2",
        type: "mcq",
        channel: "sms",
        from: "+63 917 555 0175",
        body: "FINAL NOTICE: Your toll account is past due ($7.12). Registration hold begins tomorrow. Resolve now: ntta-billing.top/r",
        prompt: "What's the strongest sign this isn't your toll agency?",
        options: ["It mentions a dollar amount", "The link is not the agency's own website", "It says FINAL NOTICE", "It was sent in the evening"],
        answer: "The link is not the agency's own website",
        tells: ["ntta-billing.top", "Registration hold begins tomorrow", "+63"],
        explanation: "Anyone can write FINAL NOTICE. A lookalike web address, sent from an overseas number, is the giveaway. Type the agency's site yourself instead.",
      },
      {
        id: "t3",
        type: "scam_or_legit",
        channel: "email",
        look: "gmail",
        from: "Toll Account <no-reply@yourtollaccount.example>",
        subject: "Your monthly toll statement is ready",
        body: "Your November statement is ready. Sign in to your toll account to view it. We never ask for card numbers by email or text.",
        answer: "legit",
        tells: ["Sign in to your toll account", "never ask for card numbers"],
        explanation: "No link to pay, no deadline, no threat. It sends you to sign in the way you normally do, which is what real statements look like.",
      },
      {
        id: "t4",
        type: "scam_or_legit",
        channel: "voicemail",
        from: "+1 (214) 555-0193",
        body: "This is the toll enforcement office. Your vehicle has unpaid violations and a warrant may be issued. Press 1 or call back at 214-555-0193 today to settle by gift card.",
        answer: "scam",
        tells: ["warrant may be issued", "settle by gift card", "call back"],
        explanation: "No toll agency takes gift cards, and none threatens arrest by voicemail. Gift card plus threat is a scam every time.",
      },
      {
        id: "t5",
        type: "mcq",
        channel: "sms",
        from: "+1 (972) 555-0108",
        body: "Toll reminder: $3.95 is due. Avoid suspension of your license, pay by tonight: tollroad-pay.vip",
        prompt: "You're worried it might be real. What's the safest move?",
        options: ["Tap the link and check the page", "Reply STOP", "Open your toll app or type the agency's site yourself", "Pay it, it's only $3.95"],
        answer: "Open your toll app or type the agency's site yourself",
        tells: ["tollroad-pay.vip", "pay by tonight", "suspension of your license"],
        explanation: "Going to the source yourself answers the question without touching the scam. Replying confirms your number is active.",
      },
    ],
    flashcards: [
      { front: "Toll text with a payment link", back: "Real toll agencies don't collect by text link. Sign in at the agency's site yourself." },
      { front: "\"Pay by tonight\" or \"within 12 hours\"", back: "Manufactured rush. Real bills give weeks, not hours." },
      { front: "Tiny amount, big penalty", back: "$5 now or $50 later is bait. The goal is your card number." },
      { front: "Web address like toll-pay.top", back: "Lookalike domain. Check what's right before .com/.org/.top." },
      { front: "Gift cards or warrants on a voicemail", back: "Always a scam. Hang up and don't call back." },
    ],
  },
  {
    id: "email",
    topic: "Email phishing",
    lesson: {
      title: "Phishing in Gmail and Outlook",
      points: [
        "Check the address after the name: \"Your Bank\" can be sent from anything, like alerts@yourbank-secure.info.",
        "Hover or long-press a button to see where it really goes before you tap.",
        "\"Unusual sign-in\", \"mailbox full\" and \"invoice attached\" are the three most common hooks. Open the app yourself instead.",
      ],
      example: "From: Your Bank <security@yourbank-verify.info> · Subject: Unusual sign-in blocked · \"Confirm your identity within 24 hours or your account will be locked.\"",
    },
    questions: [
      {
        id: "e1",
        type: "scam_or_legit",
        channel: "email",
        look: "gmail",
        from: "Your Bank Security <security@yourbank-verify.info>",
        subject: "Unusual sign-in blocked",
        body: "We blocked a sign-in from a new device. Confirm your identity within 24 hours or online access will be locked. [Confirm identity]",
        answer: "scam",
        tells: ["yourbank-verify.info", "within 24 hours", "will be locked"],
        explanation: "The display name says your bank, but the address is an invented lookalike. Open your bank's app directly to check for alerts.",
      },
      {
        id: "e2",
        type: "mcq",
        channel: "email",
        look: "outlook",
        from: "IT Help Desk <helpdesk@mail-quota-admin.online>",
        subject: "Mailbox 98% full: action required",
        body: "Your mailbox has reached its limit. Incoming messages will be rejected after 6 PM today. Sign in here to keep your email: [Keep my mailbox]",
        prompt: "Which detail gives this away fastest?",
        options: ["The subject has a percentage", "The sender's domain isn't your organization's", "It mentions 6 PM", "It uses a button"],
        answer: "The sender's domain isn't your organization's",
        tells: ["mail-quota-admin.online", "after 6 PM today", "Sign in here"],
        explanation: "Your real help desk writes from your organization's own domain. A sign-in button in a 'mailbox full' email is a password trap.",
      },
      {
        id: "e3",
        type: "scam_or_legit",
        channel: "email",
        look: "outlook",
        from: "Parcelly <updates@parcelly.example>",
        subject: "Your order has shipped",
        body: "Good news: order #4471 shipped today and should arrive Thursday. Track it any time in the Parcelly app. No action needed.",
        answer: "legit",
        tells: ["No action needed", "in the Parcelly app"],
        explanation: "It matches an order you'd expect, asks for nothing and points you to the app. Shipping updates like this are normal.",
      },
      {
        id: "e4",
        type: "scam_or_legit",
        channel: "sms",
        from: "+1 (817) 555-0166",
        body: "Your Bank: A $1,240.00 Zelle payment is pending. If this wasn't you, reply NO and our fraud team will call you.",
        answer: "scam",
        tells: ["reply NO", "fraud team will call you", "$1,240.00"],
        explanation: "Replying starts a call from a fake 'fraud team' who will ask you to move money. Call the number on the back of your card instead.",
      },
      {
        id: "e5",
        type: "mcq",
        channel: "email",
        look: "gmail",
        from: "Accounts Payable <billing@invoice-share.top>",
        subject: "Invoice #88213 overdue",
        body: "Please see the attached invoice. Payment is overdue and will be sent to collections Friday. Open the shared document to review: [View invoice]",
        prompt: "You don't recognize this invoice. What should you do?",
        options: ["Open the document to see what it is", "Reply asking who they are", "Delete it, or contact the company through its real site", "Forward it to a coworker to check"],
        answer: "Delete it, or contact the company through its real site",
        tells: ["invoice-share.top", "sent to collections Friday", "Open the shared document"],
        explanation: "Surprise invoices with a 'view document' button usually lead to a fake sign-in page. Don't engage with the sender at all.",
      },
    ],
    flashcards: [
      { front: "Display name says \"Your Bank\"", back: "Look at the address after it. The name can be anything." },
      { front: "Button that says Confirm / Keep mailbox / View invoice", back: "Long-press or hover first. If it isn't the real domain, don't tap." },
      { front: "\"Within 24 hours or your account is locked\"", back: "Pressure tactic. Open the app yourself to check." },
      { front: "\"Reply NO if this wasn't you\"", back: "A setup for a fake fraud-team call. Use the number on your card." },
      { front: "Surprise invoice from someone you don't know", back: "Don't open it. Contact the company through its real site." },
    ],
  },
];

/** Pick the offline lesson that best matches the scam types that reached the family. */
export function pickLesson(seenTypes: string[]): Lesson {
  const s = seenTypes.join(" ").toLowerCase();
  if (/toll/.test(s)) return LESSONS[0];
  if (/email|phish|bank|invoice|sign-in|safe account/.test(s)) return LESSONS[1];
  return LESSONS[0];
}
