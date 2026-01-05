/**
 * RPC Module - Chain configuration and provider management
 */

// Types
export * from "./types";

// Utilities
export * from "./network-utils";

// Services
export * from "./chain-service";
export * from "./config-service";
export * from "./provider-factory";

// Re-export RpcProviderManager types for convenience
export type {
  RpcProviderManager,
  RpcProviderConfig,
  RpcProviderMetrics,
  FailoverStateChangeCallback,
} from "@/lib/rpc-provider";
