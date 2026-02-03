// start custom keeperhub code //
/**
 * Workflow Cost Calculator
 *
 * Calculates estimated execution cost based on:
 * - Base cost per block/node (BILLING_BLOCK_CALL)
 * - Base cost per function call (BILLING_FUNCTION_CALL)
 * - Gas estimation for write functions (with volatility consideration)
 * - Platform fee percentage (BILLING_OVERALL_FEE)
 */

import type { Edge } from "@xyflow/react";
import { ethers } from "ethers";
import {
  getGasStrategy,
  type TriggerType,
} from "@/keeperhub/lib/web3/gas-strategy";
import { getRpcUrlByChainId } from "@/lib/rpc/rpc-config";
import type { WorkflowNode } from "@/lib/workflow-store";
import { gasToCredits, getEthPriceUsd } from "./price-feed";

// Environment variable defaults
const BILLING_BLOCK_CALL = Number(process.env.BILLING_BLOCK_CALL) || 1;
const BILLING_FUNCTION_CALL = Number(process.env.BILLING_FUNCTION_CALL) || 1;
const BILLING_OVERALL_FEE = Number(process.env.BILLING_OVERALL_FEE) || 1; // 1%
const VOLATILITY_INDICATOR = process.env.VOLATILITY_INDICATOR !== "false"; // Default true

export type GasStrategy = "conservative" | "optimized";

export type WorkflowCostEstimate = {
  // Block costs
  blocks: number;
  blockCost: number;

  // Function costs
  functionCalls: number;
  functionCost: number;

  // Gas costs (write functions only)
  writeFunctions: number;
  gasCostCredits: number;
  gasEstimateWei: bigint;
  gasPriceWei: bigint;
  ethPriceUsd: number;

  // Platform fee
  platformFeePercent: number;
  platformFee: number;

  // Total
  subtotal: number;
  totalCredits: number;

  // Strategy info
  triggerType: TriggerType;
  gasStrategy: GasStrategy;
  volatilityWarning: boolean;
};

export type CostBreakdown = {
  blocks: number;
  functionCalls: number;
  gasCost: number;
  platformFee: number;
  gasStrategy: GasStrategy;
};

/**
 * Parse trigger type from a string value
 */
function parseTriggerType(value: string): TriggerType | null {
  const lower = value.toLowerCase();
  if (lower === "webhook" || lower.includes("webhook")) {
    return "webhook";
  }
  if (lower === "event" || lower.includes("event")) {
    return "event";
  }
  if (
    lower === "schedule" ||
    lower === "cron" ||
    lower.includes("schedule") ||
    lower.includes("cron")
  ) {
    return "scheduled";
  }
  return null;
}

/**
 * Map workflow trigger label to TriggerType
 */
function detectTriggerType(nodes: WorkflowNode[]): TriggerType {
  const triggerNode = nodes.find((n) => n.data.type === "trigger");

  if (!triggerNode) {
    return "manual";
  }

  const config = triggerNode.data.config ?? {};
  const triggerType = config.triggerType as string | undefined;

  // Check config.triggerType first (more reliable)
  if (triggerType) {
    const parsed = parseTriggerType(triggerType);
    if (parsed) {
      return parsed;
    }
  }

  // Fall back to label
  const label = triggerNode.data.label ?? "";
  const parsedFromLabel = parseTriggerType(label);
  return parsedFromLabel ?? "manual";
}

/**
 * Check if a node represents a write function (on-chain transaction)
 */
function isWriteFunction(node: WorkflowNode): boolean {
  const config = node.data.config ?? {};
  const actionType = config.actionType as string | undefined;

  // Check for web3 write action types
  if (actionType === "web3/write-contract") {
    return true;
  }

  // Check for ABI function with write state mutability
  const abiFunction = config.function as string | undefined;
  const abi = config.abi as string | undefined;

  if (abiFunction && abi) {
    try {
      const parsedAbi = JSON.parse(abi) as Array<{
        name?: string;
        type?: string;
        stateMutability?: string;
      }>;
      const func = parsedAbi.find(
        (item) => item.name === abiFunction && item.type === "function"
      );
      if (func) {
        // Write functions have stateMutability of "nonpayable" or "payable"
        return (
          func.stateMutability !== "view" && func.stateMutability !== "pure"
        );
      }
    } catch {
      // Invalid ABI, assume not a write function
    }
  }

  return false;
}

/**
 * Count function calls in workflow
 * Each action node with a callable function counts as one function call
 */
function countFunctionCalls(nodes: WorkflowNode[]): number {
  let count = 0;

  for (const node of nodes) {
    if (node.data.type !== "action") {
      continue;
    }

    const config = node.data.config ?? {};
    const actionType = config.actionType as string | undefined;

    // Skip nodes without an action type
    if (!actionType) {
      continue;
    }

    // Each action with a function is a function call
    if (config.function || actionType.includes("/")) {
      count++;
    }
  }

  return count;
}

/**
 * Extract chain ID from workflow nodes
 */
function extractChainId(nodes: WorkflowNode[]): number | undefined {
  for (const node of nodes) {
    const config = node.data.config ?? {};
    const chainId = config.chainId as number | string | undefined;

    if (chainId) {
      return typeof chainId === "string"
        ? Number.parseInt(chainId, 10)
        : chainId;
    }

    // Also check network field
    const network = config.network as number | string | undefined;
    if (network) {
      return typeof network === "string"
        ? Number.parseInt(network, 10)
        : network;
    }
  }

  return;
}

/**
 * Estimate gas for write functions
 * Returns total estimated gas across all write functions
 */
