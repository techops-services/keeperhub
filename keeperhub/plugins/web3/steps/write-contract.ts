import "server-only";

import { ethers } from "ethers";
import { initializeParaSigner } from "@/keeperhub/lib/para/wallet-helpers";
import { getOrganizationIdFromExecution } from "@/keeperhub/lib/workflow-helpers";
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
 * Get RPC URL based on network selection
 */
function getRpcUrl(network: string): string {
  const RPC_URLS: Record<string, string> = {
    mainnet: "https://chain.techops.services/eth-mainnet",
    sepolia: "https://chain.techops.services/eth-sepolia",
  };

  const rpcUrl = RPC_URLS[network];
  if (!rpcUrl) {
    throw new Error(`Unsupported network: ${network}`);
  }

  return rpcUrl;
}

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

  // Get RPC URL
  let rpcUrl: string;
  try {
    rpcUrl = getRpcUrl(network);
  } catch (error) {
    console.error("[Write Contract] Failed to get RPC URL:", error);
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
    console.error("[Write Contract] Failed to initialize organization wallet:", error);
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
    console.error("[Write Contract] Failed to create contract instance:", error);
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
