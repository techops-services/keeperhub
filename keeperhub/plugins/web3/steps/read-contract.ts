import "server-only";

import { ethers } from "ethers";
import { getChainIdFromNetwork, getRpcProvider } from "@/lib/rpc";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

type ReadContractResult =
  | { success: true; result: unknown }
  | { success: false; error: string };

export type ReadContractCoreInput = {
  contractAddress: string;
  network: string;
  abi: string;
  abiFunction: string;
  functionArgs?: string;
};

export type ReadContractInput = StepInput & ReadContractCoreInput;

/**
 * Core read contract logic
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Contract interaction requires extensive validation
async function stepHandler(
  input: ReadContractInput
): Promise<ReadContractResult> {
  console.log("[Read Contract] Starting step with input:", {
    contractAddress: input.contractAddress,
    network: input.network,
    abiFunction: input.abiFunction,
    hasFunctionArgs: !!input.functionArgs,
  });

  const { contractAddress, network, abi, abiFunction, functionArgs } = input;

  // Validate contract address
  if (!ethers.isAddress(contractAddress)) {
    console.error("[Read Contract] Invalid contract address:", contractAddress);
    return {
      success: false,
      error: `Invalid contract address: ${contractAddress}`,
    };
  }

  // Parse ABI
  let parsedAbi: unknown;
  try {
    parsedAbi = JSON.parse(abi);
    console.log("[Read Contract] ABI parsed successfully");
  } catch (error) {
    console.error("[Read Contract] Failed to parse ABI:", error);
    return {
      success: false,
      error: `Invalid ABI JSON: ${getErrorMessage(error)}`,
    };
  }

  // Validate ABI is an array
  if (!Array.isArray(parsedAbi)) {
    console.error("[Read Contract] ABI is not an array");
    return {
      success: false,
      error: "ABI must be a JSON array",
    };
  }

  // Find the selected function in the ABI to get output structure
  const functionAbi = parsedAbi.find(
    (item: { type: string; name: string }) =>
      item.type === "function" && item.name === abiFunction
  );

  if (!functionAbi) {
    console.error("[Read Contract] Function not found in ABI:", abiFunction);
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
        console.error("[Read Contract] Function args is not an array");
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
      console.log("[Read Contract] Function arguments parsed:", args);
    } catch (error) {
      console.error(
        "[Read Contract] Failed to parse function arguments:",
        error
      );
      return {
        success: false,
        error: `Invalid function arguments JSON: ${getErrorMessage(error)}`,
      };
    }
  }

  // Get chain ID from network name
  let chainId: number;
  try {
    chainId = getChainIdFromNetwork(network);
    console.log("[Read Contract] Resolved chain ID:", chainId);
  } catch (error) {
    console.error("[Read Contract] Failed to resolve network:", error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }

  // Call the contract function with failover
  try {
    const rpcProvider = await getRpcProvider({ chainId });
    console.log("[Read Contract] Using RPC provider for chain:", chainId);

    const result = await rpcProvider.executeWithFailover(async (provider) => {
      // Create contract instance
      const contract = new ethers.Contract(
        contractAddress,
        parsedAbi,
        provider
      );
      console.log("[Read Contract] Contract instance created");

      // Check if function exists
      if (typeof contract[abiFunction] !== "function") {
        throw new Error(`Function '${abiFunction}' not found in contract ABI`);
      }

      console.log(
        "[Read Contract] Calling function:",
        abiFunction,
        "with args:",
        args
      );

      return await contract[abiFunction](...args);
    });

    console.log("[Read Contract] Function call successful, result:", result);

    // Convert BigInt values to strings for JSON serialization
    const serializedResult = JSON.parse(
      JSON.stringify(result, (_, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    // Transform array results into named objects based on ABI outputs
    let structuredResult = serializedResult;

    // Check if function has outputs defined in ABI
    const outputs = (
      functionAbi as { outputs?: Array<{ name?: string; type: string }> }
    ).outputs;

    if (outputs && outputs.length > 0) {
      if (outputs.length === 1) {
        // Single output: return the value directly if unnamed, or as object if named
        const outputName = outputs[0].name?.trim();
        if (outputName) {
          // Named single output: wrap in object
          structuredResult = {
            [outputName]: Array.isArray(serializedResult)
              ? serializedResult[0]
              : serializedResult,
          };
        } else {
          // Unnamed single output: return raw value
          structuredResult = Array.isArray(serializedResult)
            ? serializedResult[0]
            : serializedResult;
        }
      } else if (Array.isArray(serializedResult)) {
        // Multiple outputs: always map to object with field names (named or generated)
        structuredResult = {};
        outputs.forEach((output, index) => {
          const fieldName = output.name?.trim() || `unnamedOutput${index}`;
          structuredResult[fieldName] = serializedResult[index];
        });
        console.log("[Read Contract] Structured result:", structuredResult);
      }
    }

    return {
      success: true,
      result: structuredResult,
    };
  } catch (error) {
    console.error("[Read Contract] Function call failed:", error);
    return {
      success: false,
      error: `Contract call failed: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Read Contract Step
 * Reads data from a smart contract using view/pure functions
 */
// biome-ignore lint/suspicious/useAwait: "use step" directive requires async
export async function readContractStep(
  input: ReadContractInput
): Promise<ReadContractResult> {
  "use step";

  return withStepLogging(input, () => stepHandler(input));
}

export const _integrationType = "web3";
