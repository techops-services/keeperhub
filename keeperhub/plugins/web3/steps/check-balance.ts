import "server-only";

import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "@/lib/db";
import { workflowExecutions } from "@/lib/db/schema";
import { getChainIdFromNetwork, resolveRpcConfig } from "@/lib/rpc";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

/**
 * Get userId from executionId by querying the workflowExecutions table
 */
async function getUserIdFromExecution(
  executionId: string | undefined
): Promise<string | undefined> {
  if (!executionId) {
    return;
  }

  const execution = await db
    .select({ userId: workflowExecutions.userId })
    .from(workflowExecutions)
    .where(eq(workflowExecutions.id, executionId))
    .limit(1);

  return execution[0]?.userId;
}

type CheckBalanceResult =
  | { success: true; balance: string; balanceWei: string; address: string }
  | { success: false; error: string };

export type CheckBalanceCoreInput = {
  network: string;
  address: string;
};

export type CheckBalanceInput = StepInput & CheckBalanceCoreInput;

/**
 * Core check balance logic
 */
async function stepHandler(
  input: CheckBalanceInput
): Promise<CheckBalanceResult> {
  console.log("[Check Balance] Starting step with input:", {
    network: input.network,
    address: input.address,
    executionId: input._context?.executionId,
  });

  const { network, address, _context } = input;

  // Get userId from execution context (for user RPC preferences)
  const userId = await getUserIdFromExecution(_context?.executionId);
  if (userId) {
    console.log(
      "[Check Balance] Using user RPC preferences for userId:",
      userId
    );
  }

  // Validate address
  if (!ethers.isAddress(address)) {
    console.error("[Check Balance] Invalid address:", address);
    return {
      success: false,
      error: `Invalid Ethereum address: ${address}`,
    };
  }

  // Get chain ID from network name
  let chainId: number;
  try {
    chainId = getChainIdFromNetwork(network);
    console.log("[Check Balance] Resolved chain ID:", chainId);
  } catch (error) {
    console.error("[Check Balance] Failed to resolve network:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }

  // Resolve RPC config (with user preferences)
  let rpcUrl: string;
  try {
    const rpcConfig = await resolveRpcConfig(chainId, userId);
    if (!rpcConfig) {
      throw new Error(`Chain ${chainId} not found or not enabled`);
    }
    rpcUrl = rpcConfig.primaryRpcUrl;
    console.log(
      "[Check Balance] Using RPC URL:",
      rpcUrl,
      "source:",
      rpcConfig.source
    );
  } catch (error) {
    console.error("[Check Balance] Failed to resolve RPC config:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }

  // Check balance
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    console.log("[Check Balance] Checking balance for address:", address);

    const balance = await provider.getBalance(address);
    const balanceEth = ethers.formatEther(balance);

    console.log("[Check Balance] Balance retrieved successfully:", {
      address,
      balanceWei: balance.toString(),
      balanceEth,
    });

    return {
      success: true,
      balance: balanceEth,
      balanceWei: balance.toString(),
      address,
    };
  } catch (error) {
    console.error("[Check Balance] Failed to check balance:", error);
    return {
      success: false,
      error: `Failed to check balance: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Check Balance Step
 * Checks the ETH balance of an address (contract or wallet)
 */
// biome-ignore lint/suspicious/useAwait: "use step" directive requires async
export async function checkBalanceStep(
  input: CheckBalanceInput
): Promise<CheckBalanceResult> {
  "use step";

  return withStepLogging(input, () => stepHandler(input));
}

export const _integrationType = "web3";
