/**
 * Curated directory of organizations scammers impersonate: their real domains,
 * how to reach them safely, and what they will never ask for by text.
 */

export interface OrgEntry {
  org: string;
  aliases: string[];
  domains: string[];
  safeContact: string;
  url: string;
  neverAsks: string[];
}

export const DIRECTORY: OrgEntry[] = [
  {
    org: "T-Mobile",
    aliases: ["t-mobile", "tmobile", "t mobile", "magenta"],
    domains: ["t-mobile.com", "tmobile.com"],
    safeContact: "Dial 611 from your T-Mobile phone, or open the T-Life app",
    url: "https://www.t-mobile.com",
    neverAsks: [
      "your account PIN or a verification code by text",
      "you to redeem rewards through a link from an unknown number",
      "payment by gift card",
    ],
  },
  {
    org: "PNC Bank",
    aliases: ["pnc"],
    domains: ["pnc.com"],
    safeContact: "Call the number on the back of your PNC card, or type pnc.com yourself",
    url: "https://www.pnc.com",
    neverAsks: [
      "you to move money to a 'safe' or 'holding' account",
      "your online banking password or one-time passcode",
      "you to keep a call secret from branch staff",
    ],
  },
  {
    org: "NTTA",
    aliases: ["ntta", "tolltag", "toll tag", "tollway"],
    domains: ["ntta.org"],
    safeContact: "Sign in at ntta.org yourself, or call the number printed on your NTTA bill",
    url: "https://www.ntta.org",
    neverAsks: ["toll payments through a text-message link", "you to pay within hours to avoid license suspension"],
  },
  {
    org: "USPS",
    aliases: ["usps", "postal service", "us postal"],
    domains: ["usps.com"],
    safeContact: "Track your package by typing usps.com yourself",
    url: "https://www.usps.com",
    neverAsks: ["a redelivery fee through a text link you didn't sign up for"],
  },
  {
    org: "IRS",
    aliases: ["irs", "internal revenue"],
    domains: ["irs.gov"],
    safeContact: "Sign in at irs.gov/account yourself",
    url: "https://www.irs.gov",
    neverAsks: ["to start contact by text message", "payment by gift card, wire or crypto"],
  },
  {
    org: "Social Security Administration",
    aliases: ["social security", "ssa"],
    domains: ["ssa.gov"],
    safeContact: "Sign in at ssa.gov/myaccount yourself",
    url: "https://www.ssa.gov",
    neverAsks: ["to threaten arrest or suspend your number", "payment by gift card or crypto"],
  },
  {
    org: "Amazon",
    aliases: ["amazon", "prime"],
    domains: ["amazon.com"],
    safeContact: "Open the Amazon app and check Your Orders",
    url: "https://www.amazon.com",
    neverAsks: ["you to share a verification code with anyone", "payment outside amazon.com"],
  },
  {
    org: "Apple",
    aliases: ["apple", "icloud", "apple id"],
    domains: ["apple.com", "icloud.com"],
    safeContact: "Go to Settings → your name on your iPhone",
    url: "https://support.apple.com",
    neverAsks: ["your Apple Account password or code by text"],
  },
  {
    org: "Netflix",
    aliases: ["netflix"],
    domains: ["netflix.com"],
    safeContact: "Open the Netflix app and check Account",
    url: "https://www.netflix.com",
    neverAsks: ["payment details through a text link"],
  },
  {
    org: "PayPal",
    aliases: ["paypal"],
    domains: ["paypal.com"],
    safeContact: "Open the PayPal app yourself",
    url: "https://www.paypal.com",
    neverAsks: ["you to send money to 'reverse' a payment"],
  },
  {
    org: "Zelle",
    aliases: ["zelle"],
    domains: ["zellepay.com"],
    safeContact: "Contact your own bank through its app",
    url: "https://www.zellepay.com",
    neverAsks: ["you to send money to yourself or to 'unlock' an account"],
  },
  {
    org: "Chase",
    aliases: ["chase"],
    domains: ["chase.com"],
    safeContact: "Call the number on the back of your Chase card",
    url: "https://www.chase.com",
    neverAsks: ["you to move money to protect it", "your one-time code"],
  },
  {
    org: "Bank of America",
    aliases: ["bank of america", "bofa"],
    domains: ["bankofamerica.com"],
    safeContact: "Call the number on the back of your card",
    url: "https://www.bankofamerica.com",
    neverAsks: ["you to move money to protect it", "your one-time code"],
  },
  {
    org: "Wells Fargo",
    aliases: ["wells fargo"],
    domains: ["wellsfargo.com"],
    safeContact: "Call the number on the back of your card",
    url: "https://www.wellsfargo.com",
    neverAsks: ["you to move money to protect it", "your one-time code"],
  },
  {
    org: "Microsoft",
    aliases: ["microsoft", "windows defender", "outlook"],
    domains: ["microsoft.com", "live.com", "outlook.com"],
    safeContact: "Go to account.microsoft.com yourself",
    url: "https://account.microsoft.com",
    neverAsks: ["you to call a number about a virus", "remote access to your computer"],
  },
  {
    org: "Coinbase",
    aliases: ["coinbase"],
    domains: ["coinbase.com"],
    safeContact: "Open the Coinbase app yourself",
    url: "https://www.coinbase.com",
    neverAsks: ["your recovery phrase", "you to move funds to a new wallet for safety"],
  },
  {
    org: "FedEx",
    aliases: ["fedex"],
    domains: ["fedex.com"],
    safeContact: "Track by typing fedex.com yourself",
    url: "https://www.fedex.com",
    neverAsks: ["a customs or redelivery fee by text link"],
  },
  {
    org: "Venmo",
    aliases: ["venmo"],
    domains: ["venmo.com"],
    safeContact: "Open the Venmo app yourself",
    url: "https://venmo.com",
    neverAsks: ["your verification code", "you to call a number to stop a payment"],
  },
  {
    org: "Cash App",
    aliases: ["cash app", "cashapp"],
    domains: ["cash.app", "cash.me", "squareup.com"],
    safeContact: "Open Cash App yourself and use in-app support",
    url: "https://cash.app",
    neverAsks: ["your PIN or sign-in code", "a payment to receive money"],
  },
  {
    org: "Capital One",
    aliases: ["capital one"],
    domains: ["capitalone.com"],
    safeContact: "Call the number on the back of your Capital One card",
    url: "https://www.capitalone.com",
    neverAsks: ["your one-time code", "you to move money to protect it"],
  },
  {
    org: "Google",
    aliases: ["google", "google voice"],
    domains: ["google.com", "g.co"],
    safeContact: "Go to myaccount.google.com yourself",
    url: "https://myaccount.google.com",
    neverAsks: ["you to forward a Google verification code to anyone", "payment in Google Play cards"],
  },
  {
    org: "Best Buy / Geek Squad",
    aliases: ["geek squad", "geeksquad", "best buy", "bestbuy"],
    domains: ["bestbuy.com", "geeksquad.com"],
    safeContact: "Sign in at bestbuy.com yourself or call the number on your receipt",
    url: "https://www.bestbuy.com",
    neverAsks: ["you to call a number from an email to cancel a renewal", "remote access to your computer for a refund"],
  },
  {
    org: "Walmart",
    aliases: ["walmart"],
    domains: ["walmart.com"],
    safeContact: "Open the Walmart app yourself",
    url: "https://www.walmart.com",
    neverAsks: ["you to claim a gift card through a text link"],
  },
  {
    org: "TxTag",
    aliases: ["txtag", "tx tag"],
    domains: ["txtag.org"],
    safeContact: "Sign in at txtag.org yourself",
    url: "https://www.txtag.org",
    neverAsks: ["toll payments through a text-message link"],
  },
  {
    org: "E-ZPass",
    aliases: ["e-zpass", "ezpass", "e-z pass"],
    domains: ["e-zpassiag.com", "e-zpassny.com", "ezpassnj.com"],
    safeContact: "Sign in to your state's E-ZPass site by typing it yourself",
    url: "https://www.e-zpassiag.com",
    neverAsks: ["toll payments through a text-message link"],
  },
  {
    org: "Federal Student Aid",
    aliases: ["federal student aid", "student aid", "dept of education", "department of education", "dept. of education"],
    domains: ["studentaid.gov", "ed.gov"],
    safeContact: "Sign in at studentaid.gov yourself, or call your loan servicer from its official site",
    url: "https://studentaid.gov",
    neverAsks: ["a fee to apply for loan forgiveness", "you to call a number from a text to enroll"],
  },
  {
    org: "Instagram",
    aliases: ["instagram"],
    domains: ["instagram.com", "facebook.com", "meta.com"],
    safeContact: "Use the Instagram app's own account recovery",
    url: "https://help.instagram.com",
    neverAsks: ["you to send someone else's login code"],
  },
  {
    org: "UPS",
    aliases: ["ups"],
    domains: ["ups.com"],
    safeContact: "Track by typing ups.com yourself",
    url: "https://www.ups.com",
    neverAsks: ["a redelivery fee by text link"],
  },
];

