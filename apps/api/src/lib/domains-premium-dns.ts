/**
 * Domains.co.za Premium DNS REST adapter (v5 Postman contract).
 * Read-only in this release. No registrar/zone mutation is exported.
 *
 * POST /domain/ns is deliberately absent — nameserver delegation is separate.
 * POST /domain/dns with append=false can replace the ENTIRE zone: never call
 * it from an automatic provisioning pathway without verified full snapshot.
 */
import { createHash } from "node:crypto";
import { domainName, type ZoneRecord } from "./dns-zone.ts";

const API_ORIGIN = "https://api.domains.co.za/api";
const supportedTlds = ["co.za", "org.za", "net.za", "com", "net", "org", "africa", "online", "store"];

export interface ProviderDnsRecord {
  id: number;
  name: string;
  type: string;
  content: string;
  ttl: number;
  prio: number;
}
export interface ProviderZoneSnapshot {
  zone: string;
  records: ProviderDnsRecord[];
  digest: string;
  provider: "domains.co.za-premium";
  readOnly: true;
}
export class ProviderDnsError extends Error {}

export function splitManagedDomain(raw: string) {
  const name = domainName(raw);
  for (const tld of supportedTlds) {
    if (name.endsWith("." + tld)) {
      const sld = name.slice(0, -tld.length - 1);
      if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sld)) {
        return { sld, tld, zone: name };
      }
    }
  }
  throw new ProviderDnsError("This domain suffix is not configured for managed DNS.");
}

function parseRecords(payload: unknown): ProviderDnsRecord[] {
  if (!payload || typeof payload !== "object") throw new ProviderDnsError("Invalid registrar response.");
  const response = payload as { intReturnCode?: unknown; arrRecords?: unknown };
  if (response.intReturnCode !== 1 || !Array.isArray(response.arrRecords) ||
      response.arrRecords.length > 5000) {
    throw new ProviderDnsError("Registrar did not return a complete DNS snapshot.");
  }
  return response.arrRecords.map((entry) => {
    if (!entry || typeof entry !== "object") throw new ProviderDnsError("Invalid registrar DNS record.");
    const row = entry as Record<string, unknown>;
    const ttl = Number(row.ttl), prio = Number(row.prio), id = Number(row.id);
    if (!Number.isSafeInteger(id) || id < 0 || !Number.isSafeInteger(ttl) ||
        ttl < 0 || !Number.isSafeInteger(prio) || prio < 0 ||
        typeof row.name !== "string" || typeof row.type !== "string" ||
        typeof row.content !== "string") {
      throw new ProviderDnsError("Invalid registrar DNS record fields.");
    }
    return {
      id, name: row.name, type: row.type.toUpperCase(),
      content: row.content, ttl, prio,
    };
  });
}

/** Parses the exact JSON shape documented for GET /domain/dns, without network access. */
export function parseProviderZone(zoneInput: string, payload: unknown): ProviderZoneSnapshot {
  const zone = splitManagedDomain(zoneInput).zone;
  const records = parseRecords(payload).sort((a, b) => a.id - b.id);
  const digest = createHash("sha256").update(JSON.stringify({ zone, records })).digest("hex");
  return { zone, records, digest, provider: "domains.co.za-premium", readOnly: true };
}

/**
 * Uses a server-only bearer token from the private environment.
 * No external host or URL can be supplied by a caller (prevents SSRF).
 * Authentication via POST /login is intentionally NOT performed in this release;
 * it would require credential handling and rotation separately.
 */
export async function readPremiumZone(rawDomain: string): Promise<ProviderZoneSnapshot> {
  const { sld, tld, zone } = splitManagedDomain(rawDomain);
  const token = process.env.MZC_DOMAINS_API_TOKEN;
  if (!token || token.length < 16) throw new ProviderDnsError("Private registrar read token not configured.");
  const url = new URL(API_ORIGIN + "/domain/dns");
  url.searchParams.set("sld", sld);
  url.searchParams.set("tld", tld);
  try {
    const response = await fetch(url, {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ProviderDnsError("Registrar DNS read unavailable.");
    const body = await response.text();
    if (body.length > 1024 * 1024) throw new ProviderDnsError("DNS response exceeds safety limit.");
    return parseProviderZone(zone, JSON.parse(body) as unknown);
  } catch {
    throw new ProviderDnsError("Cannot read a verified Domains.co.za zone snapshot.");
  }
}

/**
 * Build an inspectable parameter package for POST /domain/dns/entry.
 * NEVER submit it in v0.4. The actual provider write must be gated by the
 * Hosting Engine transaction, payment evidence, ownership and audit.
 */
export function previewAddEntry(zoneInput: string, record: ZoneRecord) {
  const { sld, tld, zone } = splitManagedDomain(zoneInput);
  if (record.name !== zone && !record.name.endsWith("." + zone)) {
    throw new ProviderDnsError("Record owner outside permitted zone.");
  }
  const params = new URLSearchParams({
    sld, tld, type: record.type, name: record.name, content: record.content,
    ttl: String(record.ttl), prio: String(record.priority),
  });
  return { method: "POST" as const, path: "/domain/dns/entry" as const,
    previewOnly: true as const, params: Object.fromEntries(params.entries()) };
}
