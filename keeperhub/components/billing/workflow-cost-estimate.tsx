"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, Loader2, Zap } from "lucide-react";
import { useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow-store";

// Environment variable defaults (mirrored from server for client-side calculation)
const BILLING_BLOCK_CALL = 1;
const BILLING_FUNCTION_CALL = 1;
const BILLING_OVERALL_FEE = 1; // 1%

type WorkflowCostEstimateProps = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  className?: string;
};

type GasEstimateResponse = {
  gasCostCredits: number;
  gasEstimateWei: string;
  gasPriceWei: string;
  ethPriceUsd: number;
  gasStrategy: "conservative" | "optimized";
  volatilityWarning: boolean;
};

type ClientCostEstimate = {
  blocks: number;
  blockCost: number;
  functionCalls: number;
  functionCost: number;
  writeFunctions: number;
  platformFeePercent: number;
  basePlatformFee: number;
  baseSubtotal: number;
  baseTotalCredits: number;
  triggerType: string;
};

function formatCredits(credits: number): string {
  if (credits >= 1000) {
    return `${(credits / 1000).toFixed(1)}k`;
  }
  return credits.toString();
}

function creditsToUsd(credits: number): string {
  const usd = credits / 100;
  if (usd < 0.01) {
    return "<$0.01";
  }
  return `$${usd.toFixed(2)}`;
}

function formatGwei(weiString: string): string {
  const wei = BigInt(weiString);
  const gwei = Number(wei) / 1e9;
  if (gwei < 0.01) {
    return "<0.01 gwei";
  }
  return `${gwei.toFixed(2)} gwei`;
}

function formatEth(weiString: string, gasPriceWei: string): string {
  const gasLimit = BigInt(weiString);
  const gasPrice = BigInt(gasPriceWei);
  const costWei = gasLimit * gasPrice;
  const eth = Number(costWei) / 1e18;
  if (eth < 0.0001) {
    return "<0.0001 ETH";
  }
  return `${eth.toFixed(6)} ETH`;
}

const TRIGGER_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  webhook: "Webhook",
  event: "Event",
  manual: "Manual",
} as const;

function getTriggerLabel(triggerType: string): string {
  return TRIGGER_LABELS[triggerType] ?? "Manual";
}

/**
 * Detect trigger type from workflow nodes
 */
function detectTriggerType(nodes: WorkflowNode[]): string {
  const triggerNode = nodes.find((n) => n.data.type === "trigger");

  if (!triggerNode) {
    return "manual";
  }

  const config = triggerNode.data.config ?? {};
  const triggerType = config.triggerType as string | undefined;
  const label = triggerNode.data.label ?? "";

  // Check config.triggerType first
  if (triggerType) {
    const lower = triggerType.toLowerCase();
    if (lower.includes("webhook")) {
      return "webhook";
    }
    if (lower.includes("event")) {
      return "event";
    }
    if (lower.includes("schedule") || lower.includes("cron")) {
      return "scheduled";
    }
  }

  // Fall back to label
  const lowerLabel = label.toLowerCase();
  if (lowerLabel.includes("webhook")) {
    return "webhook";
  }
  if (lowerLabel.includes("event")) {
    return "event";
  }
  if (lowerLabel.includes("schedule") || lowerLabel.includes("cron")) {
    return "scheduled";
  }

  return "manual";
}

/**
 * Check if a node represents a write function
 */
function isWriteFunction(node: WorkflowNode): boolean {
  const config = node.data.config ?? {};
  const actionType = config.actionType as string | undefined;

  if (actionType === "web3/write-contract") {
    return true;
  }

  // Check ABI for write state mutability
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
        return (
          func.stateMutability !== "view" && func.stateMutability !== "pure"
        );
      }
    } catch {
      // Invalid ABI
    }
  }

  return false;
}

/**
 * Render gas cost display based on loading/error/data state
 */
