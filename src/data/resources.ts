/**
 * Trusted help links the assistant may cite. The model only picks ids from this list;
 * the server maps ids to URLs, so it can never invent or pass along a link.
 */
export interface Resource {
  id: string;
  title: string;
  url: string;
  about: string;
}

export const RESOURCES: Resource[] = [
  { id: "ftc_report", title: "Report fraud to the FTC", url: "https://reportfraud.ftc.gov", about: "Report a scam, fraud or bad business practice; you get next steps." },
  { id: "ftc_advice", title: "FTC consumer advice on scams", url: "https://consumer.ftc.gov", about: "Plain-language guides to common scams and how to avoid them." },
  { id: "identity_theft", title: "IdentityTheft.gov recovery plan", url: "https://www.identitytheft.gov", about: "Step-by-step recovery plan if your personal info was stolen or misused." },
  { id: "ic3", title: "FBI Internet Crime Complaint Center", url: "https://www.ic3.gov", about: "Report online fraud and cybercrime to the FBI, especially money lost." },
  { id: "fcc_robocalls", title: "FCC: stop unwanted robocalls and texts", url: "https://www.fcc.gov/consumers/guides/stop-unwanted-robocalls-and-texts", about: "How to block and report robocalls and spam texts." },
  { id: "credit_reports", title: "Free credit reports", url: "https://www.annualcreditreport.com", about: "The official free credit report site; check for accounts you didn't open." },
  { id: "aarp_helpline", title: "AARP Fraud Watch Network Helpline", url: "https://www.aarp.org/money/scams-fraud/helpline/", about: "Free help line for scam victims and families (any age)." },
  { id: "tmobile_scam_shield", title: "T-Mobile Scam Shield", url: "https://www.t-mobile.com/scamshield", about: "T-Mobile's free scam blocking, caller ID and scam reporting." },
  { id: "ntta", title: "NTTA (real site)", url: "https://www.ntta.org", about: "The real North Texas Tollway Authority: check toll bills here, never via text links." },
  { id: "usps", title: "USPS (real site)", url: "https://www.usps.com", about: "Track packages by typing usps.com yourself." },
  { id: "irs", title: "IRS (real site)", url: "https://www.irs.gov", about: "The IRS doesn't start contact by text or social media." },
  { id: "ssa", title: "Social Security (real site)", url: "https://www.ssa.gov", about: "Social Security won't threaten you or ask for gift cards." },
];

export const resourceById = (id: string) => RESOURCES.find((r) => r.id === id);
