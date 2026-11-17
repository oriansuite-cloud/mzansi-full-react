import { Hono } from "hono";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db/index.ts";
import { hostingTenant, hostingDomain, hostingApplication } from "../db/schema/hosting.ts";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";
import { searchDomain, DomainSearchError } from "../lib/domain-search.ts";
import { composeZone, ZoneValidationError } from "../lib/dns-zone.ts";
import { previewAddEntry, readPremiumZone, ProviderDnsError } from "../lib/domains-premium-dns.ts";
import { hostingDnsDraft, hostingDnsAudit } from "../db/schema/dns.ts";

export const hostingRoutes = new Hono<AuthEnv>();
hostingRoutes.use("*", requireAuth);

const tenantInput = z.object({
  name: z.string().trim().min(2).max(120),
  edition: z.enum(["corporate", "reseller"]).default("corporate"),
});
const domainInput = z.object({
  tenantId: z.string().uuid(),
  fqdn: z.string().trim().toLowerCase().max(253).regex(/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Enter a fully qualified domain"),
  visibility: z.enum(["public", "internal"]).default("public"),
});
const applicationInput = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  runtime: z.enum(["container", "wordpress", "node", "python", "static"]).default("container"),
  source: z.string().trim().max(500).optional(),
});

async function parseInput<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | null> {
  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

async function ownedTenant(tenantId: string, ownerId: string) {
  const [tenant] = await db.select({ id: hostingTenant.id }).from(hostingTenant)
    .where(and(eq(hostingTenant.id, tenantId), eq(hostingTenant.ownerId, ownerId))).limit(1);
  return tenant;
}

function checkUrl(key: string) {
  const value = process.env[key];
  return value && /^https?:\/\/[^ ]+$/.test(value) ? value : null;
}

async function probe(key: string, label: string) {
  const endpoint = checkUrl(key);
  if (!endpoint) return { name: label, state: "not-configured" as const, detail: "No connection configured" };
  try {
    const response = await fetch(endpoint, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(2000) });
    return { name: label, state: response.status < 500 ? "reachable" as const : "unavailable" as const,
      detail: "HTTP " + response.status };
  } catch {
    return { name: label, state: "unavailable" as const, detail: "Connection failed" };
  }
}

const searchQuota = new Map<string, { requests: number; resetAt: number }>();
hostingRoutes.get("/domain-search", async (c) => {
  const userId = c.get("user").id;
  const previous = searchQuota.get(userId);
  const now = Date.now();
  const usage = previous && now < previous.resetAt ? previous : { requests: 0, resetAt: now + 60_000 };
  if (usage.requests >= 12) {
    return c.json({ error: { code: "RATE_LIMIT", message: "Maximum 12 searches per minute." } }, 429);
  }
  usage.requests++;
  if (searchQuota.size > 2000) searchQuota.clear();
  searchQuota.set(userId, usage);
  try {
    return c.json({ data: await searchDomain(c.req.query("domain")) });
  } catch (error) {
    if (error instanceof DomainSearchError) {
      return c.json({ error: { code: "DOMAIN_LOOKUP", message: error.message } }, error.status === 422 ? 422 : 503);
    }
    return c.json({ error: { code: "DOMAIN_LOOKUP", message: "Domain lookup unavailable." } }, 503);
  }
});

// DNS orchestration Stage 1: authenticated PREVIEW only.
 // MBC Hosting Engine will later persist approved jobs and supply service receipts.
const zoneRecordInput = z.object({
  name: z.string().max(253),
  type: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "CAA", "SRV"]),
  content: z.string().min(1).max(4096),
  ttl: z.number().int().optional(),
  priority: z.number().int().optional(),
});
const zoneComposeInput = z.object({
  tenantId: z.string().uuid(),
  zone: z.string().min(4).max(253),
  contributions: z.array(z.object({
    producer: z.enum(["hosting", "mail", "verification"]),
    receiptRef: z.string().max(120).optional(),
    records: z.array(zoneRecordInput).max(80),
  })).max(12),
  existing: z.array(zoneRecordInput).max(500).default([]),
}).strict();

