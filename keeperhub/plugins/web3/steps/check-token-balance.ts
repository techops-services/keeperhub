import "server-only";

import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { ERC20_ABI } from "@/lib/contracts";
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

type CheckTokenBalanceResult =
  | {
      success: true;
      balance: string;
      balanceRaw: string;
      symbol: string;
      decimals: number;
      name: string;
      address: string;
      tokenAddress: string;
    }
  | { success: false; error: string };

export type CheckTokenBalanceCoreInput = {
  network: string;
  address: string;
  tokenAddress: string;
};

export type CheckTokenBalanceInput = StepInput & CheckTokenBalanceCoreInput;

/**
 * Core check token balance logic
 */
async function stepHandler(
  input: CheckTokenBalanceInput
): Promise<CheckTokenBalanceResult> {
  console.log("[Check Token Balance] Starting step with input:", {
    network: input.network,
    address: input.address,
    tokenAddress: input.tokenAddress,
    executionId: input._context?.executionId,
  });

  const { network, address, tokenAddress, _context } = input;

  // Get userId from execution context (for user RPC preferences)
  const userId = await getUserIdFromExecution(_context?.executionId);
  if (userId) {
    console.log(
      "[Check Token Balance] Using user RPC preferences for userId:",
      userId
    );
  }

  // Validate wallet address
  if (!ethers.isAddress(address)) {
    console.error("[Check Token Balance] Invalid wallet address:", address);
    return {
      success: false,
      error: `Invalid wallet address: ${address}`,
    };
  }

  // Validate token address
  if (!ethers.isAddress(tokenAddress)) {
    console.error("[Check Token Balance] Invalid token address:", tokenAddress);
    return {
      success: false,
      error: `Invalid token address: ${tokenAddress}`,
    };
  }

  // Get chain ID from network name
  let chainId: number;
  try {
    chainId = getChainIdFromNetwork(network);
    console.log("[Check Token Balance] Resolved chain ID:", chainId);
  } catch (error) {
    console.error("[Check Token Balance] Failed to resolve network:", error);
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
      "[Check Token Balance] Using RPC URL:",
      rpcUrl,
      "source:",
      rpcConfig.source
    );
  } catch (error) {
    console.error("[Check Token Balance] Failed to resolve RPC config:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }

  // Check token balance
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

    console.log(
      "[Check Token Balance] Fetching token info and balance for:",
      address
    );

    // Fetch token metadata and balance in parallel
    const [balanceRaw, decimals, symbol, name] = await Promise.all([
      contract.balanceOf(address) as Promise<bigint>,
      contract.decimals() as Promise<bigint>,
      contract.symbol() as Promise<string>,
      contract.name() as Promise<string>,
    ]);

    const decimalsNum = Number(decimals);
    const balance = ethers.formatUnits(balanceRaw, decimalsNum);

    console.log("[Check Token Balance] Token balance retrieved successfully:", {
      address,
      tokenAddress,
      symbol,
      decimals: decimalsNum,
      balance,
      balanceRaw: balanceRaw.toString(),
    });

    return {
      success: true,
      balance,
      balanceRaw: balanceRaw.toString(),
      symbol,
      decimals: decimalsNum,
      name,
      address,
      tokenAddress,
    };
  } catch (error) {
    console.error(
      "[Check Token Balance] Failed to check token balance:",
      error
    );
    return {
      success: false,
      error: `Failed to check token balance: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Check Token Balance Step
 * Checks the ERC20 token balance of an address
 */
// biome-ignore lint/suspicious/useAwait: "use step" directive requires async
export async function checkTokenBalanceStep(
  input: CheckTokenBalanceInput
): Promise<CheckTokenBalanceResult> {
  "use step";

  return withStepLogging(input, () => stepHandler(input));
}

export const _integrationType = "web3";
