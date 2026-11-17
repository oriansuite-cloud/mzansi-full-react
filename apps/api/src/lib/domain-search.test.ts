import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainSearchError, parseCandidate, searchDomain } from "./domain-search.ts";

afterEach(() => { vi.unstubAllGlobals(); });

describe("live registrar availability parser", () => {
  it("accepts common supported TLDs", () => {
    expect(parseCandidate("Example.Co.Za")).toEqual({ domain: "example.co.za", sld: "example", tld: "co.za" });
    expect(parseCandidate("ab.com").tld).toBe("com");
  });
  it("rejects subdomain hijacks and unsupported TLDs", () => {
    for (const domain of ["foo.bar.co.za", "ftp://example.com", "a.invalid", "white space.co.za", "-bad.com"]) {
      expect(() => parseCandidate(domain)).toThrow(DomainSearchError);
    }
  });
  it("does not treat DNS existence as domain availability", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      domain: "mzc-test-20261117.co.za", available: false, premium: false,
      source: "domains.co.za-api", requiresQuote: true,
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    const result = await searchDomain("mzc-test-20261117.co.za");
    expect(result.available).toBe(false);
    expect(result.source).toBe("domains.co.za-legacy-bridge");
    expect(result.requiresQuote).toBe(true);
  });
  it("fails closed if registrar data lacks isAvailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: "ok",
    }), { status: 200 })));
    await expect(searchDomain("mzc-invalid-provider-20261117.co.za"))
      .rejects.toMatchObject({ status: 502 });
  });
});