hostingRoutes.post("/dns/compose", async (c) => {
  const parsed = await parseInput(c.req.raw, zoneComposeInput);
  if (!parsed) return c.json({ error: {
    code: "VALIDATION_ERROR", message: "Invalid DNS zone composition request",
  } }, 422);
  if (!await ownedTenant(parsed.tenantId, c.get("user").id)) {
    return c.json({ error: { code: "FORBIDDEN", message: "Tenant not found" } }, 403);
  }
  try {
    const plan = composeZone(parsed.zone, parsed.contributions, parsed.existing);
    return c.json({
      data: {
        ...plan,
        providerEntryPreviews: plan.diff.filter((row) => row.action === "add")
          .map((row) => previewAddEntry(plan.zone, row.record)),
      },
      persisted: false,
      published: false,
      message: "Preview only. MBC Hosting Engine workflow and registrar DNS writes remain disabled.",
    });
  } catch (err) {
    if (err instanceof ZoneValidationError || err instanceof Error) {
      return c.json({ error: {
        code: "INVALID_ZONE", message: err instanceof ZoneValidationError
          ? err.message : "Unable to compose DNS plan.",
      } }, 422);
    }
    return c.json({ error: { code: "INVALID_ZONE", message: "Invalid DNS request." } }, 422);
  }
});

// Persist a DNS plan as a deduplicated draft with an immutable creation receipt.
 // Does NOT submit any registration, nameserver, or DNS changes to Domains.co.za.
// Read-only authoritative provider snapshot. Unavailable until a private
// Domains.co.za bearer token is installed; never falls back to public DNS as
// proof of ownership or a complete zone export.
hostingRoutes.get("/dns/provider-zone", async (c) => {
  const tenantId = c.req.query("tenantId");
  const zone = c.req.query("zone");
  if (!tenantId || !z.string().uuid().safeParse(tenantId).success || !zone) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Tenant and zone required" } }, 422);
  }
  if (!await ownedTenant(tenantId, c.get("user").id)) {
    return c.json({ error: { code: "FORBIDDEN", message: "Tenant not found" } }, 403);
  }
  if (!process.env.MZC_DOMAINS_API_TOKEN) {
    return c.json({ error: { code: "NOT_CONFIGURED",
      message: "Private Domains.co.za Premium DNS API token not installed.",
    } }, 503);
  }
  try {
    return c.json({ data: await readPremiumZone(zone), mutationAllowed: false });
  } catch (err) {
    return c.json({ error: { code: "PROVIDER_READ_FAILED",
      message: err instanceof ProviderDnsError ? err.message : "Provider DNS read failed",
    } }, 503);
  }
});

hostingRoutes.post("/dns/drafts", async (c) => {
  const parsed = await parseInput(c.req.raw, zoneComposeInput);
  if (!parsed) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid DNS draft" } }, 422);
  const actorId = c.get("user").id;
  if (!await ownedTenant(parsed.tenantId, actorId)) {
    return c.json({ error: { code: "FORBIDDEN", message: "Tenant not found" } }, 403);
  }
  let plan;
  try {
    plan = composeZone(parsed.zone, parsed.contributions, parsed.existing);
  } catch (err) {
    return c.json({ error: {
      code: "INVALID_ZONE", message: err instanceof ZoneValidationError ? err.message : "Invalid DNS records",
    } }, 422);
  }
  const row = await db.transaction(async (tx) => {
    const [saved] = await tx.insert(hostingDnsDraft).values({
      id: crypto.randomUUID(), tenantId: parsed.tenantId, actorId,
      zone: plan.zone, digest: plan.digest, plan, status: "draft",
    }).onConflictDoNothing().returning();
    if (saved) {
      await tx.insert(hostingDnsAudit).values({
        id: crypto.randomUUID(), draftId: saved.id, actorId,
        event: "dns.draft.created", digest: plan.digest,
      });
      return { record: saved, newlyCreated: true };
    }
    const [existing] = await tx.select().from(hostingDnsDraft)
      .where(and(eq(hostingDnsDraft.tenantId, parsed.tenantId),
        eq(hostingDnsDraft.zone, plan.zone), eq(hostingDnsDraft.digest, plan.digest))).limit(1);
    if (!existing) throw new Error("DNS draft could not be retrieved");
    return { record: existing, newlyCreated: false };
  });
  return c.json({
    data: { id: row.record.id, zone: row.record.zone,
      digest: row.record.digest, status: row.record.status, plan: row.record.plan },
    published: false, newlyCreated: row.newlyCreated,
  }, row.newlyCreated ? 201 : 200);
});

hostingRoutes.get("/dns/drafts", async (c) => {
  const tenantId = c.req.query("tenantId");
  if (!tenantId || !z.string().uuid().safeParse(tenantId).success) {
    return c.json({ error: { code: "VALIDATION_ERROR", message: "Valid tenant ID required" } }, 422);
  }
  if (!await ownedTenant(tenantId, c.get("user").id)) {
    return c.json({ error: { code: "FORBIDDEN", message: "Tenant not found" } }, 403);
  }
  const records = await db.select({
    id: hostingDnsDraft.id, zone: hostingDnsDraft.zone, digest: hostingDnsDraft.digest,
    status: hostingDnsDraft.status, createdAt: hostingDnsDraft.createdAt,
  }).from(hostingDnsDraft).where(eq(hostingDnsDraft.tenantId, tenantId))
    .orderBy(desc(hostingDnsDraft.createdAt)).limit(50);
  return c.json({ data: records, publicationEnabled: false });
});

