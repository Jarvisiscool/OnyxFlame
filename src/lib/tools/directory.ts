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
    org: "UPS",
    aliases: ["ups"],
    domains: ["ups.com"],
    safeContact: "Track by typing ups.com yourself",
    url: "https://www.ups.com",
    neverAsks: ["a redelivery fee by text link"],
  },
];

export function findOrg(name: string): OrgEntry | undefined {
  const q = name.toLowerCase().trim();
  if (!q) return undefined;
  return DIRECTORY.find(
    (o) =>
      o.org.toLowerCase() === q ||
      o.aliases.some((a) => a === q || q.includes(a) || (a.length > 3 && a.includes(q))),
  );
}

/** Which known organizations does this text claim to be from or mention? */
export function claimedOrgs(text: string): OrgEntry[] {
  const lower = text.toLowerCase();
  return DIRECTORY.filter((o) =>
    o.aliases.some((a) => {
      const re = new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\-]/g, "\\$&")}([^a-z0-9]|$)`, "i");
      return re.test(lower);
    }),
  );
}
