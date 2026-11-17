import { describe, expect, it } from "vitest";
import { composeZone, ZoneValidationError, type Contribution } from "./dns-zone.ts";
import { parseProviderZone, previewAddEntry, splitManagedDomain, ProviderDnsError } from "./domains-premium-dns.ts";

const ZONE = "mzansibusinessmail.co.za";
const existing = [
  { name: "@", type: "A" as const, content: "45.63.3.207" },
  { name: "mail", type: "A" as const, content: "45.63.3.207" },
  { name: "@", type: "MX" as const, content: "mail.mzansibusinessmail.co.za", priority: 0 },
];
const baseContributions: Contribution[] = [
  { producer: "hosting", records: [existing[0]!] },
  { producer: "mail", records: [existing[1]!, existing[2]!] },
];

describe("MBC DNS Zone Composer", () => {
  it("composes the user's observed Domains.co.za pilot without altering records", () => {
    const result = composeZone(ZONE, baseContributions, existing);
    expect(result.zone).toBe(ZONE);
    expect(result.provider).toBe("domains.co.za-premium");
    expect(result.mode).toBe("preview-only");
    expect(result.publicationAllowed).toBe(false);
    expect(result.conflicts).toEqual([]);
    expect(result.diff.map((row) => row.action)).toEqual(["unchanged", "unchanged", "unchanged"]);
    expect(result.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining("SPF"),
      expect.stringContaining("DMARC"),
      expect.stringContaining("DKIM"),
    ]));
  });

  it("produces a stable digest independent of input ordering", () => {
    const a = composeZone(ZONE, baseContributions, existing);
    const b = composeZone(ZONE, [...baseContributions].reverse(), existing);
    expect(a.digest).toBe(b.digest);
  });

  it("plans only additions and preserves unmentioned existing records", () => {
    const plan = composeZone(ZONE, [
      ...baseContributions,
      { producer: "verification", records: [{ name: "_acme-challenge", type: "TXT", content: "challenge-token" }] },
    ], [...existing, { name: "keep", type: "TXT", content: "verification-preserved" }]);
    expect(plan.diff.filter((r) => r.action === "add")).toHaveLength(1);
    expect(plan.existingPreserved.some((r) => r.name === "keep." + ZONE)).toBe(true);
    expect(plan.diff.every((r) => ["unchanged", "add", "blocked"].includes(r.action))).toBe(true);
  });

  it("blocks a CNAME collision with an A record", () => {
    const plan = composeZone(ZONE, [
      { producer: "hosting", records: [
        { name: "www", type: "CNAME", content: ZONE },
      ] },
    ], [{ name: "www", type: "A", content: "45.63.3.207" }]);
    expect(plan.conflicts).toHaveLength(1);
    expect(plan.diff[0]!.action).toBe("blocked");
  });

  it("blocks replacement of an existing SPF policy", () => {
    const plan = composeZone(ZONE, [{ producer: "mail", records: [
      { name: "@", type: "TXT", content: "v=spf1 ip4:45.63.3.207 -all" },
    ] }], [{ name: "@", type: "TXT", content: "v=spf1 include:spf.provider.test ~all" }]);
    expect(plan.diff[0]!.action).toBe("blocked");
  });

  it("rejects unauthorized record families and private keys", () => {
    expect(() => composeZone(ZONE, [{ producer: "verification", records: [
      { name: "@", type: "MX", content: "mail.mzansibusinessmail.co.za" },
    ] }])).toThrow(ZoneValidationError);
    expect(() => composeZone(ZONE, [{ producer: "hosting", records: [
      { name: "test", type: "TXT", content: "-----BEGIN PRIVATE KEY-----abc" },
    ] }])).toThrow(ZoneValidationError);
    expect(() => composeZone(ZONE, [{ producer: "mail", records: [
      { name: "@", type: "A", content: "45.63.3.207" },
    ] }])).toThrow(ZoneValidationError);
  });

  it("rejects invalid IPs, TTL and TXT newline injection", () => {
    for (const record of [
      { name: "@", type: "A" as const, content: "999.99.33.44" },
      { name: "@", type: "A" as const, content: "45.63.3.207", ttl: 0 },
      { name: "verify", type: "TXT" as const, content: "bad\nvalue" },
    ]) {
      expect(() => composeZone(ZONE, [{ producer: "hosting", records: [record] }]))
        .toThrow(ZoneValidationError);
    }
  });

  it("prevents nameserver and SOA proposals in a customer zone", () => {
    expect(() => composeZone(ZONE, [{ producer: "hosting", records: [
      { name: "@", type: "NS" as "A", content: "ns1.tld-ns.com" },
    ] }])).toThrow(ZoneValidationError);
  });

  it("does not silently replace conflicting DKIM public keys", () => {
    const plan = composeZone(ZONE, [{ producer: "mail", records: [
      { name: "selector1._domainkey", type: "TXT", content: "v=DKIM1; p=KEY2" },
    ] }], [{ name: "selector1._domainkey", type: "TXT", content: "v=DKIM1; p=KEY1" }]);
    expect(plan.diff[0]!.action).toBe("blocked");
  });
});

describe("Domains.co.za REST API DNS adapter", () => {
  it("splits the domain according to /domain/dns sld and tld", () => {
    expect(splitManagedDomain(ZONE)).toEqual({ zone: ZONE, sld: "mzansibusinessmail", tld: "co.za" });
    expect(() => splitManagedDomain("host." + ZONE)).toThrow(ProviderDnsError);
  });

  it("reads documented arrRecords response and returns a stable hash", () => {
    const payload = {
      intReturnCode: 1,
      arrRecords: [{
        id: 123, name: ZONE, type: "A", content: "45.63.3.207", ttl: 3600, prio: 0,
      }],
    };
    const first = parseProviderZone(ZONE, payload);
    const second = parseProviderZone(ZONE, payload);
    expect(first.records).toHaveLength(1);
    expect(first.records[0]!.id).toBe(123);
    expect(first.digest).toBe(second.digest);
    expect(first.readOnly).toBe(true);
  });

  it("rejects registrar non-success and incomplete snapshots", () => {
    expect(() => parseProviderZone(ZONE, { intReturnCode: 2, arrRecords: [] })).toThrow(ProviderDnsError);
    expect(() => parseProviderZone(ZONE, { intReturnCode: 1 })).toThrow(ProviderDnsError);
  });

  it("maps a proposed addition to the exact POST /domain/dns/entry fields without sending", () => {
    const result = previewAddEntry(ZONE, {
      name: "mail." + ZONE, type: "A", content: "45.63.3.207", ttl: 3600, priority: 0,
    });
    expect(result.path).toBe("/domain/dns/entry");
    expect(result.previewOnly).toBe(true);
    expect(result.params).toMatchObject({
      sld: "mzansibusinessmail", tld: "co.za", type: "A",
      ttl: "3600", name: "mail.mzansibusinessmail.co.za",
      content: "45.63.3.207", prio: "0",
    });
  });
});
