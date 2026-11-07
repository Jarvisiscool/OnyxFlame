import type { InboxMessage } from "@/lib/types";

/**
 * Synthetic demo messages for "Maria Lopez", a T-Mobile customer in Richardson, TX.
 * All numbers use fictional 555 ranges; all scam domains are invented.
 * Delivered one at a time in this order during the demo.
 */
export const DEMO_INBOX: Omit<InboxMessage, "receivedAt">[] = [
  {
    id: "toll",
    channel: "sms",
    from: "+63 915 555 0198",
    body: "NTTA Notice: Your TollTag account has an unpaid toll balance of $6.89. Pay by tonight to avoid a $50 late fee and suspension of your vehicle registration: https://ntta-tollpay.top/pay",
    label: "scam",
  },
  {
    id: "otp",
    channel: "sms",
    from: "73981",
    displayName: "Amazon",
    body: "Your Amazon verification code is 482913. Don't share this code with anyone. We will never ask for it.",
    label: "legit",
  },
  {
    id: "safe_account",
    channel: "voicemail",
    from: "+1 (877) 555-0199",
    displayName: "PNC Bank",
    body: "Hello, this is Daniel with the PNC Fraud Prevention team. We flagged unusual activity on your checking account. To protect your funds, you'll need to move your balance into a secure holding account we've set up for you. Call us back immediately at 877-555-0199. For your safety, do not discuss this with branch staff, as an internal investigation is underway.",
    label: "scam",
  },
  {
    id: "bill",
    channel: "sms",
    from: "52466",
    displayName: "T-Mobile",
    body: "T-Mobile: Hi Maria, your bill for $85.00 is ready. Autopay will run on 11/14. See details at t-mobile.com/bill. No reply needed.",
    label: "legit",
  },
  {
    id: "sim_swap",
    channel: "sms",
    from: "+1 (972) 555-0164",
    body: "Hi Maria, this is Jake from T-Mobile Support. We're upgrading your SIM to our new 5G network today. You'll get a 6-digit code in a minute. Please reply with it so I can finish activation, or your service will be interrupted.",
    label: "scam",
  },
  {
    id: "wrong_number",
    channel: "sms",
    from: "+1 (646) 555-0121",
    body: "Hi Emily, is this still your number? It's Grace from the yoga studio 😊 are we still on for brunch Saturday?",
    label: "suspicious",
  },
  {
    id: "family",
    channel: "sms",
    from: "+1 (214) 555-0186",
    body: "Hi Mom it's me, I dropped my phone in the toilet 😩 this is my new number. Can you help me pay a bill today? It's urgent, I'll pay you back tomorrow. Can you send $480 by Zelle?",
    label: "scam",
  },
  {
    id: "reward",
    channel: "sms",
    from: "+1 (213) 555-0117",
    body: "T-Mobile Rewards: Maria, your 12,400 loyalty points ($250 value) expire TONIGHT. Redeem before 11:59 PM: t-mobile-rewards.club/claim",
    label: "scam",
  },
  {
    id: "clinic",
    channel: "sms",
    from: "+1 (972) 555-0100",
    displayName: "Richardson Family Clinic",
    body: "Reminder: Sofia has an appointment with Dr. Patel on Tue 11/10 at 2:30 PM. Reply C to confirm or R to reschedule.",
    label: "legit",
  },
];
