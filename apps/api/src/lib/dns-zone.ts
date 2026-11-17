/**
 * MBC Hosting Engine DNS Zone Composer — pure and provider independent.
 * This is a DRAFT/DIFF engine, not an authoritative DNS server or a publisher.
 * Service contributions must later be authenticated by the provisioning engine.
 */
import { createHash } from "node:crypto";
import { isIP } from "node:net";

export type RecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "CAA" | "SRV";
export type Producer = "hosting" | "mail" | "verification";
export type RecordInput = {
  name: string;
  type: RecordType;
  content: string;
  ttl?: number | undefined;
  priority?: number | undefined;
};
export type Contribution = { producer: Producer; records: RecordInput[]; receiptRef?: string | undefined };
export type ZoneRecord = {
  name: string;
  type: RecordType;
  content: string;
  ttl: number;
  priority: number;
};
export type ZoneDiff = {
  action: "add" | "unchanged" | "blocked";
  producer: Producer;
  record: ZoneRecord;
  reason?: string;
};
export type ZonePlan = {
  zone: string;
  provider: "domains.co.za-premium";
  mode: "preview-only";
  baseline: "caller-supplied-unverified";
  publicationAllowed: false;
  digest: string;
  desired: Array<ZoneRecord & { producer: Producer }>;
  diff: ZoneDiff[];
  existingPreserved: ZoneRecord[];
  conflicts: string[];
  warnings: string[];
  gates: string[];
};
export class ZoneValidationError extends Error {}

const label = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const ownerLabel = /^(?:\*|_?[a-z0-9](?:[a-z0-9_-]{0,61}[a-z0-9])?)$/;
const kinds = new Set<RecordType>(["A", "AAAA", "CNAME", "MX", "TXT", "CAA", "SRV"]);
const producers = new Set<Producer>(["hosting", "mail", "verification"]);

export function domainName(input: string): string {
  if (typeof input !== "string") throw new ZoneValidationError("Invalid domain.");
  const name = input.trim().toLowerCase().replace(/\.$/, "");
  const parts = name.split(".");
  if (name.length > 253 || parts.length < 2 ||
      parts.some((part) => !label.test(part)) || !/^[a-z]{2,63}$/.test(parts.at(-1) ?? "")) {
    throw new ZoneValidationError("Invalid fully qualified DNS domain.");
  }
  return name;
}

function ownerName(input: string, zone: string): string {
  if (typeof input !== "string" || input.length > 253) throw new ZoneValidationError("Invalid DNS owner.");
  const raw = input.trim().toLowerCase().replace(/\.$/, "");
  const fqdn = raw === "@" || raw === "" ? zone
    : raw === zone || raw.endsWith("." + zone) ? raw
    : raw + "." + zone;
  if (fqdn.length > 253 || (fqdn !== zone && !fqdn.endsWith("." + zone))) {
    throw new ZoneValidationError("DNS owner is outside its zone.");
  }
  const relative = fqdn === zone ? "" : fqdn.slice(0, -(zone.length + 1));
  if (relative && relative.split(".").some((part) => !ownerLabel.test(part))) {
    throw new ZoneValidationError("Invalid DNS owner label.");
  }
  return fqdn;
}

function cleanRecord(input: RecordInput, zone: string): ZoneRecord {
  if (!input || typeof input !== "object" || !kinds.has(input.type)) {
    throw new ZoneValidationError("Unsupported DNS record type.");
  }
  const name = ownerName(input.name, zone);
  const ttl = input.ttl ?? 3600;
  const priority = input.priority ?? 0;
  if (!Number.isInteger(ttl) || ttl < 300 || ttl > 86400) {
    throw new ZoneValidationError("DNS TTL must be between 300 and 86400 seconds.");
  }
  if (!Number.isInteger(priority) || priority < 0 || priority > 65535) {
    throw new ZoneValidationError("DNS priority must be between 0 and 65535.");
  }
  if (typeof input.content !== "string") throw new ZoneValidationError("Record content must be text.");
  let content = input.content.trim();
  if (!content || content.length > 4096 || /[\u0000-\u001f\u007f]/.test(content)) {
    throw new ZoneValidationError("DNS record content is invalid or too long.");
  }
  if (/PRIVATE\s+KEY|BEGIN\s+(?:RSA|EC|OPENSSH)\s+PRIVATE/i.test(content)) {
    throw new ZoneValidationError("Private keys must never be published as DNS records.");
  }
  if (input.type === "A" && isIP(content) !== 4) throw new ZoneValidationError("Invalid IPv4 address.");
  if (input.type === "AAAA" && isIP(content) !== 6) throw new ZoneValidationError("Invalid IPv6 address.");
  if (input.type === "MX" || input.type === "CNAME") content = domainName(content);
  if (input.type === "CNAME" && name === zone) {
    throw new ZoneValidationError("Zone apex CNAME is not supported.");
  }
  if (input.type === "TXT" && /^v=spf1(?:\s|$)/i.test(content) &&
      (name.startsWith("_") || !content.toLowerCase().startsWith("v=spf1 "))) {
    throw new ZoneValidationError("Invalid SPF record.");
  }
  if (name.startsWith("_dmarc.") && (input.type !== "TXT" ||
      !/^v=DMARC1;\s*p=(?:none|quarantine|reject)(?:;|$)/i.test(content))) {
    throw new ZoneValidationError("Invalid DMARC TXT record.");
  }
  if (name.includes("._domainkey.") && input.type === "TXT" &&
      !/^v=DKIM1;[\s\S]*\bp=/i.test(content)) {
    throw new ZoneValidationError("Invalid public DKIM TXT record.");
  }
  return { name, type: input.type, content, ttl, priority };
}

