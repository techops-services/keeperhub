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
  configuredWriteFunctions: number;
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
  // Note: Plugin uses "abiFunction" field name, not "function"
  const abiFunction = config.abiFunction as string | undefined;
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

type WriteNodeConfig = {
  contractAddress: string;
  abi: string;
  functionName: string;
  args: unknown[];
  chainId: number;
};

/**
 * Validate contract address format (0x prefix, 42 chars)
 */
function isValidContractAddress(address: string): boolean {
  return address.startsWith("0x") && address.length === 42;
}

/**
 * Safely parse JSON, returning null on failure
 */
function safeJsonParse(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Parse function arguments from JSON string
 */
function parseFunctionArgs(argsStr: string | undefined): unknown[] {
  if (!argsStr) {
    return [];
  }
  const parsed = safeJsonParse(argsStr);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Parse chain ID from string or number
 */
function parseChainId(chainId: number | string | undefined): number {
  if (!chainId) {
    return 1; // Default to mainnet
  }
  return typeof chainId === "string" ? Number.parseInt(chainId, 10) : chainId;
}

/**
 * Get the expected input count for a function from the ABI
 */
function getExpectedArgCount(abi: string, functionName: string): number | null {
  const parsedAbi = safeJsonParse(abi);
  if (!Array.isArray(parsedAbi)) {
    return null;
  }

  const func = parsedAbi.find(
    (item: { type?: string; name?: string }) =>
      item.type === "function" && item.name === functionName
  ) as { inputs?: unknown[] } | undefined;

  if (!func) {
    return null;
  }

  return func.inputs?.length ?? 0;
}

/**
 * Check if a write function node is fully configured for gas estimation
 */
function getWriteNodeConfig(node: WorkflowNode): WriteNodeConfig | null {
  const config = node.data.config ?? {};

  const contractAddress = config.contractAddress as string | undefined;
  const abi = config.abi as string | undefined;
  // Plugin uses "abiFunction" field name, not "function"
  const functionName = config.abiFunction as string | undefined;
  // Plugin uses "functionArgs" as JSON string, not "args" as array
  const functionArgsStr = config.functionArgs as string | undefined;
  // Plugin uses "network" field name for chainId
  const chainId = (config.chainId ?? config.network) as
    | number
    | string
    | undefined;

  // All required fields must be present
  if (!(contractAddress && abi && functionName)) {
    return null;
  }

  // Validate contract address format
  if (!isValidContractAddress(contractAddress)) {
    return null;
  }

  // Validate ABI is parseable
  if (!safeJsonParse(abi)) {
    return null;
  }

  // Parse args and validate count matches function signature
  const args = parseFunctionArgs(functionArgsStr);
  const expectedArgCount = getExpectedArgCount(abi, functionName);

  // If we can't determine expected count or args don't match, not configured
  if (expectedArgCount === null || args.length !== expectedArgCount) {
    return null;
  }

  return {
    contractAddress,
    abi,
    functionName,
    args,
    chainId: parseChainId(chainId),
  };
}

/**
 * Estimate gas for a single write function using eth_estimateGas.
 * Returns the raw estimate - gas limit multipliers are applied by
 * AdaptiveGasStrategy.getGasConfig() (chain-specific: 2.0x L1, 1.5x L2).
 */
async function estimateSingleFunctionGas(
  provider: ethers.Provider,
  config: WriteNodeConfig
): Promise<bigint | null> {
  try {
    const contract = new ethers.Contract(
      config.contractAddress,
      config.abi,
      provider
    );

    // Get the function fragment to encode call data
    const fragment = contract.interface.getFunction(config.functionName);
    if (!fragment) {
      throw new Error(`Function ${config.functionName} not found in ABI`);
    }

    // Encode the function call
    const data = contract.interface.encodeFunctionData(
      config.functionName,
      config.args
    );

    // Return raw eth_estimateGas result
    return await provider.estimateGas({
      to: config.contractAddress,
      data,
    });
  } catch (error) {
    console.error(
      `[CostCalculator] Failed to estimate gas for ${config.functionName}:`,
      error
    );
    return null;
  }
}

/**
 * Estimate gas for write functions using actual eth_estimateGas
 * Only estimates for fully configured nodes
 */
async function estimateWriteFunctionGas(
  nodes: WorkflowNode[],
  provider: ethers.Provider
): Promise<{ totalGas: bigint; configuredCount: number }> {
  const writeNodes = nodes.filter(
    (n) => n.data.type === "action" && isWriteFunction(n)
  );

  if (writeNodes.length === 0) {
    return { totalGas: BigInt(0), configuredCount: 0 };
  }

  let totalGas = BigInt(0);
  let configuredCount = 0;

  for (const node of writeNodes) {
    const config = getWriteNodeConfig(node);

    if (config) {
      const gas = await estimateSingleFunctionGas(provider, config);
      if (gas !== null) {
        totalGas += gas;
        configuredCount++;
      }
    }
  }

  return { totalGas, configuredCount };
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
  let configuredWriteFunctions = 0;

  // Calculate gas costs for write functions (only if configured)
  if (writeFunctions > 0 && VOLATILITY_INDICATOR) {
    const detectedChainId = chainId ?? extractChainId(nodes) ?? 1; // Default to mainnet

    try {
      // Get RPC URL for chain
      const rpcUrl = getRpcUrlByChainId(detectedChainId, "primary");
      const provider = new ethers.JsonRpcProvider(rpcUrl);

      // Get raw gas estimates for configured write functions via eth_estimateGas
      const gasResult = await estimateWriteFunctionGas(nodes, provider);
      configuredWriteFunctions = gasResult.configuredCount;

      // Only proceed with pricing if we have configured functions
      if (configuredWriteFunctions > 0) {
        // Pass raw estimate to AdaptiveGasStrategy which applies
        // chain-specific gas limit multipliers (2.0x L1, 1.5x L2)
        // and trigger/volatility-based fee pricing
        const strategy = getGasStrategy();
        const gasConfig = await strategy.getGasConfig(
          provider,
          triggerType,
          gasResult.totalGas,
          detectedChainId
        );

        // Use the strategy's gasLimit (includes chain-specific multiplier)
        gasEstimateWei = gasConfig.gasLimit;
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
      }
    } catch (error) {
      console.error("[CostCalculator] Failed to estimate gas:", error);
      // No fallback - if estimation fails, show 0 until configured
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
    configuredWriteFunctions,
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
    `${estimate.blocks} actions (${estimate.blockCost} credits)`,
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
