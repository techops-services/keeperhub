-- Add cost tracking columns to workflow_executions table
-- These columns support the dynamic billing system for workflow execution costs

ALTER TABLE "workflow_executions" ADD COLUMN "estimated_cost" integer;
ALTER TABLE "workflow_executions" ADD COLUMN "actual_cost" integer;
ALTER TABLE "workflow_executions" ADD COLUMN "cost_breakdown" jsonb;
ALTER TABLE "workflow_executions" ADD COLUMN "gas_strategy" text;