function signature(record: ZoneRecord) {
  return JSON.stringify([record.name, record.type, record.content, record.ttl, record.priority]);
}
function semanticKey(record: ZoneRecord) {
  return record.name + "|" + record.type + "|" + record.content + "|" + record.priority;
}
function conflictsWith(a: ZoneRecord, b: ZoneRecord): boolean {
  if (a.name !== b.name) return false;
  if (a.type === "CNAME" || b.type === "CNAME") return signature(a) !== signature(b);
  if (a.type === "TXT" && b.type === "TXT") {
    const aSpf = /^v=spf1(?:\s|$)/i.test(a.content);
    const bSpf = /^v=spf1(?:\s|$)/i.test(b.content);
    if (aSpf && bSpf) return signature(a) !== signature(b);
    const exclusive = a.name.startsWith("_dmarc.") || a.name.includes("._domainkey.");
    if (exclusive) return signature(a) !== signature(b);
  }
  return semanticKey(a) === semanticKey(b) && signature(a) !== signature(b);
}

export function composeZone(zoneInput: string, contributions: Contribution[],
  prior: RecordInput[] = []): ZonePlan {
  const zone = domainName(zoneInput);
  if (!Array.isArray(contributions) || !Array.isArray(prior) ||
      contributions.length > 12 || prior.length > 500) {
    throw new ZoneValidationError("Too many DNS contributions or existing records.");
  }
  const desired: Array<ZoneRecord & { producer: Producer }> = [];
  const existingPreserved = prior.map((r) => cleanRecord(r, zone))
    .sort((a, b) => signature(a).localeCompare(signature(b)));
  const conflicts: string[] = [];
  const warnings: string[] = [];

  for (const part of contributions) {
    if (!part || !producers.has(part.producer) || !Array.isArray(part.records) || part.records.length > 80) {
      throw new ZoneValidationError("Invalid DNS service contribution.");
    }
    for (const item of part.records) {
      const record = cleanRecord(item, zone);
      if (part.producer === "verification" && !["TXT", "CNAME", "CAA"].includes(record.type)) {
        throw new ZoneValidationError("Verification service cannot change hosting or mail routing.");
      }
      if (part.producer === "hosting" &&
          (record.type === "MX" || record.name.includes("._domainkey.") || record.name.startsWith("_dmarc.") ||
            (record.type === "TXT" && /^v=spf1(?:\s|$)/i.test(record.content)))) {
        throw new ZoneValidationError("Hosting service cannot replace mail-owned DNS records.");
      }
      if (part.producer === "mail" && record.name === zone && ["A", "AAAA", "CNAME"].includes(record.type)) {
        throw new ZoneValidationError("Mail service cannot replace the website apex address.");
      }
      if (part.producer === "verification" &&
          (record.name.includes("._domainkey.") || record.name.startsWith("_dmarc.") ||
            (record.type === "TXT" && /^v=spf1(?:\s|$)/i.test(record.content)))) {
        throw new ZoneValidationError("Verification service cannot edit mail authentication records.");
      }
      const duplicate = desired.find((row) => signature(row) === signature(record));
      if (!duplicate) desired.push({ ...record, producer: part.producer });
    }
  }
  if (desired.length > 150) throw new ZoneValidationError("DNS plan exceeds 150 records.");
  desired.sort((a, b) => signature(a).localeCompare(signature(b)));
  const diff: ZoneDiff[] = [];
  for (const record of desired) {
    const matches = existingPreserved.filter((x) => signature(x) === signature(record));
    if (matches.length > 0) {
      diff.push({ action: "unchanged", producer: record.producer, record });
      continue;
    }
    const collision = [...existingPreserved, ...desired.filter((x) => x !== record)]
      .find((x) => conflictsWith(record, x));
    if (collision) {
      const reason = "Protected or conflicting " + record.type + " record at " + record.name;
      if (!conflicts.includes(reason)) conflicts.push(reason);
      diff.push({ action: "blocked", producer: record.producer, record, reason });
    } else {
      diff.push({ action: "add", producer: record.producer, record });
    }
  }
  if (!desired.some((r) => r.type === "MX")) warnings.push("Mail MX record not contributed.");
  if (!desired.some((r) => r.type === "TXT" && /^v=spf1(?:\s|$)/i.test(r.content))) {
    warnings.push("SPF TXT record not contributed; do not assume mail-sending IP.");
  }
  if (!desired.some((r) => r.name === "_dmarc." + zone)) warnings.push("DMARC TXT record not contributed.");
  if (!desired.some((r) => r.name.includes("._domainkey."))) {
    warnings.push("DKIM public key not contributed; it must originate from the Mail VPS.");
  }
  const digest = createHash("sha256").update(JSON.stringify({ zone, desired, existingPreserved })).digest("hex");
  return {
    zone, provider: "domains.co.za-premium", mode: "preview-only",
    baseline: "caller-supplied-unverified", publicationAllowed: false,
    digest, desired, diff, existingPreserved, conflicts, warnings,
    gates: [
      "MBC Hosting Engine verifies paid entitlement and tenant ownership",
      "Hosting VPS and Mail VPS return authenticated provisioning receipts",
      "Mail VPS supplies public DKIM, SPF sending policy, MX and DMARC",
      "Domains.co.za authoritative zone snapshot checked for drift and preservation",
      "Privileged operator approves idempotent DNS changes and audit receipt",
      "DNS changes verified against provider and public authoritative nameservers",
    ],
  };
}
