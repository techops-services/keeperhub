/**
 * Web3 Utilities for KeeperHub
 *
 * This module provides transaction management utilities including:
 * - NonceManager: Distributed nonce management with PostgreSQL advisory locks
 * - GasStrategy: Adaptive gas estimation based on network conditions
 * - TransactionManager: High-level transaction execution wrapper
 *
 * @see docs/keeperhub/KEEP-1240/ for specifications
 */

export {
  AdaptiveGasStrategy,
  type GasConfig,
  type GasStrategyConfig,
  getGasStrategy,
  resetGasStrategy,
  type VolatilityMetrics,
} from "./gas-strategy";
export {
  getNonceManager,
  NonceManager,
  type NonceManagerOptions,
  type NonceSession,
  resetNonceManager,
  type ValidationResult,
} from "./nonce-manager";

export {
  isSponsorshipAvailable,
  type SponsoredTxResult,
  sendSponsoredTransaction,
} from "./sponsorship";

export {
  executeContractTransaction,
  executeTransaction,
  getCurrentNonce,
  type TransactionContext,
  type TransactionResult,
  type TriggerType,
  withNonceSession,
} from "./transaction-manager";