/** Match an organization name or caller ID to the directory, by whole words ("Melissa" is not "ssa"). */
export function findOrg(name: string): OrgEntry | undefined {
  const q = name.toLowerCase().trim();
  if (!q) return undefined;
  const words = (s: string) => ` ${s.replace(/[^a-z0-9&]+/g, " ").trim()} `;
  const wq = words(q);
  return DIRECTORY.find(
    (o) =>
      o.org.toLowerCase() === q ||
      words(o.org.toLowerCase()) === wq ||
      o.aliases.some((a) => a === q || wq.includes(words(a))),
  );
}

/**
 * Which known organizations does this text claim to be from or speak for, in order of appearance?
 * Pure mentions don't count: "Apple gift cards", "Google Play cards", "my Google Voice".
 */
export function claimedOrgs(text: string): OrgEntry[] {
  const found: { org: OrgEntry; at: number }[] = [];
  for (const o of DIRECTORY) {
    let first = -1;
    for (const a of o.aliases) {
      const re = new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}(?=[^a-z0-9]|$)`, "gi");
      for (const m of text.matchAll(re)) {
        const start = (m.index ?? 0) + m[1].length;
        const before = text.slice(Math.max(0, start - 6), start);
        const after = text.slice(start + a.length, start + a.length + 14);
        const mention = /\bmy\s+$/i.test(before) || /^\s+(?:e-?)?(?:gift|play|itunes|store\b)/i.test(after);
        if (!mention && (first === -1 || start < first)) first = start;
      }
    }
    if (first !== -1) found.push({ org: o, at: first });
  }
  return found.sort((x, y) => x.at - y.at).map((f) => f.org);
}
