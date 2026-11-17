import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";

// Customer-owned hosting records. Draft records do not trigger provisioning.
export const hostingTenant = pgTable("hosting_tenant", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  edition: text("edition").notNull().default("corporate"),
  status: text("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("hosting_tenant_owner_idx").on(t.ownerId)]);

export const hostingDomain = pgTable("hosting_domain", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => hostingTenant.id, { onDelete: "cascade" }),
  fqdn: text("fqdn").notNull(),
  visibility: text("visibility").notNull().default("public"),
  status: text("status").notNull().default("planned"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("hosting_domain_fqdn_unique").on(t.fqdn), index("hosting_domain_tenant_idx").on(t.tenantId)]);

export const hostingApplication = pgTable("hosting_application", {
  id: text("id").primaryKey(),
  tenantId: text("tenant_id").notNull().references(() => hostingTenant.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  runtime: text("runtime").notNull().default("container"),
  source: text("source"),
  status: text("status").notNull().default("planned"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("hosting_app_tenant_idx").on(t.tenantId)]);
