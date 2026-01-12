/**
 * RPC Module - Chain configuration and provider management
 * @module lib/rpc
 */

// Re-export RpcProviderManager types for convenience
export type {
  FailoverStateChangeCallback,
  RpcProviderConfig,
  RpcProviderManager,
  RpcProviderMetrics,
} from "@/lib/rpc-provider";
// Services
export * from "./chain-service";
export * from "./config-service";
// Utilities
export * from "./network-utils";
export * from "./provider-factory";
// Types
export * from "./types";
