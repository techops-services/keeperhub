import "server-only";

import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { initializeParaSigner } from "@/keeperhub/lib/para/wallet-helpers";
import { getOrganizationIdFromExecution } from "@/keeperhub/lib/workflow-helpers";
import { db } from "@/lib/db";
import { workflowExecutions } from "@/lib/db/schema";
import { getChainIdFromNetwork, resolveRpcConfig } from "@/lib/rpc";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

type WriteContractResult =
  | { success: true; transactionHash: string; result?: unknown }
  | { success: false; error: string };

export type WriteContractCoreInput = {
  contractAddress: string;
  network: string;
  abi: string;
  abiFunction: string;
  functionArgs?: string;
};

export type WriteContractInput = StepInput & WriteContractCoreInput;

/**
 * Core write contract logic
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Contract interaction requires extensive validation
async function stepHandler(
  input: WriteContractInput
): Promise<WriteContractResult> {
  const { contractAddress, network, abi, abiFunction, functionArgs, _context } =
    input;

  // Validate contract address
  if (!ethers.isAddress(contractAddress)) {
    return {
      success: false,
      error: `Invalid contract address: ${contractAddress}`,
    };
  }

  // Parse ABI
  let parsedAbi: unknown;
  try {
    parsedAbi = JSON.parse(abi);
  } catch (error) {
    return {
      success: false,
      error: `Invalid ABI JSON: ${getErrorMessage(error)}`,
    };
  }

  // Validate ABI is an array
  if (!Array.isArray(parsedAbi)) {
    return {
      success: false,
      error: "ABI must be a JSON array",
    };
  }

  // Find the selected function in the ABI
  const functionAbi = parsedAbi.find(
    (item: { type: string; name: string }) =>
      item.type === "function" && item.name === abiFunction
  );

  if (!functionAbi) {
    return {
      success: false,
      error: `Function '${abiFunction}' not found in ABI`,
    };
  }

  // Parse function arguments
  let args: unknown[] = [];
  if (functionArgs && functionArgs.trim() !== "") {
    try {
      const parsedArgs = JSON.parse(functionArgs);
      if (!Array.isArray(parsedArgs)) {
        return {
          success: false,
          error: "Function arguments must be a JSON array",
        };
      }
      // Filter out empty strings at the end of the array (from UI padding)
      args = parsedArgs.filter((arg, index) => {
        // Keep all non-empty values
        if (arg !== "") {
          return true;
        }
        // Keep empty strings if they're not at the end
        return parsedArgs.slice(index + 1).some((a) => a !== "");
      });
    } catch (error) {
      return {
        success: false,
        error: `Invalid function arguments JSON: ${getErrorMessage(error)}`,
      };
    }
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
    console.error("[Write Contract] Failed to get organization ID:", error);
    return {
      success: false,
      error: `Failed to get organization ID: ${getErrorMessage(error)}`,
    };
  }

  // Get userId from execution for RPC preferences
  let userId: string;
  try {
    const execution = await db
      .select({ userId: workflowExecutions.userId })
      .from(workflowExecutions)
      .where(eq(workflowExecutions.id, _context.executionId))
      .then((rows) => rows[0]);
    if (!execution) {
      throw new Error("Execution not found");
    }
    userId = execution.userId;
  } catch (error) {
    console.error("[Write Contract] Failed to get user ID:", error);
    return {
      success: false,
      error: `Failed to get user ID: ${getErrorMessage(error)}`,
    };
  }

  // Get chain ID and resolve RPC config (with user preferences)
  let chainId: number;
  let rpcUrl: string;
  try {
    chainId = getChainIdFromNetwork(network);
    console.log("[Write Contract] Resolved chain ID:", chainId);

    const rpcConfig = await resolveRpcConfig(chainId, userId);
    if (!rpcConfig) {
      throw new Error(`Chain ${chainId} not found or not enabled`);
    }

    rpcUrl = rpcConfig.primaryRpcUrl;
    console.log(
      "[Write Contract] Using RPC URL:",
      rpcUrl,
      "source:",
      rpcConfig.source
    );
  } catch (error) {
    console.error("[Write Contract] Failed to resolve RPC config:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }

  // Initialize Para signer
  let signer: Awaited<ReturnType<typeof initializeParaSigner>> | null = null;
  try {
    signer = await initializeParaSigner(organizationId, rpcUrl);
  } catch (error) {
    console.error(
      "[Write Contract] Failed to initialize organization wallet:",
      error
    );
    return {
      success: false,
      error: `Failed to initialize organization wallet: ${getErrorMessage(error)}`,
    };
  }

  // Create contract instance with signer
  let contract: ethers.Contract;
  try {
    contract = new ethers.Contract(contractAddress, parsedAbi, signer);
  } catch (error) {
    console.error(
      "[Write Contract] Failed to create contract instance:",
      error
    );
    return {
      success: false,
      error: `Failed to create contract instance: ${getErrorMessage(error)}`,
    };
  }

  // Call the contract function
  try {
    // Check if function exists
    if (typeof contract[abiFunction] !== "function") {
      return {
        success: false,
        error: `Function '${abiFunction}' not found in contract ABI`,
      };
    }

    const tx = await contract[abiFunction](...args);

    // Wait for transaction to be mined
    const receipt = await tx.wait();

    console.log("[Write Contract] Transaction confirmed:", receipt.hash);

    return {
      success: true,
      transactionHash: receipt.hash,
      result: undefined,
    };
  } catch (error) {
    console.error("[Write Contract] Function call failed:", error);
    return {
      success: false,
      error: `Contract call failed: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Write Contract Step
 * Writes data to a smart contract using state-changing functions
 */
// biome-ignore lint/suspicious/useAwait: "use step" directive requires async
export async function writeContractStep(
  input: WriteContractInput
): Promise<WriteContractResult> {
  "use step";

  return withStepLogging(input, () => stepHandler(input));
}

export const _integrationType = "web3";
