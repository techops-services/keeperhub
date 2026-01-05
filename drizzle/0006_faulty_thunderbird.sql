CREATE TABLE "chains" (
	"id" text PRIMARY KEY NOT NULL,
	"chain_id" integer NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"default_primary_rpc" text NOT NULL,
	"default_fallback_rpc" text,
	"explorer_url" text,
	"explorer_api_url" text,
	"is_testnet" boolean DEFAULT false,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chains_chain_id_unique" UNIQUE("chain_id")
);
--> statement-breakpoint
CREATE TABLE "user_rpc_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chain_id" integer NOT NULL,
	"primary_rpc_url" text NOT NULL,
	"fallback_rpc_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_rpc_preferences" ADD CONSTRAINT "user_rpc_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chains_chain_id" ON "chains" USING btree ("chain_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_rpc_user_chain" ON "user_rpc_preferences" USING btree ("user_id","chain_id");--> statement-breakpoint
CREATE INDEX "idx_user_rpc_user_id" ON "user_rpc_preferences" USING btree ("user_id");