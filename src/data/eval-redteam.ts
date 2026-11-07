import type { InboxMessage } from "@/lib/types";

/**
 * RED-TEAM set: written AFTER detection tuning, by the same author, deliberately aimed at
 * the weak spots of the rules (scams without the usual keywords, legit messages that use
 * scam vocabulary). Committed before it was ever run and never tuned on.
 *
 * The holdout (eval-holdout.ts) was written before tuning, but by the same person who then
 * wrote the rules, so it overstates real-world performance. This set is the stress test.
 * All synthetic: fictional 555-01XX numbers, invented domains, no real people.
 */
type E = Omit<InboxMessage, "receivedAt" | "channel"> & { channel?: InboxMessage["channel"]; label: "scam" | "legit" };

export const REDTEAM_SET: E[] = [
  // ---- scams written to dodge the rules ----
  { id: "r01", from: "+1 (469) 555-0110", body: "Hi, this is Amy from the front desk at your building. Management needs this month's parking permit fee of $35 by tonight. You can Zelle it to amy.parking@gmail.com", label: "scam" },
  { id: "r02", from: "+1 (469) 555-0111", body: "Amazon order #113-5520 for $849.99 confirmed. Questions about this order? Call 1-888-555-0133.", label: "scam" },
  { id: "r03", from: "+1 (469) 555-0112", body: "Thanks for connecting on LinkedIn! I manage a small fund for friends and family. Happy to share how we've grown 12% monthly, no pressure at all.", label: "scam" },
  { id: "r04", from: "+1 (469) 555-0113", body: "I miss you so much. The bank froze my account while I'm on the oil rig. Could you help with $2,000 for the release fee? I'll repay you as soon as I'm back.", label: "scam" },
  { id: "r05", from: "+1 (469) 555-0114", body: "USPS: Your item is pending. Details: https://tinyurl.com/usps-item82", label: "scam" },
  { id: "r06", channel: "voicemail", from: "+1 (469) 555-0115", body: "Hello, this is the Microsoft technical department. We detected your computer sending error messages to our servers. Please press 1 to speak with a technician.", label: "scam" },
  { id: "r07", from: "+1 (469) 555-0116", body: "Collin County Court: You failed to appear for jury service on 11/02. A fine of $500 is owed. Pay by phone at 469-555-0177 to avoid further action.", label: "scam" },
  { id: "r08", from: "+1 (469) 555-0117", body: "You were randomly selected for a free 2-night stay in Cancun! Reply YES to claim your vacation package.", label: "scam" },
  { id: "r09", from: "+1 (469) 555-0118", body: "Hey it's your neighbor Dan, I'm at the store and my card got declined. Could you grab a couple of Steam cards for my nephew's birthday? I'll pay you back tonight", label: "scam" },
  { id: "r10", channel: "voicemail", from: "+1 (713) 555-0160", body: "Llamada del Servicio de Impuestos. Usted tiene una deuda pendiente. Si no paga hoy, se emitirá una orden de arresto. Llame al 713-555-0160.", label: "scam" },
  { id: "r11", from: "+1 (469) 555-0119", body: "Congrats! You've been approved for the Remote Customer Support role. Please reply with your full name, address and SSN to set up payroll.", label: "scam" },
  { id: "r12", from: "+1 (469) 555-0120", body: "Hi! The studio is $700/mo all bills paid. Lots of people are interested so whoever sends the deposit first gets it. I can send the lease after.", label: "scam" },
  { id: "r13", from: "+1 (469) 555-0121", body: "T-Mobile here. To complete your eSIM transfer, please read us the 6 digits we just sent you.", label: "scam" },
  { id: "r14", from: "+1 (469) 555-0122", body: "FedEx: Your package is held at our facility. Visit fedex.com.track-parcel.help to pay the $1.95 handling charge.", label: "scam" },

  // ---- legitimate messages that use scam vocabulary ----
  { id: "q01", from: "24273", displayName: "Chase", body: "Chase: Did you make a $1,200.00 transfer to Ana R.? Reply Y or N. Chase will never ask you for your password.", label: "legit" },
  { id: "q02", from: "75762", displayName: "PNC Bank", body: "PNC: Your account is temporarily locked after 3 failed sign-in attempts. To unlock it, sign in at pnc.com or open the PNC app.", label: "legit" },
  { id: "q03", from: "+1 (469) 555-0130", body: "Spectrum: Your internet will be down for scheduled maintenance tonight from 12am to 5am. We apologize for the inconvenience.", label: "legit" },
  { id: "q04", channel: "email", from: "no-reply@irs.gov", displayName: "IRS", body: "Your IRS online account was accessed from a new device. If this wasn't you, sign in at irs.gov/account to review your security settings.", label: "legit" },
  { id: "q05", from: "+1 (972) 555-0131", body: "You have a new message from Dr. Kim in your patient portal. Log in at mychart.richardsonclinic.org to read it.", label: "legit" },
  { id: "q06", from: "+1 (972) 555-0132", body: "Coach Rivera: Tournament fees ($40) are due Friday. Please Venmo @CoachRivera or bring cash to practice.", label: "legit" },
  { id: "q07", channel: "email", from: "alerts@chase.com", displayName: "Chase", body: "Your wire transfer of $3,500.00 to Lone Star Title has been sent. If you have questions, call the number on the back of your card.", label: "legit" },
  { id: "q08", from: "87283", body: "Plano ISD: Your student's lunch account balance is low ($2.15). Add funds through the parent portal.", label: "legit" },
  { id: "q09", from: "73981", displayName: "Amazon", body: "Amazon: Your refund of $34.99 for 'USB-C cable' has been issued to your original payment method.", label: "legit" },
  { id: "q10", from: "+1 (469) 555-0133", body: "Hi, this is your FedEx driver. I'm outside but the gate code isn't working. Can you come down or text me the gate code?", label: "legit" },
  { id: "q11", from: "+1 (469) 555-0134", body: "Reminder: November rent is due on the 1st. You can pay through the resident portal as usual. - Oakwood Apartments", label: "legit" },
];
