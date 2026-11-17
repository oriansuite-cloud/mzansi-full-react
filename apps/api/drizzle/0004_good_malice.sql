CREATE TABLE "hosting_dns_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"draft_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"event" text NOT NULL,
	"digest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosting_dns_draft" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"zone" text NOT NULL,
	"digest" text NOT NULL,
	"plan" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hosting_dns_audit" ADD CONSTRAINT "hosting_dns_audit_draft_id_hosting_dns_draft_id_fk" FOREIGN KEY ("draft_id") REFERENCES "public"."hosting_dns_draft"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_dns_audit" ADD CONSTRAINT "hosting_dns_audit_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_dns_draft" ADD CONSTRAINT "hosting_dns_draft_tenant_id_hosting_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."hosting_tenant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_dns_draft" ADD CONSTRAINT "hosting_dns_draft_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hosting_dns_audit_draft_idx" ON "hosting_dns_audit" USING btree ("draft_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hosting_dns_draft_unique" ON "hosting_dns_draft" USING btree ("tenant_id","zone","digest");--> statement-breakpoint
CREATE INDEX "hosting_dns_draft_tenant_idx" ON "hosting_dns_draft" USING btree ("tenant_id");