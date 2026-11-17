import { Hono } from "hono";
import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db/index.ts";
import { hostingTenant, hostingDomain, hostingApplication } from "../db/schema/hosting.ts";
import { requireAuth, type AuthEnv } from "../middleware/auth.ts";

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
      probe("MZC_TECHNITIUM_HEALTH_URL", "Technitium DNS"),
      probe("MZC_ENGINE_HEALTH_URL", "MBC Hosting Engine"),
    ]),
  ]);
  return c.json({ tenants, domains, applications, integrations,
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
