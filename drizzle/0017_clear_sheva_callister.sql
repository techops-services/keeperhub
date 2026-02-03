CREATE TABLE "credit_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"tx_hash" text,
	"payment_token" text,
	"payment_amount" text,
	"usd_value" text,
	"workflow_id" text,
	"execution_id" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "credit_balance" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "tier" text DEFAULT 'developer' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "tier_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "tier_is_lifetime" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "org_id_hash" text;--> statement-breakpoint
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_org" ON "credit_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_type" ON "credit_transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_created" ON "credit_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_credit_transactions_tx_hash" ON "credit_transactions" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "idx_organization_org_id_hash" ON "organization" USING btree ("org_id_hash");