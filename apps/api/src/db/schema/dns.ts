import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { hostingTenant } from "./hosting.ts";
import { user } from "./auth.ts";
import type { ZonePlan } from "../../lib/dns-zone.ts";

/**
 * Durable, tenant-scoped DNS DRAFTS, not DNS publications.
 * The MBC Hosting Engine remains the authority for paid provisioning jobs.
 */
export const hostingDnsDraft = pgTable("hosting_dns_draft", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => hostingTenant.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull().references(() => user.id),
  zone: text("zone").notNull(),
  digest: text("digest").notNull(),
  plan: jsonb("plan").$type<ZonePlan>().notNull(),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("hosting_dns_draft_unique").on(t.tenantId, t.zone, t.digest),
  index("hosting_dns_draft_tenant_idx").on(t.tenantId),
]);

export const hostingDnsAudit = pgTable("hosting_dns_audit", {
  id: text("id").primaryKey(),
  draftId: text("draft_id").notNull().references(() => hostingDnsDraft.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull().references(() => user.id),
  event: text("event").notNull(),
  digest: text("digest").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("hosting_dns_audit_draft_idx").on(t.draftId)]);
