-- KEEP-1154: Explorer URL & ABI Fetching Implementation
-- Separates explorer configuration into its own table

ALTER TABLE "chains" ADD COLUMN "chain_type" text DEFAULT 'evm' NOT NULL;--> statement-breakpoint
ALTER TABLE "chains" DROP COLUMN IF EXISTS "explorer_url";--> statement-breakpoint
ALTER TABLE "chains" DROP COLUMN IF EXISTS "explorer_api_url";--> statement-breakpoint
ALTER TABLE "chains" DROP COLUMN IF EXISTS "explorer_abi_api_url";--> statement-breakpoint
ALTER TABLE "chains" DROP COLUMN IF EXISTS "explorer_balance_api_url";--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "explorer_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"chain_type" text DEFAULT 'evm' NOT NULL,
	"explorer_url" text,
	"explorer_api_type" text,
	"explorer_api_url" text,
	"explorer_tx_path" text DEFAULT '/tx/{hash}',
	"explorer_address_path" text DEFAULT '/address/{address}',
	"explorer_contract_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "explorer_configs_chain_id_unique" UNIQUE("chain_id")
);--> statement-breakpoint
ALTER TABLE "explorer_configs" ADD CONSTRAINT "explorer_configs_chain_id_chains_chain_id_fk" FOREIGN KEY ("chain_id") REFERENCES "public"."chains"("chain_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_explorer_configs_chain_id" ON "explorer_configs" USING btree ("chain_id");
