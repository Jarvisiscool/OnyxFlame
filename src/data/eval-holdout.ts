import type { InboxMessage } from "@/lib/types";

/**
 * HOLDOUT evaluation set. Written BEFORE any detection tuning and never tuned on.
 * Use it to report honest numbers; tune only against eval-set.ts (the dev set).
 *
 * Deliberately hard and diverse: link-free scams, calm-toned scams, brand spoofing
 * through email senders, voicemail transcripts, Spanish-language messages, and
 * legitimate messages that look scary (real fraud alerts, 2FA codes, closures).
 *
 * Everything is synthetic: fictional 555-01XX numbers, invented scam domains,
 * documentation-range IPs (203.0.113.x), no real people. Almost no sender here has
 * an entry in simulated-network.ts, so the detector must reason from content.
 */
type E = Omit<InboxMessage, "receivedAt" | "channel"> & { channel?: InboxMessage["channel"]; label: "scam" | "legit" };

export const HOLDOUT_SET: E[] = [
  // ---------------------------------- scams ----------------------------------
  // Rental: no link, calm, asks for deposit by Zelle
  { id: "h01", from: "+1 (469) 555-0131", body: "Hi, yes the 2 bedroom on Spring Valley is still available! I'm working overseas right now so I can't show it in person, but if you send the first month ($950) and deposit by Zelle I'll mail you the keys this week.", label: "scam" },
  // Marketplace overpayment
  { id: "h02", from: "+1 (346) 555-0142", body: "Hello, I'm interested in your dresser listed on Marketplace. I'll send a cashier's check for $1,150 which covers the $300 price plus my mover's fee. Once it clears please send the extra $850 to my mover on Cash App.", label: "scam" },
  // Crypto investment, invented domain
  { id: "h03", from: "+1 (628) 555-0153", body: "Great chatting yesterday! Like I said, my uncle's trading group made 32% last week on the new platform. You can start with just $500 in USDT at coinvexa-trade.com and I'll walk you through it.", label: "scam" },
  // Romance + secrecy + gift cards
  { id: "h04", from: "+1 (512) 555-0164", body: "My love, customs is holding the package with your gift and they won't release it until a $1,200 fee is paid. They only accept Apple gift cards. Please don't tell your daughter about us yet, she wouldn't understand.", label: "scam" },
  // Job scam pushing to Telegram, no link
  { id: "h05", from: "+1 (737) 555-0175", body: "Hi, this is Rachel from Hirewell Staffing. Your resume was selected for a remote data entry position paying $38/hr, no experience needed. Please message our hiring manager on Telegram @hr_kate_onboard to begin.", label: "scam" },
  // Charity after disaster, unknown .org domain, calm
  { id: "h06", from: "+1 (281) 555-0186", body: "Families on the Gulf Coast lost everything in this week's hurricane. A $25 gift feeds a family for a week. Please give what you can: gulfrelief-families.org/give", label: "scam" },
  // Utility shutoff, callback number
  { id: "h07", channel: "voicemail", from: "+1 (469) 555-0197", body: "This is the disconnection department at North Texas Power and Light. Your service is scheduled to be shut off in 45 minutes for a past due balance of $318.40. To avoid disconnection call our billing office right away at 469-555-0142.", label: "scam" },
  // Student loan forgiveness with fee
  { id: "h08", from: "+1 (210) 555-0108", body: "Student Loan Notice: your federal loans are approved for full forgiveness under the 2026 relief program. Final enrollment ends Friday. Call 855-555-0131 to lock in your spot. One-time processing fee of $299.", label: "scam" },
  // Refund reversal (fake over-refund)
  { id: "h09", from: "+1 (832) 555-0119", body: "Amazon Refunds: we accidentally refunded you $1,500.00 instead of $15.00. Please return the difference by Zelle within 24 hours or your account will be suspended.", label: "scam" },
  // Spoofed brand via email + callback number (renewal refund scam)
  { id: "h10", channel: "email", from: "geeksquad.billing.dept@gmail.com", displayName: "Geek Squad", body: "Your annual protection plan has renewed for $399.99. If you did not authorize this charge, call our refund desk at 1-808-555-0177 within 24 hours to cancel.", label: "scam" },
  // QR code via email from lookalike domain
  { id: "h11", channel: "email", from: "it-helpdesk@microsoft-365-security.net", displayName: "Microsoft 365", body: "Your Microsoft 365 password expires today. To keep your current password, scan the QR code in the attachment with your phone camera and sign in.", label: "scam" },
  // Callback number, bank brand from random 10-digit number
  { id: "h12", from: "+1 (945) 555-0120", body: "Chase Fraud Center: A wire transfer of $2,140.00 to RJ Holdings LLC is pending. If you do not recognize this, call us now at 888-555-0163.", label: "scam" },
  // Voicemail: SSA benefits on hold
  { id: "h13", channel: "voicemail", from: "+1 (202) 555-0148", body: "Hello, this message is for the account holder. This is the Social Security office. Your benefits have been placed on hold because of a problem with your file. Please call us back at 202-555-0148 before the end of the day to speak with an agent.", label: "scam" },
  // Voicemail: grandparent scam, no money amount, secrecy
  { id: "h14", channel: "voicemail", from: "+1 (713) 555-0181", body: "Grandpa? It's me. I got in a car accident and the police are holding me. My lawyer is going to call you in a few minutes about the bail. Please don't tell anyone, I'm so embarrassed.", label: "scam" },
  // Spanish: bank account blocked, risky TLD
  { id: "h15", from: "+1 (956) 555-0192", body: "BBVA: Su cuenta ha sido bloqueada por actividad inusual. Verifique sus datos de inmediato en bbva-seguridad.top para evitar la suspensión.", label: "scam" },
  // Spanish: Hi Mom new number
  { id: "h16", from: "+1 (915) 555-0103", body: "Hola mamá, este es mi número nuevo, se me cayó el teléfono al agua. ¿Me puedes mandar $400 por Zelle? Es urgente, luego te explico.", label: "scam" },
  // Spanish: package fee
  { id: "h17", from: "+1 (305) 555-0114", body: "USPS: Su paquete está retenido por falta de pago de envío ($1.99). Pague aquí para recibirlo: usps-entrega.xyz/pago", label: "scam" },
  // Email spoof with typosquat sender + lookalike link
  { id: "h18", channel: "email", from: "service@paypa1-resolution.com", displayName: "PayPal", body: "We've limited your account after noticing unusual activity. Confirm your information within 48 hours to restore full access: paypal-resolution-center.net/restore", label: "scam" },
  // Email spoof, brand domain wrapped, callback number
  { id: "h19", channel: "email", from: "no-reply@amazon-orders-help.com", displayName: "Amazon", body: "Your order #112-4419 for a MacBook Air (13-inch) has shipped. If you did not authorize this purchase, call our refund department at 1-855-555-0119.", label: "scam" },
  // Calm toll, no urgency words
  { id: "h20", from: "+1 (737) 555-0125", body: "Courtesy reminder from TxTag: there is a remaining balance of $3.75 on your account. You can settle it at txtag-billing.com/pay. Thank you for driving with us.", label: "scam" },
  // Google Voice code theft, friendly
  { id: "h21", from: "+1 (210) 555-0136", body: "Hi! Sorry, I think I typed your number by mistake when setting up my Google Voice. You'll get a text from Google with a 6 digit code, could you send it to me? Thanks so much!", label: "scam" },
  // Sweepstakes, no link, gift cards
  { id: "h22", from: "+1 (318) 555-0147", body: "Congratulations, your number was drawn in the National Mega Sweepstakes for $850,000. To release your prize a one-time tax of $499 must be paid with Google Play cards. Reply YES to claim.", label: "scam" },
  // Boss gift-card scam asking for card codes
  { id: "h23", from: "+1 (469) 555-0158", body: "Hi, it's Mark. I'm stuck in meetings all afternoon and need a favor. Can you pick up 5 Apple gift cards for a client? Keep it quiet for now, it's a surprise. Text me the codes on the back when you have them.", label: "scam" },
  // IP-address URL
  { id: "h24", from: "+1 (623) 555-0169", body: "FedEx: We attempted to deliver your parcel today. Choose a new delivery time here: http://203.0.113.45/fedex/resched", label: "scam" },
  // Subdomain trick
  { id: "h25", from: "+1 (757) 555-0170", body: "Wells Fargo: Online access has been suspended. Sign in to restore access: wellsfargo.com.account-restore.live/login", label: "scam" },
  // ALL CAPS with uppercase URL and .co
  { id: "h26", from: "+1 (601) 555-0181", body: "T-MOBILE: YOUR AUTOPAY PAYMENT FAILED. UPDATE YOUR CARD AT TMOBILE-BILLPAY.CO TO AVOID LOSING SERVICE", label: "scam" },
  // Fake "reply YES/NO" fraud alert from a random number
  { id: "h27", from: "+1 (469) 555-0137", body: "BofA Fraud Alert: Did you attempt a purchase of $899.00 at Best Buy? Reply YES or NO. If NO, a fraud specialist will call you to secure your account.", label: "scam" },
  // Wrong name greeting opener into gold trading
  { id: "h28", from: "+1 (650) 555-0192", body: "Hey David, long time no talk! I was going through old photos and thought of you. I've been doing really well with a gold trading app lately, happy to show you how it works if you're interested.", label: "scam" },

  // ---------------------------------- legitimate ----------------------------------
  // Real fraud alert from a bank short code, reply YES/NO
  { id: "k01", from: "72166", displayName: "Chase", body: "Chase Fraud Alert: Did you use your card ending 4471 for $212.35 at Target on 11/06? Reply YES or NO. Msg & data rates may apply. Reply STOP to opt out.", label: "legit" },
  { id: "k02", from: "93557", displayName: "Wells Fargo", body: "Wells Fargo: Suspicious attempt on debit card ending 9033 for $48.00 at an online merchant. Reply 1 if it was you, 2 if not. We will never ask for your PIN.", label: "legit" },
  // Real 2FA codes
  { id: "k03", from: "22000", body: "G-482913 is your Google verification code.", label: "legit" },
  { id: "k04", from: "86753", body: "Your Venmo verification code is 830441. Venmo will never call you or ask for this code. Don't share it with anyone.", label: "legit" },
  { id: "k05", from: "32665", displayName: "Microsoft", body: "Microsoft account security code: 551203. If you didn't request it, you can ignore this message.", label: "legit" },
  // School closure, urgent-sounding
  { id: "k06", from: "67283", displayName: "Richardson ISD", body: "Richardson ISD: Due to icy roads, ALL schools are CLOSED today, Tuesday. All after-school activities are cancelled. Please stay safe.", label: "legit" },
  // Pharmacy
  { id: "k07", from: "79275", body: "Walgreens: Your prescription is ready for pickup. Please pick up within 7 days or it will be returned to stock. Reply STOP to opt out.", label: "legit" },
  // Deliveries on official domains
  { id: "k08", from: "69877", body: "UPS: Your package will be delivered today between 2:00 PM and 6:00 PM. Track or change delivery at ups.com/track", label: "legit" },
  { id: "k09", from: "46339", body: "FedEx: Delivery exception. We couldn't deliver your package today because a signature is required. We'll try again tomorrow. Details at fedex.com/tracking", label: "legit" },
  { id: "k10", from: "+1 (206) 555-0140", body: "Amazon: Your package was delivered. It was handed directly to a resident. See photo and details at amazon.com/orders", label: "legit" },
  // Bank alerts that tell you to use the app / card
  { id: "k11", from: "75762", displayName: "PNC Bank", body: "PNC Alert: A new device signed in to your online banking. If this wasn't you, open the PNC Mobile app or call the number on the back of your card. We will never ask for your password by text.", label: "legit" },
  { id: "k12", from: "73733", body: "Bank of America: Your available balance is below $100.00. Log in to the mobile app to see recent activity.", label: "legit" },
  // Family asking for money, saved contact, known context
  { id: "k13", from: "+1 (972) 555-0122", displayName: "Mom", body: "Hey sweetie, can you Venmo me the $40 for your half of grandma's birthday dinner when you get a chance? No rush ❤️", label: "legit" },
  { id: "k14", from: "+1 (972) 555-0133", displayName: "Dad", body: "Sent you $200 on Zelle for your textbooks. Let me know when it shows up.", label: "legit" },
  // Friend asking for small money, no saved name
  { id: "k15", from: "+1 (214) 555-0144", body: "hey can you venmo me $12 for the pizza last night? 🍕", label: "legit" },
  // Carrier notice from the registered T-Mobile short code
  { id: "k16", from: "52466", displayName: "T-Mobile", body: "T-Mobile: You've reached your high-speed data limit for this bill cycle. Add more data at t-mobile.com or in the T-Life app.", label: "legit" },
  // Appointment reminder with a callback number
  { id: "k17", from: "+1 (972) 555-0158", displayName: "Bright Smiles Dental", body: "Bright Smiles Dental: Reminder of your cleaning on Mon 11/16 at 9:00 AM. Reply Y to confirm or call 972-555-0159 to reschedule.", label: "legit" },
  // Utility bill, no link, pay in app
  { id: "k18", from: "28937", body: "Atmos Energy: Your bill of $64.12 is due 11/20. Pay in the Atmos Energy app or with autopay. Reply STOP to end texts.", label: "legit" },
  // Career center, personal
  { id: "k19", from: "+1 (972) 555-0166", body: "Hi, this is Priya from the UTD Career Center. Your mock interview is confirmed for Wednesday at 3 PM in SSB 3.300. Just reply if you need to reschedule.", label: "legit" },
  // Voicemail legit: auto shop
  { id: "k20", channel: "voicemail", from: "+1 (972) 555-0177", body: "Hi, this is Tom from Lakeside Auto Repair. Your car is ready for pickup, the total came to $412.50. We're open until 6 today. Thanks!", label: "legit" },
  // Voicemail legit: doctor's office with callback number
  { id: "k21", channel: "voicemail", from: "+1 (972) 555-0188", body: "Hi, this is Dr. Nguyen's office calling to confirm your appointment tomorrow at 11. If you need to reschedule, please call us back at 972-555-0188. Thank you.", label: "legit" },
  // Spanish legit: family dinner
  { id: "k22", from: "+1 (972) 555-0199", displayName: "Tía Carmen", body: "Hola mija, ¿vienen el domingo a la comida? Avísame para saber cuántos somos. Besos.", label: "legit" },
  // Legit security email from official domain
  { id: "k23", channel: "email", from: "noreply@email.apple.com", displayName: "Apple", body: "Your Apple Account was used to sign in to iCloud on a Mac. If you recognize this, you can ignore this email. If not, go to Settings on your iPhone to change your password.", label: "legit" },
];
