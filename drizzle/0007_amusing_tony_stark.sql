ALTER TABLE "chains" ADD COLUMN "default_primary_wss" text;--> statement-breakpoint
ALTER TABLE "chains" ADD COLUMN "default_fallback_wss" text;--> statement-breakpoint
ALTER TABLE "chains" ADD COLUMN "explorer_abi_api_url" text;--> statement-breakpoint
ALTER TABLE "chains" ADD COLUMN "explorer_balance_api_url" text;--> statement-breakpoint
ALTER TABLE "user_rpc_preferences" ADD COLUMN "primary_wss_url" text;--> statement-breakpoint
ALTER TABLE "user_rpc_preferences" ADD COLUMN "fallback_wss_url" text;