hostingRoutes.get("/dns/drafts/:id", async (c) => {
  const id = c.req.param("id");
  const actorId = c.get("user").id;
  const [record] = await db.select({ draft: hostingDnsDraft })
    .from(hostingDnsDraft)
    .innerJoin(hostingTenant, eq(hostingDnsDraft.tenantId, hostingTenant.id))
    .where(and(eq(hostingDnsDraft.id, id), eq(hostingTenant.ownerId, actorId))).limit(1);
  if (!record) return c.json({ error: { code: "NOT_FOUND", message: "Draft not found" } }, 404);
  return c.json({ data: record.draft, published: false });
});

hostingRoutes.get("/overview", async (c) => {
  const ownerId = c.get("user").id;
  const [tenants, domains, applications, integrations] = await Promise.all([
    db.select().from(hostingTenant).where(eq(hostingTenant.ownerId, ownerId)).orderBy(desc(hostingTenant.createdAt)).limit(100),
    db.select({
      id: hostingDomain.id, tenantId: hostingDomain.tenantId, fqdn: hostingDomain.fqdn,
      visibility: hostingDomain.visibility, status: hostingDomain.status, createdAt: hostingDomain.createdAt,
    }).from(hostingDomain).innerJoin(hostingTenant, eq(hostingDomain.tenantId, hostingTenant.id))
      .where(eq(hostingTenant.ownerId, ownerId)).orderBy(desc(hostingDomain.createdAt)).limit(150),
    db.select({
      id: hostingApplication.id, tenantId: hostingApplication.tenantId, name: hostingApplication.name,
      runtime: hostingApplication.runtime, source: hostingApplication.source, status: hostingApplication.status,
      createdAt: hostingApplication.createdAt,
    }).from(hostingApplication).innerJoin(hostingTenant, eq(hostingApplication.tenantId, hostingTenant.id))
      .where(eq(hostingTenant.ownerId, ownerId)).orderBy(desc(hostingApplication.createdAt)).limit(150),
    Promise.all([
      probe("MZC_KOMODO_HEALTH_URL", "Komodo"),
      probe("MZC_DNS_PROVIDER_HEALTH_URL", "Domains.co.za Managed DNS"),
      probe("MZC_ENGINE_HEALTH_URL", "MBC Hosting Engine"),
    ]),
  ]);
  return c.json({ tenants, domains, applications, integrations,
    edition: process.env.MZC_EDITION === "reseller" ? "reseller" : "corporate",
    policy: "Draft records only. No live provisioning or DNS mutation from this API.",
    counts: { tenants: tenants.length, domains: domains.length, applications: applications.length } });
});

hostingRoutes.post("/tenants", async (c) => {
  const parsed = await parseInput(c.req.raw, tenantInput);
  if (!parsed) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid tenant name or edition" } }, 422);
  const [record] = await db.insert(hostingTenant).values({
    id: crypto.randomUUID(), ownerId: c.get("user").id, name: parsed.name, edition: parsed.edition,
  }).returning();
  return c.json({ data: record }, 201);
});

hostingRoutes.post("/domains", async (c) => {
  const parsed = await parseInput(c.req.raw, domainInput);
  if (!parsed) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid domain or tenant" } }, 422);
  if (!await ownedTenant(parsed.tenantId, c.get("user").id)) {
    return c.json({ error: { code: "FORBIDDEN", message: "Tenant not found" } }, 403);
  }
  const [record] = await db.insert(hostingDomain).values({
    id: crypto.randomUUID(), tenantId: parsed.tenantId, fqdn: parsed.fqdn, visibility: parsed.visibility,
  }).onConflictDoNothing().returning();
  if (!record) return c.json({ error: { code: "CONFLICT", message: "Domain already registered" } }, 409);
  return c.json({ data: record }, 201);
});

hostingRoutes.post("/applications", async (c) => {
  const parsed = await parseInput(c.req.raw, applicationInput);
  if (!parsed) return c.json({ error: { code: "VALIDATION_ERROR", message: "Invalid application details" } }, 422);
  if (!await ownedTenant(parsed.tenantId, c.get("user").id)) {
    return c.json({ error: { code: "FORBIDDEN", message: "Tenant not found" } }, 403);
  }
  const [record] = await db.insert(hostingApplication).values({
    id: crypto.randomUUID(), tenantId: parsed.tenantId, name: parsed.name,
    runtime: parsed.runtime, source: parsed.source || null,
  }).returning();
  return c.json({ data: record }, 201);
});
