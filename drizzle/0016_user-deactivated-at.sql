-- Migration: Add deactivatedAt column to users table
-- Ticket: KEEP-491
-- Description: Soft delete support for user account deactivation

ALTER TABLE "users" ADD COLUMN "deactivated_at" timestamp;
