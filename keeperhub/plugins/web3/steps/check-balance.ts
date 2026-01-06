import "server-only";

import { ethers } from "ethers";
import { getChainIdFromNetwork, getRpcProvider } from "@/lib/rpc";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

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
  });

  const { network, address } = input;

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

  // Check balance using RPC provider with failover
  try {
    const rpcProvider = await getRpcProvider({ chainId });
    console.log("[Check Balance] Using RPC provider for chain:", chainId);

    const balance = await rpcProvider.executeWithFailover(async (provider) => {
      console.log("[Check Balance] Checking balance for address:", address);
      return await provider.getBalance(address);
    });

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
