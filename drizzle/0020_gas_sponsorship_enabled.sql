-- KEEP-811: Enable gas sponsorship flag in chains gas_config JSONB
-- Adds gasSponsorshipEnabled to chains where Gelato EIP-7702 sponsorship is supported.
-- This flag is checked by isSponsorshipAvailable() alongside the global GAS_SPONSORSHIP_ENABLED env var.

-- Enable sponsorship for Gelato-supported chains (Ethereum, Sepolia, Base, Base Sepolia)
UPDATE "chains" SET "gas_config" = COALESCE("gas_config", '{}') || '{"gasSponsorshipEnabled": true}'
WHERE "chain_id" IN (1, 11155111, 8453, 84532);

-- Explicitly disable for chains without Gelato support (Tempo)
UPDATE "chains" SET "gas_config" = COALESCE("gas_config", '{}') || '{"gasSponsorshipEnabled": false}'
WHERE "chain_id" IN (42429, 42420);

-- Update column comment to document the new field
COMMENT ON COLUMN "chains"."gas_config" IS 'Chain-specific gas configuration. JSON schema: { gasLimitMultiplier?: number, gasLimitMultiplierConservative?: number, minPriorityFeeGwei?: number, maxPriorityFeeGwei?: number, volatilityThreshold?: number, maxFeeMultiplier?: number, gasSponsorshipEnabled?: boolean }';
