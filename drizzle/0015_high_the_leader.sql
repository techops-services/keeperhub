ALTER TABLE "organization" ADD COLUMN "tier" text DEFAULT 'developer' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "tier_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "tier_is_lifetime" boolean DEFAULT false NOT NULL;