function estimateWriteFunctionGas(
  nodes: WorkflowNode[],
  _chainId: number
): bigint {
  // Default gas estimate per write function (reasonable for simple transfers)
  const DEFAULT_GAS_PER_WRITE = BigInt(100_000);

  const writeNodes = nodes.filter(
    (n) => n.data.type === "action" && isWriteFunction(n)
  );

  if (writeNodes.length === 0) {
    return BigInt(0);
  }

  // For now, use a default estimate per write function
  // In the future, we could do actual contract simulation
  return DEFAULT_GAS_PER_WRITE * BigInt(writeNodes.length);
}

/**
 * Estimate workflow execution cost
 *
 * @param nodes - Workflow nodes
 * @param edges - Workflow edges (unused for now, but useful for future flow analysis)
 * @param chainId - Optional chain ID (auto-detected from nodes if not provided)
 * @param triggerTypeOverride - Override trigger type (for execution-time vs UI preview)
 */
export async function estimateWorkflowCost(
  nodes: WorkflowNode[],
  _edges: Edge[],
  chainId?: number,
  triggerTypeOverride?: TriggerType
): Promise<WorkflowCostEstimate> {
  // Detect trigger type
  const triggerType = triggerTypeOverride ?? detectTriggerType(nodes);

  // Count blocks (action nodes only - trigger doesn't count)
  const actionNodes = nodes.filter((n) => n.data.type === "action");
  const blocks = actionNodes.length;
  const blockCost = blocks * BILLING_BLOCK_CALL;

  // Count function calls
  const functionCalls = countFunctionCalls(nodes);
  const functionCost = functionCalls * BILLING_FUNCTION_CALL;

  // Count write functions
  const writeFunctions = actionNodes.filter((n) => isWriteFunction(n)).length;

  // Initialize gas-related values
  let gasCostCredits = 0;
  let gasEstimateWei = BigInt(0);
  let gasPriceWei = BigInt(0);
  let ethPriceUsd = 0;
  let gasStrategy: GasStrategy = "optimized";
  let volatilityWarning = false;

  // Calculate gas costs for write functions
  if (writeFunctions > 0 && VOLATILITY_INDICATOR) {
    const detectedChainId = chainId ?? extractChainId(nodes) ?? 1; // Default to mainnet

    try {
      // Get RPC URL for chain
      const rpcUrl = getRpcUrlByChainId(detectedChainId, "primary");
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Estimate gas for write functions
      gasEstimateWei = estimateWriteFunctionGas(nodes, detectedChainId);

      // Get gas configuration from AdaptiveGasStrategy
      const strategy = getGasStrategy();
      const gasConfig = await strategy.getGasConfig(
        provider,
        triggerType,
        gasEstimateWei,
        detectedChainId
      );

      gasPriceWei = gasConfig.maxFeePerGas;

      // Determine if conservative strategy was used
      // Time-sensitive triggers or high volatility = conservative
      const isTimeSensitive =
        triggerType === "event" || triggerType === "webhook";
      gasStrategy = isTimeSensitive ? "conservative" : "optimized";

      // Get ETH price
      ethPriceUsd = await getEthPriceUsd();

      // Convert gas to credits
      gasCostCredits = gasToCredits(gasEstimateWei, gasPriceWei, ethPriceUsd);

      // Set volatility warning (we can't access internal volatility from strategy,
      // but we can infer from strategy type)
      volatilityWarning = gasStrategy === "conservative" && !isTimeSensitive;
    } catch (error) {
      console.error("[CostCalculator] Failed to estimate gas:", error);
      // Use default fallback
      gasCostCredits = writeFunctions * 100; // 100 credits per write function as fallback
    }
  }

  // Calculate subtotal (before platform fee)
  const subtotal = blockCost + functionCost + gasCostCredits;

  // Calculate platform fee
  const platformFee = Math.ceil((subtotal * BILLING_OVERALL_FEE) / 100);

  // Total credits
  const totalCredits = subtotal + platformFee;

  return {
    blocks,
    blockCost,
    functionCalls,
    functionCost,
    writeFunctions,
    gasCostCredits,
    gasEstimateWei,
    gasPriceWei,
    ethPriceUsd,
    platformFeePercent: BILLING_OVERALL_FEE,
    platformFee,
    subtotal,
    totalCredits,
    triggerType,
    gasStrategy,
    volatilityWarning,
  };
}

/**
 * Create a cost breakdown for logging/transaction records
 */
export function createCostBreakdown(
  estimate: WorkflowCostEstimate
): CostBreakdown {
  return {
    blocks: estimate.blockCost,
    functionCalls: estimate.functionCost,
    gasCost: estimate.gasCostCredits,
    platformFee: estimate.platformFee,
    gasStrategy: estimate.gasStrategy,
  };
}

/**
 * Format cost estimate as human-readable note
 */
export function formatCostNote(estimate: WorkflowCostEstimate): string {
  const parts = [
    `${estimate.blocks} blocks (${estimate.blockCost} credits)`,
    `${estimate.functionCalls} functions (${estimate.functionCost} credits)`,
  ];

  if (estimate.gasCostCredits > 0) {
    parts.push(
      `${estimate.writeFunctions} write txs (${estimate.gasCostCredits} gas credits)`
    );
  }

  parts.push(`${estimate.platformFee} fee (${estimate.gasStrategy})`);

  return `Workflow execution - ${parts.join(", ")}`;
}

/**
 * Quick check if workflow has sufficient credits
 */
export function hasSufficientCredits(
  creditBalance: number,
  estimate: WorkflowCostEstimate
): boolean {
  return creditBalance >= estimate.totalCredits;
}
// end keeperhub code //
