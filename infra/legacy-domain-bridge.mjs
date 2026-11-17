/**
 * VPS-1 transitional registrar-only proxy.
 * Private-network ingress only. No public ports, no WordPress DB credentials,
 * no mutating methods, and no arbitrary upstream URLs.
 *
 * Delete this service when the Hono API has its own Domains.co.za credentials.
 */
import { createServer } from "node:http";

const PORT = 8789;
const UPSTREAM = "http://mzansicloud_platform-store-1/wp-json/mzansi/v1/domains/search";
const TLDS = ["co.za", "com", "africa", "online", "store"];
let current = 0;

createServer(async (req, res) => {
  if (req.method !== "GET") {
    res.writeHead(405, { "Content-Type": "application/json", Allow: "GET" });
    res.end('{"error":"read-only bridge"}');
    return;
  }
  const address = new URL(req.url || "/", "http://localhost");
  if (address.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"status":"ok"}');
    return;
  }
  if (address.pathname !== "/lookup") {
    res.writeHead(404); res.end(); return;
  }
  const fqdn = (address.searchParams.get("domain") || "").trim().toLowerCase();
  const matches = TLDS.some((tld) => {
    if (!fqdn.endsWith("." + tld)) return false;
    const sld = fqdn.slice(0, -tld.length - 1);
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sld);
  });
  if (!matches || fqdn.length > 253) {
    res.writeHead(422, { "Content-Type": "application/json" });
    res.end('{"error":"invalid domain"}');
    return;
  }
  if (++current > 100) { current--; res.writeHead(429); res.end(); return; }
  try {
    const target = new URL(UPSTREAM);
    target.searchParams.set("domain", fqdn);
    const upstream = await fetch(target, {
      headers: { Host: "mzansicloud.co.za", Accept: "application/json" },
      redirect: "error", signal: AbortSignal.timeout(9000),
    });
    if (upstream.status !== 200) throw new Error("Registrar unavailable");
    const body = await upstream.text();
    if (body.length > 16000) throw new Error("Unexpected response size");
    const parsed = JSON.parse(body);
    if (parsed.domain !== fqdn || typeof parsed.available !== "boolean" ||
        parsed.source !== "domains.co.za-api") {
      throw new Error("Unconfirmed registrar result");
    }
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "private, max-age=30", "X-Content-Type-Options": "nosniff" });
    res.end(JSON.stringify({
      domain: parsed.domain,
      available: parsed.available,
      premium: parsed.premium ?? null,
      priceZAR: parsed.priceZAR ?? null,
      requiresQuote: parsed.requiresQuote === true,
    }));
  } catch {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end('{"error":"Live registrar unavailable"}');
  } finally { current--; }
}).listen(PORT, "0.0.0.0", () => {
  console.log("Private read-only registrar bridge listening on container port " + PORT);
});
