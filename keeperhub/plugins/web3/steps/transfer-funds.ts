import "server-only";

import { ethers } from "ethers";
import { initializeParaSigner } from "@/keeperhub/lib/para/wallet-helpers";
import { getOrganizationIdFromExecution } from "@/keeperhub/lib/workflow-helpers";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

type TransferFundsResult =
  | { success: true; transactionHash: string }
  | { success: false; error: string };

export type TransferFundsCoreInput = {
  amount: string;
  recipientAddress: string;
};

export type TransferFundsInput = StepInput & TransferFundsCoreInput;


/**
 * Core transfer logic
 */
async function stepHandler(
  input: TransferFundsInput
): Promise<TransferFundsResult> {
  const { amount, recipientAddress, _context } = input;

  // Validate recipient address
  if (!ethers.isAddress(recipientAddress)) {
    return {
      success: false,
      error: `Invalid recipient address: ${recipientAddress}`,
    };
  }

  // Validate amount
  if (!amount || amount.trim() === "") {
    return {
      success: false,
      error: "Amount is required",
    };
  }

  let amountInWei: bigint;
  try {
    amountInWei = ethers.parseEther(amount);
  } catch (error) {
    return {
      success: false,
      error: `Invalid amount format: ${getErrorMessage(error)}`,
    };
  }

  // Get organizationId from executionId (passed via _context)
  if (!_context?.executionId) {
    return {
      success: false,
      error: "Execution ID is required to identify the organization",
    };
  }

  let organizationId: string;
  try {
    organizationId = await getOrganizationIdFromExecution(_context.executionId);
  } catch (error) {
    console.error("[Transfer Funds] Failed to get organization ID:", error);
    return {
      success: false,
      error: `Failed to get organization ID: ${getErrorMessage(error)}`,
    };
  }

  // Sepolia testnet RPC URL
  // TODO: Make this configurable in the future
  const SEPOLIA_RPC_URL = "https://chain.techops.services/eth-sepolia";

  let signer: Awaited<ReturnType<typeof initializeParaSigner>> | null = null;
  try {
    signer = await initializeParaSigner(organizationId, SEPOLIA_RPC_URL);
  } catch (error) {
    console.error("[Transfer Funds] Failed to initialize organization wallet:", error);
    return {
      success: false,
      error: `Failed to initialize organization wallet: ${getErrorMessage(error)}`,
    };
  }

  // Send transaction
  try {
    const tx = await signer.sendTransaction({
      to: recipientAddress,
      value: amountInWei,
    });

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    if (!receipt) {
      return {
        success: false,
        error: "Transaction sent but receipt not available",
      };
    }

    console.log("[Transfer Funds] Transaction confirmed:", receipt.hash);

    return {
      success: true,
      transactionHash: receipt.hash,
    };
  } catch (error) {
    console.error("[Transfer Funds] Transaction failed:", error);
    return {
      success: false,
      error: `Transaction failed: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Transfer Funds Step
 * Transfers ETH from the user's wallet to a recipient address
 */
// biome-ignore lint/suspicious/useAwait: "use step" directive requires async
export async function transferFundsStep(
  input: TransferFundsInput
): Promise<TransferFundsResult> {
  "use step";

  return withStepLogging(input, () => stepHandler(input));
}

export const _integrationType = "web3";