function GasCostDisplay({
  isLoading,
  error,
  gasEstimate,
}: {
  isLoading: boolean;
  error: Error | null;
  gasEstimate: GasEstimateResponse | undefined;
}) {
  if (isLoading) {
    return <span className="text-muted-foreground">estimating...</span>;
  }

  if (error) {
    return <span className="text-destructive">error</span>;
  }

  if (!gasEstimate) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help underline decoration-dotted">
          {formatCredits(gasEstimate.gasCostCredits)} credits
        </span>
      </TooltipTrigger>
      <TooltipContent className="text-xs" side="left">
        <div className="space-y-1">
          <div>
            Gas:{" "}
            {formatEth(gasEstimate.gasEstimateWei, gasEstimate.gasPriceWei)}
          </div>
          <div>Gas price: {formatGwei(gasEstimate.gasPriceWei)}</div>
          <div>ETH price: ${gasEstimate.ethPriceUsd.toFixed(2)}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Count function calls in workflow
 */
function countFunctionCalls(nodes: WorkflowNode[]): number {
  let count = 0;

  for (const node of nodes) {
    if (node.data.type !== "action") {
      continue;
    }

    const config = node.data.config ?? {};
    const actionType = config.actionType as string | undefined;

    if (!actionType) {
      continue;
    }

    if (config.function || actionType.includes("/")) {
      count++;
    }
  }

  return count;
}

/**
 * Calculate base workflow cost estimate (blocks, functions - no gas)
 */
function calculateBaseCostEstimate(nodes: WorkflowNode[]): ClientCostEstimate {
  const triggerType = detectTriggerType(nodes);

  // Count action nodes (blocks)
  const actionNodes = nodes.filter((n) => n.data.type === "action");
  const blocks = actionNodes.length;
  const blockCost = blocks * BILLING_BLOCK_CALL;

  // Count function calls
  const functionCalls = countFunctionCalls(nodes);
  const functionCost = functionCalls * BILLING_FUNCTION_CALL;

  // Count write functions
  const writeFunctions = actionNodes.filter((n) => isWriteFunction(n)).length;

  // Calculate base subtotal (without gas)
  const baseSubtotal = blockCost + functionCost;

  // Platform fee on base (gas fee calculated separately)
  const basePlatformFee = Math.ceil((baseSubtotal * BILLING_OVERALL_FEE) / 100);

  // Base total
  const baseTotalCredits = baseSubtotal + basePlatformFee;

  return {
    blocks,
    blockCost,
    functionCalls,
    functionCost,
    writeFunctions,
    platformFeePercent: BILLING_OVERALL_FEE,
    basePlatformFee,
    baseSubtotal,
    baseTotalCredits,
    triggerType,
  };
}

export function WorkflowCostEstimate({
  nodes,
  edges,
  className,
}: WorkflowCostEstimateProps) {
  // Calculate base estimate directly (no API call)
  const baseEstimate = useMemo(() => calculateBaseCostEstimate(nodes), [nodes]);

  // Create query key for gas estimation (only relevant parts)
  const gasQueryKey = useMemo(() => {
    if (baseEstimate.writeFunctions === 0) {
      return null;
    }
    const nodeData = nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      actionType: n.data.config?.actionType,
      function: n.data.config?.function,
      chainId: n.data.config?.chainId,
      contractAddress: n.data.config?.contractAddress,
    }));
    return ["workflow-gas-estimate", JSON.stringify(nodeData)];
  }, [nodes, baseEstimate.writeFunctions]);

  // Fetch gas estimate only when there are write functions
  const {
    data: gasEstimate,
    isLoading: isLoadingGas,
    error: gasError,
  } = useQuery<GasEstimateResponse>({
    queryKey: gasQueryKey ?? ["no-gas-estimate"],
    queryFn: async () => {
      const response = await fetch("/api/billing/estimate-cost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      });

      if (!response.ok) {
        throw new Error("Failed to estimate gas");
      }

      const data = await response.json();
      return {
        gasCostCredits: data.gasCostCredits,
        gasEstimateWei: data.gasEstimateWei,
        gasPriceWei: data.gasPriceWei,
        ethPriceUsd: data.ethPriceUsd,
        gasStrategy: data.gasStrategy,
        volatilityWarning: data.volatilityWarning,
      };
    },
    enabled: gasQueryKey !== null,
    staleTime: 30_000, // Cache for 30 seconds
    retry: 1,
  });

  // Don't show if no action nodes
  if (baseEstimate.blocks === 0) {
    return null;
  }

  const triggerLabel = getTriggerLabel(baseEstimate.triggerType);

  // Calculate totals including gas
  const gasCostCredits = gasEstimate?.gasCostCredits ?? 0;
  const gasPlatformFee =
    gasCostCredits > 0
      ? Math.ceil((gasCostCredits * BILLING_OVERALL_FEE) / 100)
      : 0;
  const totalPlatformFee = baseEstimate.basePlatformFee + gasPlatformFee;
  const totalCredits =
    baseEstimate.baseTotalCredits + gasCostCredits + gasPlatformFee;

  const strategyLabel =
    gasEstimate?.gasStrategy === "conservative" ? "Conservative" : "Optimized";

  return (
    <TooltipProvider>
      <div
        className={cn("space-y-3 rounded-lg border bg-muted/30 p-3", className)}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-sm">Estimated Cost</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="text-muted-foreground hover:text-foreground"
                type="button"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs" side="left">
              <p className="text-xs">
                Cost estimate based on current workflow configuration and
                network gas prices. Actual cost may vary.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Total */}
        <div className="flex items-baseline justify-between">
          <span className="font-bold text-xl">
            {formatCredits(totalCredits)}
            {baseEstimate.writeFunctions > 0 && isLoadingGas && (
              <Loader2 className="ml-2 inline h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </span>
          <span className="text-muted-foreground text-sm">
            {creditsToUsd(totalCredits)}
          </span>
        </div>

        {/* Breakdown */}
        <div className="space-y-1 border-t pt-2 text-xs">
          {baseEstimate.blockCost > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Blocks ({baseEstimate.blocks})
              </span>
              <span>{baseEstimate.blockCost} credits</span>
            </div>
          )}

          {baseEstimate.functionCost > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Functions ({baseEstimate.functionCalls})
              </span>
              <span>{baseEstimate.functionCost} credits</span>
            </div>
          )}

          {baseEstimate.writeFunctions > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Gas ({baseEstimate.writeFunctions} write tx)
              </span>
              <GasCostDisplay
                error={gasError}
                gasEstimate={gasEstimate}
                isLoading={isLoadingGas}
              />
            </div>
          )}

          {totalPlatformFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                Platform fee ({baseEstimate.platformFeePercent}%)
              </span>
              <span>{totalPlatformFee} credits</span>
            </div>
          )}
        </div>

        {/* Strategy info */}
        <div className="flex items-center justify-between border-t pt-2 text-xs">
          <span className="text-muted-foreground">{triggerLabel} trigger</span>
          {baseEstimate.writeFunctions > 0 && gasEstimate && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5",
                gasEstimate.gasStrategy === "conservative"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              )}
            >
              {strategyLabel}
            </span>
          )}
        </div>

        {/* Volatility warning */}
        {gasEstimate?.volatilityWarning && (
          <div className="flex items-start gap-2 rounded bg-amber-50 p-2 text-amber-700 text-xs dark:bg-amber-900/20 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              High gas volatility detected. Using conservative pricing (+20%
              buffer) to ensure transaction success.
            </span>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
