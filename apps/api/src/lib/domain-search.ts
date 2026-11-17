/**
 * Read-only live domain search. Does not reserve, buy, renew or mutate domains.
 *
 * Primary: Domains.co.za REST API with server-side bearer token or reseller login.
 * Transitional: existing verified MzansiCloud WordPress Domains.co.za bridge,
 * never exposed directly as a user-controlled URL. Remove bridge after migration.
 */
const DOMAIN_API = "https://api.domains.co.za/api";
const LEGACY_BRIDGE = "https://mzansicloud.co.za/wp-json/mzansi/v1/domains/search";
const SUPPORTED_TLDS = ["co.za", "com", "africa", "online", "store"] as const;

export type DomainLookup = {
  domain: string;
  available: boolean;
  premium: boolean | null;
  priceZAR: number | null;
  currency: "ZAR";
  source: "domains.co.za-api" | "domains.co.za-legacy-bridge";
  requiresQuote: boolean;
  checkedAt: string;
};

export class DomainSearchError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function parseCandidate(value: string | undefined) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw.length > 253 || raw.length < 5) throw new DomainSearchError(422, "Enter a supported domain name.");
  for (const tld of SUPPORTED_TLDS) {
    if (raw.endsWith("." + tld)) {
      const name = raw.slice(0, -tld.length - 1);
      if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) {
        return { domain: raw, sld: name, tld };
      }
    }
  }
  throw new DomainSearchError(422, "Use a valid .co.za, .com, .africa, .online or .store domain.");
}

const cache = new Map<string, { result: DomainLookup; expires: number }>();
let loginCache: { token: string; expires: number } | null = null;

function isBoolean(value: unknown): boolean | null {
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return null;
}

async function jsonFrom(response: Response) {
  if (!response.ok) throw new DomainSearchError(503, "Registrar search temporarily unavailable.");
  const body = await response.text();
  if (body.length > 16384) throw new DomainSearchError(502, "Registrar response too large.");
  try { return JSON.parse(body) as Record<string, unknown>; }
  catch { throw new DomainSearchError(502, "Registrar returned invalid data."); }
}

async function apiBearer(): Promise<string> {
  const staticToken = process.env.MZC_DOMAINS_API_TOKEN?.trim();
  if (staticToken) return staticToken;
  if (loginCache && Date.now() < loginCache.expires) return loginCache.token;
  const username = process.env.MZC_DOMAINS_API_USERNAME;
  const password = process.env.MZC_DOMAINS_API_PASSWORD;
  if (!username || !password) throw new DomainSearchError(503, "Registrar credentials not configured.");
  const response = await fetch(DOMAIN_API + "/login", {
    method: "POST",
    body: new URLSearchParams({ username, password }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(6500),
  });
  const data = await jsonFrom(response);
  if (typeof data.token !== "string" || !data.token || ![1, "1"].includes(data.intReturnCode as number | string)) {
    throw new DomainSearchError(503, "Registrar authentication failed.");
  }
  loginCache = { token: data.token, expires: Date.now() + 15 * 60_000 };
  return data.token;
}

function resultFromProvider(candidate: ReturnType<typeof parseCandidate>, data: Record<string, unknown>, source: DomainLookup["source"]): DomainLookup {
  if (data.domain !== undefined && data.domain !== candidate.domain) throw new DomainSearchError(502, "Domain mismatch.");
  if (data.sld !== undefined && data.sld !== candidate.sld) throw new DomainSearchError(502, "Registrar result mismatch.");
  if (data.tld !== undefined && String(data.tld).replace(/^\./, "") !== candidate.tld) throw new DomainSearchError(502, "TLD mismatch.");
  const available = isBoolean(data.isAvailable ?? data.available);
  const premium = isBoolean(data.isPremium ?? data.premium);
  if (available === null) throw new DomainSearchError(502, "Registrar availability not confirmed.");
  if (source === "domains.co.za-api" && ![0, 1, "0", "1"].includes(data.intReturnCode as number | string)) {
    throw new DomainSearchError(502, "Registrar did not confirm the result.");
  }
  const priceRaw = data.priceZAR;
  const price = typeof priceRaw === "number" && Number.isFinite(priceRaw) && priceRaw >= 0 ? priceRaw : null;
  return {
    domain: candidate.domain, available, premium, priceZAR: premium !== false ? null : price,
    currency: "ZAR", source, requiresQuote: premium !== false || price === null,
    checkedAt: new Date().toISOString(),
  };
}

async function registrarSearch(candidate: ReturnType<typeof parseCandidate>) {
  const bearer = await apiBearer();
  const url = new URL(DOMAIN_API + "/domain/check");
  url.searchParams.set("sld", candidate.sld);
  url.searchParams.set("tld", candidate.tld);
  let response = await fetch(url, {
    headers: { Authorization: "Bearer " + bearer },
    signal: AbortSignal.timeout(7000),
  });
  if (response.status === 401 && !process.env.MZC_DOMAINS_API_TOKEN) {
    loginCache = null;
    response = await fetch(url, {
      headers: { Authorization: "Bearer " + await apiBearer() },
      signal: AbortSignal.timeout(7000),
    });
  }
  return resultFromProvider(candidate, await jsonFrom(response), "domains.co.za-api");
}

async function bridgeSearch(candidate: ReturnType<typeof parseCandidate>) {
  const configuredBridge = process.env.MZC_DOMAINS_BRIDGE_URL?.trim();
  if (configuredBridge && configuredBridge !== "http://legacy-domain-bridge:8789/lookup") {
    throw new DomainSearchError(503, "Registrar bridge URL is not approved.");
  }
  const url = new URL(configuredBridge || LEGACY_BRIDGE);
  url.searchParams.set("domain", candidate.domain);
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    redirect: "error",
    signal: AbortSignal.timeout(7500),
  });
  return resultFromProvider(candidate, await jsonFrom(response), "domains.co.za-legacy-bridge");
}

export async function searchDomain(domain: string | undefined): Promise<DomainLookup> {
  const candidate = parseCandidate(domain);
  const memo = cache.get(candidate.domain);
  if (memo && memo.expires > Date.now()) return memo.result;
  try {
    const configured = Boolean(process.env.MZC_DOMAINS_API_TOKEN ||
      (process.env.MZC_DOMAINS_API_USERNAME && process.env.MZC_DOMAINS_API_PASSWORD));
    const result = configured ? await registrarSearch(candidate) : await bridgeSearch(candidate);
    if (cache.size > 350) cache.clear();
    cache.set(candidate.domain, { result, expires: Date.now() + 60_000 });
    return result;
  } catch (err) {
    if (err instanceof DomainSearchError) throw err;
    throw new DomainSearchError(503, "Live registrar search unavailable. No availability claim can be made.");
  }
}
