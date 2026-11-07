import type { Evidence } from "../types";
import { DIRECTORY } from "./directory";
import { SIMULATED_REGISTRY } from "@/data/simulated-network";

const RISKY_TLDS = ["top", "xyz", "club", "icu", "click", "link", "live", "online", "site", "shop", "vip", "win", "zip", "mobi", "tk", "ml", "cn", "ru", "support", "help", "cc"];
const SHORTENERS = ["bit.ly", "tinyurl.com", "t.co", "is.gd", "rb.gy", "cutt.ly", "shorturl.at", "ow.ly", "goo.gl", "t.ly"];

const HOMOGLYPHS: Record<string, string> = { "0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s" };

export interface LinkReport {
  url: string;
  hostname: string;
  registrableDomain: string;
  officialFor?: string;
  impersonates?: string;
  lookalikeReason?: string;
  ageDays?: number;
  registeredOn?: string;
  registrar?: string;
  registrySource: "rdap" | "simulated" | "unavailable";
  riskyTld: boolean;
  shortener: boolean;
  ipAddress: boolean;
  punycode: boolean;
  usesHttps: boolean;
}

function normalize(label: string) {
  return label
    .toLowerCase()
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .split("")
    .map((c) => HOMOGLYPHS[c] ?? c)
    .join("")
    .replace(/[^a-z]/g, "");
}

function levenshtein(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function parseHost(raw: string) {
  const withProto = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const u = new URL(withProto);
    return { hostname: u.hostname.toLowerCase().replace(/^www\./, ""), https: u.protocol === "https:" };
  } catch {
    return { hostname: raw.toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, ""), https: false };
  }
}

export function registrable(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length <= 2) return hostname;
  const sld = parts[parts.length - 2];
  const tld = parts[parts.length - 1];
  if (tld.length === 2 && ["co", "com", "org", "net", "gov", "ac"].includes(sld)) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

function brandCheck(hostname: string, domain: string) {
  for (const org of DIRECTORY) {
    if (org.domains.some((d) => domain === d || hostname === d || hostname.endsWith("." + d))) {
      return { officialFor: org.org };
    }
  }
  const label = domain.split(".")[0];
  const segments = hostname.split(/[.-]/).map(normalize);
  const whole = normalize(label);
  for (const org of DIRECTORY) {
    for (const d of org.domains) {
      const brand = normalize(d.split(".")[0]);
      if (hostname.includes(d)) {
        return { impersonates: org.org, lookalikeReason: `puts "${d}" inside a different domain (${domain})` };
      }
      if (brand.length <= 4) {
        if (segments.includes(brand)) {
          return { impersonates: org.org, lookalikeReason: `uses the brand name "${brand}" on an unrelated domain` };
        }
      } else {
        if (whole.includes(brand)) {
          return { impersonates: org.org, lookalikeReason: `wraps the brand name "${brand}" in extra words` };
        }
        if (levenshtein(whole, brand) <= 2) {
          return { impersonates: org.org, lookalikeReason: `is a misspelling of ${d}` };
        }
      }
    }
  }
  return {};
}

async function rdap(domain: string): Promise<{ registeredOn?: string; registrar?: string } | null> {
  // Evals and offline tests can skip the live registry (it only times out in a sandbox).
  if (process.env.SECONDLOOK_NO_RDAP === "1") return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/rdap+json" },
    });
    if (!res.ok) return null;
    const j = await res.json();
    const reg = (j.events ?? []).find((e: { eventAction: string }) => e.eventAction === "registration");
    const registrar = (j.entities ?? [])
      .find((e: { roles?: string[] }) => e.roles?.includes("registrar"))
      ?.vcardArray?.[1]?.find((v: unknown[]) => v[0] === "fn")?.[3];
    return { registeredOn: reg?.eventDate, registrar };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkLink(url: string): Promise<{ report: LinkReport; signals: Evidence[]; summary: string }> {
  const { hostname, https } = parseHost(url);
  const domain = registrable(hostname);
  const tld = domain.split(".").pop() ?? "";
  const brand = brandCheck(hostname, domain);
  const report: LinkReport = {
    url,
    hostname,
    registrableDomain: domain,
    ...brand,
    registrySource: "unavailable",
    riskyTld: RISKY_TLDS.includes(tld),
    shortener: SHORTENERS.includes(hostname),
    ipAddress: /^\d+\.\d+\.\d+\.\d+$/.test(hostname),
    punycode: hostname.includes("xn--"),
    usesHttps: https,
  };

  const sim = SIMULATED_REGISTRY[domain];
  if (sim) {
    report.registrySource = "simulated";
    report.registeredOn = new Date(Date.now() - sim.ageDays * 86_400_000).toISOString();
    report.registrar = sim.registrar;
  } else {
    const live = await rdap(domain);
    if (live?.registeredOn) {
      report.registrySource = "rdap";
      report.registeredOn = live.registeredOn;
      report.registrar = live.registrar;
    }
  }
  if (report.registeredOn) {
    report.ageDays = Math.max(0, Math.round((Date.now() - new Date(report.registeredOn).getTime()) / 86_400_000));
  }

  const src = report.registrySource === "rdap" ? "RDAP domain registry (live)" : report.registrySource === "simulated" ? "Domain registry (simulated for demo domains)" : "Link analysis";
  const signals: Evidence[] = [];
  if (report.officialFor) {
    signals.push({ signal: "Official domain", detail: `${domain} belongs to ${report.officialFor}`, weight: "high", direction: "safe", source: "Trusted directory" });
  }
  if (report.impersonates) {
    signals.push({ signal: "Lookalike domain", detail: `${domain} ${report.lookalikeReason}. It is not owned by ${report.impersonates}.`, weight: "high", direction: "risk", source: "Lookalike detector" });
  }
  if (report.ageDays !== undefined) {
    if (report.ageDays < 30) signals.push({ signal: "Brand-new domain", detail: `${domain} was registered ${report.ageDays} day${report.ageDays === 1 ? "" : "s"} ago`, weight: "high", direction: "risk", source: src });
    else if (report.ageDays < 180) signals.push({ signal: "Young domain", detail: `${domain} is only ${report.ageDays} days old`, weight: "medium", direction: "risk", source: src });
    else if (report.ageDays > 3650) signals.push({ signal: "Long-established domain", detail: `${domain} has been registered for ${Math.floor(report.ageDays / 365)} years`, weight: "medium", direction: "safe", source: src });
  }
  if (report.riskyTld) signals.push({ signal: "High-abuse ending", detail: `.${tld} domains are cheap and common in scam texts`, weight: "medium", direction: "risk", source: "Link analysis" });
  if (report.shortener) signals.push({ signal: "Hidden destination", detail: `${hostname} is a link shortener that hides where it goes`, weight: "medium", direction: "risk", source: "Link analysis" });
  if (report.ipAddress) signals.push({ signal: "Raw IP address", detail: "Real companies don't send links to bare IP addresses", weight: "high", direction: "risk", source: "Link analysis" });
  if (report.punycode) signals.push({ signal: "Disguised characters", detail: "The domain uses look-alike Unicode characters", weight: "high", direction: "risk", source: "Link analysis" });

  const bits = [
    report.officialFor ? `official ${report.officialFor} domain` : report.impersonates ? `impersonates ${report.impersonates}` : "no brand match",
    report.ageDays !== undefined ? `${report.ageDays} days old` : "age unknown",
    report.riskyTld ? `.${tld} ending` : null,
  ].filter(Boolean);
  return { report, signals, summary: `${domain}: ${bits.join(", ")}` };
}
