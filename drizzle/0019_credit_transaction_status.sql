-- Add status field for credit reservation flow
ALTER TABLE "credit_transactions" ADD COLUMN "status" text NOT NULL DEFAULT 'completed';
ALTER TABLE "credit_transactions" ADD COLUMN "updated_at" timestamp;

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS "idx_credit_transactions_status" ON "credit_transactions" ("status");
CREATE INDEX IF NOT EXISTS "idx_credit_transactions_execution" ON "credit_transactions" ("execution_id");

-- Update existing records to have 'completed' status (already default, but explicit)
UPDATE "credit_transactions" SET "status" = 'completed' WHERE "status" IS NULL;
