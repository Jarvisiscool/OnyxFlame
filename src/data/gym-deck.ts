import type { GymCard } from "@/lib/types";

/** Offline practice deck. With an API key, Nemotron writes fresh cards tailored to what reached the user. */
export const GYM_DECK: GymCard[] = [
  {
    id: "g1",
    from: "+1 (469) 555-0131",
    body: "USPS: Your package is held at our facility due to an incomplete address. Update within 12 hours to avoid return: usps-redelivery.info/track",
    isScam: true,
    tells: ["usps-redelivery.info is not usps.com", "12-hour deadline is pressure", "You didn't sign up for texts"],
  },
  {
    id: "g2",
    from: "52466",
    displayName: "T-Mobile",
    body: "T-Mobile: Your payment of $85.00 was received. Thank you! Manage autopay in the T-Life app.",
    isScam: false,
    tells: ["Registered T-Mobile short code", "No link to tap, no request", "Points you to the official app"],
  },
  {
    id: "g3",
    from: "+1 (817) 555-0158",
    body: "Hello, I'm Linda from TaskHub recruiting. Earn $300-$800/day rating products from home, 1 hr daily. Reply YES to start your training today!",
    isScam: true,
    tells: ["Unsolicited job offer", "Pay too good for the work", "Recruiting by random text"],
  },
  {
    id: "g4",
    from: "+1 (972) 555-0100",
    displayName: "Richardson Family Clinic",
    body: "Your flu shot appointment is confirmed for Thu 11/12 at 9:15 AM. Reply C to confirm or R to reschedule.",
    isScam: false,
    tells: ["Expected appointment", "No link, no payment, no personal info asked"],
  },
  {
    id: "g5",
    from: "irs-notice@gmail.com",
    body: "IRS: You are eligible for a tax refund of $1,284.50. Claim before it expires: irs-refund-portal.online",
    isScam: true,
    tells: ["The IRS doesn't start contact by text", "Sent from a Gmail address", ".online domain registered days ago"],
  },
  {
    id: "g6",
    from: "+1 (512) 555-0147",
    body: "Hi, sorry I sent you $250 on Cash App by mistake 😭 it was meant for my landlord. Can you please send it back? I'm really stressed",
    isScam: true,
    tells: ["Check your actual balance in the app first", "'Send it back' reversal trick", "Emotional pressure"],
  },
];
