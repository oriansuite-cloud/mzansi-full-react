CREATE TABLE "hosting_application" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"runtime" text DEFAULT 'container' NOT NULL,
	"source" text,
	"status" text DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosting_domain" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"fqdn" text NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosting_tenant" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"edition" text DEFAULT 'corporate' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hosting_application" ADD CONSTRAINT "hosting_application_tenant_id_hosting_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."hosting_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_domain" ADD CONSTRAINT "hosting_domain_tenant_id_hosting_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."hosting_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_tenant" ADD CONSTRAINT "hosting_tenant_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hosting_app_tenant_idx" ON "hosting_application" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hosting_domain_fqdn_unique" ON "hosting_domain" USING btree ("fqdn");--> statement-breakpoint
CREATE INDEX "hosting_domain_tenant_idx" ON "hosting_domain" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "hosting_tenant_owner_idx" ON "hosting_tenant" USING btree ("owner_id");