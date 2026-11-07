import type { InboxMessage } from "@/lib/types";

/**
 * Hand-written synthetic evaluation set. No real customer data.
 * Most senders here have NO simulated network history, so the agent has to
 * reason from the message, links and directory. That keeps the metrics honest.
 * Grow it with `npm run generate` (Nemotron writes new labeled examples).
 */
type E = Omit<InboxMessage, "receivedAt" | "channel"> & { channel?: InboxMessage["channel"]; label: "scam" | "legit" };

export const EVAL_SET: E[] = [
  // ---- scams ----
  { id: "e01", from: "+1 (430) 555-0101", body: "USPS: Your package could not be delivered due to an incomplete address. Update within 24 hours: usps-redelivery.info/u", label: "scam" },
  { id: "e02", from: "+1 (430) 555-0102", body: "E-ZPass final notice: outstanding toll of $4.15. Pay now to avoid a $45 penalty: ezpass-tollcenter.xyz", label: "scam" },
  { id: "e03", from: "+1 (430) 555-0103", body: "PNC Alert: Unusual sign-in detected. Your online banking is locked. Verify your identity now at pnc-secure-verify.com", label: "scam" },
  { id: "e04", from: "+1 (430) 555-0104", body: "Amazon: A purchase of iPhone 16 Pro ($1,249.00) was placed on your account. If this wasn't you, call 1-844-555-0123 immediately.", label: "scam" },
  { id: "e05", from: "+1 (430) 555-0105", body: "This is T-Mobile security. Someone is trying to port your number. To stop it, reply with the PIN we just texted you.", label: "scam" },
  { id: "e06", from: "+1 (430) 555-0106", body: "Hi Dad, this is my new number, lost my phone. Can you send me $300 on Venmo for rent? I'll explain later, kind of urgent", label: "scam" },
  { id: "e07", from: "irs.refunds.dept@gmail.com", body: "IRS: You have a pending tax refund of $1,920.33. Submit your bank details to receive it: irs-refund-portal.online", label: "scam" },
  { id: "e08", from: "+1 (430) 555-0108", body: "Congratulations! You've been selected for a $500 Walmart gift card. Claim before midnight: bit.ly/wm-claim500", label: "scam" },
  { id: "e09", from: "+1 (430) 555-0109", body: "Hello! We are hiring remote part-time staff. Earn $200-$500 per day, just 60 minutes daily tasks. Reply 1 to learn more.", label: "scam" },
  { id: "e10", from: "+1 (430) 555-0110", body: "Social Security Administration: Your SSN has been suspended due to suspicious activity. Call 888-555-0144 now to avoid legal action.", label: "scam" },
  { id: "e11", from: "+1 (430) 555-0111", body: "Apple ID: Your account has been locked for security reasons. Restore access at applecare-id.support within 24 hours.", label: "scam" },
  { id: "e12", from: "+1 (430) 555-0112", body: "Netflix: Your payment was declined. Update your card to keep watching: netflix-billing-update.com", label: "scam" },
  { id: "e13", from: "+1 (430) 555-0113", body: "Hi Jessica, it's Kevin from the conference. Are we still meeting for coffee tomorrow?", label: "scam" },
  { id: "e14", from: "+1 (430) 555-0114", body: "Sorry, I accidentally sent $350 to your Zelle. It was meant for my mom's hospital bill. Could you please send it back?", label: "scam" },
  { id: "e15", from: "+1 (430) 555-0115", body: "Coinbase: A withdrawal of 0.42 BTC is pending. If you did not request this, call support at 877-555-0177 to cancel.", label: "scam" },
  { id: "e16", channel: "voicemail", from: "+1 (430) 555-0116", body: "This is Officer Grant with the Dallas County Sheriff. You missed jury duty and there is a warrant for your arrest. You can resolve this today with a payment. Call 214-555-0190.", label: "scam" },
  { id: "e17", from: "+1 (430) 555-0117", body: "Your Microsoft account was hacked. Your computer may be infected with a virus. Call Windows Support at 1-888-555-0109 immediately.", label: "scam" },
  { id: "e18", from: "+1 (430) 555-0118", body: "Chase: We noticed fraud on your account. For your protection, move your funds to a new secure account. Our agent will call you shortly.", label: "scam" },
  { id: "e19", from: "+1 (430) 555-0119", body: "T-Mobile: Thanks for paying your bill! As a reward you have a free gift. Claim here: tmobile-gift.icu/r", label: "scam" },
  { id: "e20", from: "+1 (430) 555-0120", body: "FedEx: Customs fee of $2.99 required for your international parcel. Pay here or your shipment will be returned: fedex-customs.top/pay", label: "scam" },
  { id: "e21", from: "+1 (430) 555-0121", body: "Wells Fargo: Did you attempt a Zelle payment of $1,500 to Mark? Reply YES or NO. If NO, our fraud team will call you.", label: "scam" },
  { id: "e22", from: "+1 (430) 555-0122", body: "Grandma it's me, I'm in trouble and need bail money. Please don't tell mom and dad. Can you get Target gift cards?", label: "scam" },

  // ---- legitimate ----
  { id: "l01", from: "52466", displayName: "T-Mobile", body: "T-Mobile: Your payment of $72.40 was received. Thank you!", label: "legit" },
  { id: "l02", from: "73981", displayName: "Amazon", body: "Your Amazon verification code is 739201. Don't share it with anyone.", label: "legit" },
  { id: "l03", from: "+1 (972) 555-0100", displayName: "Richardson Family Clinic", body: "Reminder: your appointment is Thursday at 10:00 AM. Reply C to confirm.", label: "legit" },
  { id: "l04", from: "+1 (430) 555-0201", body: "Hey! Running 10 minutes late, grab us a table?", label: "legit" },
  { id: "l05", from: "+1 (430) 555-0202", body: "Can you pick up milk and eggs on your way home? Thanks!", label: "legit" },
  { id: "l06", from: "+1 (430) 555-0203", body: "Your Uber is arriving in 3 minutes. Look for the gray Toyota Camry.", label: "legit" },
  { id: "l07", from: "+1 (430) 555-0204", body: "Happy birthday!! Hope you have the best day 🎉", label: "legit" },
  { id: "l08", from: "+1 (430) 555-0205", body: "PNC: Your account ending in 4421 has a low balance. View details in the PNC Mobile app.", label: "legit" },
  { id: "l09", from: "+1 (430) 555-0206", body: "Your package was delivered to the front door. Track at usps.com", label: "legit" },
  { id: "l10", from: "+1 (430) 555-0207", body: "Practice is moved to 6pm tomorrow because of the rain. See everyone there!", label: "legit" },
  { id: "l11", from: "+1 (430) 555-0208", body: "Your Chase card ending 8812 was used for $54.20 at H-E-B. No action needed if this was you.", label: "legit" },
  { id: "l12", from: "+1 (430) 555-0209", body: "Your table for 4 at 7:30 PM is ready. Please check in with the host.", label: "legit" },
  { id: "l13", from: "+1 (430) 555-0210", body: "Netflix: Your new sign-in from a TV in Dallas, TX. If this was you, no action needed. Manage devices at netflix.com/account", label: "legit" },
  { id: "l14", from: "+1 (430) 555-0211", body: "Did you finish the chem lab report? Due at midnight, don't forget to submit it on Canvas", label: "legit" },
  { id: "l15", from: "+1 (430) 555-0212", body: "Mom, can you call me when you're out of your meeting? Nothing urgent, just about Thanksgiving plans", label: "legit" },
  { id: "l16", from: "+1 (430) 555-0213", body: "Your prescription is ready for pickup at the pharmacy on Campbell Rd.", label: "legit" },
  { id: "l17", from: "+1 (430) 555-0214", body: "T-Mobile: You've used 80% of your high-speed hotspot data. Manage your plan at t-mobile.com", label: "legit" },
  { id: "l18", from: "+1 (430) 555-0215", body: "Flight AA 1452 to Chicago is now boarding at gate C12.", label: "legit" },

  // ---- dev additions (written after the holdout was frozen; tune against these, not the holdout) ----
  { id: "d01", from: "+1 (380) 555-0101", body: "Venmo: A payment of $750.00 to Tyler M. is processing. Not you? Call 1-866-555-0152 to stop it.", label: "scam" },
  { id: "d02", from: "+1 (380) 555-0102", body: "Chase: Your card has been temporarily restricted. Visit chase.com-secure-review.info to review recent activity.", label: "scam" },
  { id: "d03", from: "+1 (380) 555-0103", body: "Your Netflix membership is on hold. Update billing: http://198.51.100.23/nflx", label: "scam" },
  { id: "d04", from: "+1 (380) 555-0104", body: "Aviso IRS: Tiene un reembolso pendiente de $1,280. Reclámelo hoy en irs-reembolso.online antes de que expire.", label: "scam" },
  { id: "d05", from: "+1 (380) 555-0105", body: "¡Hola! Buscamos personal para trabajar desde casa. Gane $300 al día con solo 1 hora. Responda SÍ para más información.", label: "scam" },
  { id: "d06", channel: "email", from: "alerts@coinbase-secure-mail.com", displayName: "Coinbase", body: "Unusual login detected on your account. If this wasn't you, secure your wallet by moving your funds to the protected vault: coinbase-vault-secure.com", label: "scam" },
  { id: "d07", channel: "email", from: "usps.delivery.notice@outlook.com", displayName: "USPS", body: "Your shipment is on hold due to an unpaid fee of $2.10. Reply with your card number and expiration date to release it.", label: "scam" },
  { id: "d08", from: "+1 (380) 555-0108", body: "Parking Enforcement: A citation was issued to your vehicle. Scan the QR code on the notice on your windshield or pay at citypark-fines.info within 48 hours to avoid towing.", label: "scam" },
  { id: "d09", from: "+1 (380) 555-0109", body: "Hi, I'm Lily. I saw you were interested in passive income. I help people grow their savings with a bitcoin mining pool, returns about 2% a day. Want me to send you the app?", label: "scam" },
  { id: "d10", from: "+1 (380) 555-0110", body: "The house on Elm is available for $1,100/mo. I'm out of state on a mission trip, so send the $500 holding deposit through Cash App and I'll ship you the keys.", label: "scam" },
  { id: "d11", channel: "voicemail", from: "+1 (380) 555-0111", body: "This is an urgent message from your electric company. Your meter is being disconnected today due to nonpayment. Please call 972-555-0103 immediately to make a payment and avoid a shutoff.", label: "scam" },
  { id: "d12", from: "+1 (419) 555-0112", body: "Capital One: Unusual charge of $1,019.88 at Apple Store. Reply Y if this was you or N to block your card.", label: "scam" },
  { id: "d13", from: "+1 (380) 555-0113", body: "Hey it's Jordan, I got locked out of my Instagram and they're sending a code to your phone since you're my recovery contact. Can you send it to me real quick?", label: "scam" },
  { id: "d14", from: "+1 (380) 555-0114", body: "USPS: YOUR PACKAGE IS ON HOLD. CONFIRM YOUR ADDRESS AT USPS-TRACKHELP.TOP NOW", label: "scam" },
  { id: "d15", from: "+1 (380) 555-0115", body: "Dept of Education: Your student loan balance may qualify for forgiveness. Act before the program closes this week. Call 844-555-0128.", label: "scam" },
  { id: "d16", from: "+1 (380) 555-0116", body: "Hi, I want to buy your bike. I'll pay through Zelle but my account needs you to upgrade to a business account first, just send $100 and it will be refunded with the payment.", label: "scam" },
  { id: "d17", from: "96937", displayName: "Wells Fargo", body: "Wells Fargo: Card ending 2210 declined for $310.00 at an online store. Reply YES if this was you, NO if not.", label: "legit" },
  { id: "d18", from: "46982", body: "Your Lyft code is 4821. Never share this code.", label: "legit" },
  { id: "d19", from: "87283", body: "Plano ISD: All schools will be closed tomorrow, Friday, due to severe weather. Stay safe.", label: "legit" },
  { id: "d20", from: "28797", body: "CVS Pharmacy: Your prescription is ready for pickup. Reply STOP to opt out.", label: "legit" },
  { id: "d21", from: "+1 (380) 555-0121", body: "can u send me $20 for the uber? ill pay u back friday", label: "legit" },
  { id: "d22", from: "69877", body: "UPS: Your package was delivered at 3:12 PM, front porch. Details at ups.com", label: "legit" },
  { id: "d23", channel: "voicemail", from: "+1 (972) 555-0127", body: "Hi, it's Karen from Dr. Reyes's office. Please give us a call back at 972-555-0127 when you get a chance about your lab results. Thanks.", label: "legit" },
  { id: "d24", from: "24273", body: "Chase: Your monthly statement is ready. View it in the Chase Mobile app.", label: "legit" },
  { id: "d25", from: "+1 (380) 555-0125", body: "Hola! Ya llegué a la casa, gracias por todo hoy. Nos vemos el sábado.", label: "legit" },
  { id: "d26", channel: "email", from: "no-reply@paypal.com", displayName: "PayPal", body: "You sent $25.00 USD to Jordan Ellis. See the details in your PayPal app.", label: "legit" },
];
