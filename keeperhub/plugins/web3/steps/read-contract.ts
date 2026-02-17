import "server-only";

import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { ErrorCategory, logUserError } from "@/keeperhub/lib/logging";
import { withPluginMetrics } from "@/keeperhub/lib/metrics/instrumentation/plugin";
import { db } from "@/lib/db";
import { explorerConfigs, workflowExecutions } from "@/lib/db/schema";
import { getAddressUrl } from "@/lib/explorer";
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

type ReadContractResult =
  | { success: true; result: unknown; addressLink: string }
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
    executionId: input._context?.executionId,
  });

  const { contractAddress, network, abi, abiFunction, functionArgs, _context } =
    input;

  // Get userId from execution context (for user RPC preferences)
  const userId = await getUserIdFromExecution(_context?.executionId);
  if (userId) {
    console.log(
      "[Read Contract] Using user RPC preferences for userId:",
      userId
    );
  }

  // Validate contract address
  if (!ethers.isAddress(contractAddress)) {
    logUserError(
      ErrorCategory.VALIDATION,
      "[Read Contract] Invalid contract address:",
      contractAddress,
      {
        plugin_name: "web3",
        action_name: "read-contract",
      }
    );
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
    logUserError(
      ErrorCategory.VALIDATION,
      "[Read Contract] Failed to parse ABI:",
      error,
      {
        plugin_name: "web3",
        action_name: "read-contract",
      }
    );
    return {
      success: false,
      error: `Invalid ABI JSON: ${getErrorMessage(error)}`,
    };
  }

  // Validate ABI is an array
  if (!Array.isArray(parsedAbi)) {
    logUserError(
      ErrorCategory.VALIDATION,
      "[Read Contract] ABI is not an array",
      parsedAbi,
      {
        plugin_name: "web3",
        action_name: "read-contract",
      }
    );
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
    logUserError(
      ErrorCategory.VALIDATION,
      "[Read Contract] Function not found in ABI:",
      abiFunction,
      {
        plugin_name: "web3",
        action_name: "read-contract",
      }
    );
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
        logUserError(
          ErrorCategory.VALIDATION,
          "[Read Contract] Function args is not an array",
          parsedArgs,
          {
            plugin_name: "web3",
            action_name: "read-contract",
          }
        );
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
      logUserError(
        ErrorCategory.VALIDATION,
        "[Read Contract] Failed to parse function arguments:",
        error,
        {
          plugin_name: "web3",
          action_name: "read-contract",
        }
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
    logUserError(
      ErrorCategory.VALIDATION,
      "[Read Contract] Failed to resolve network:",
      error,
      {
        plugin_name: "web3",
        action_name: "read-contract",
      }
    );
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
      "[Read Contract] Using RPC URL:",
      rpcUrl,
      "source:",
      rpcConfig.source
    );
  } catch (error) {
    logUserError(
      ErrorCategory.VALIDATION,
      "[Read Contract] Failed to resolve RPC config:",
      error,
      {
        plugin_name: "web3",
        action_name: "read-contract",
        chain_id: String(chainId),
      }
    );
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }

  // Call the contract function
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Create contract instance
    const contract = new ethers.Contract(contractAddress, parsedAbi, provider);
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

    const result = await contract[abiFunction](...args);

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
        const singleOutput = outputs[0];
        const outputName = singleOutput.name?.trim();
        const outputType = singleOutput.type ?? "";
        const isArrayType = outputType.endsWith("[]");
        // When the ABI output is an array type (e.g. address[]), the result is the full array; do not take [0]
        const singleValue =
          Array.isArray(serializedResult) && !isArrayType
            ? serializedResult[0]
            : serializedResult;
        if (outputName) {
          structuredResult = { [outputName]: singleValue };
        } else {
          structuredResult = singleValue;
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

    // Fetch explorer config for address link
    const explorerConfig = await db.query.explorerConfigs.findFirst({
      where: eq(explorerConfigs.chainId, chainId),
    });
    const addressLink = explorerConfig
      ? getAddressUrl(explorerConfig, contractAddress)
      : "";

    return {
      success: true,
      result: structuredResult,
      addressLink,
    };
  } catch (error) {
    logUserError(
      ErrorCategory.NETWORK_RPC,
      "[Read Contract] Function call failed:",
      error,
      {
        plugin_name: "web3",
        action_name: "read-contract",
        chain_id: String(chainId),
      }
    );
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
export async function readContractStep(
  input: ReadContractInput
): Promise<ReadContractResult> {
  "use step";

  // Enrich input with contract address explorer link for the execution log
  let enrichedInput: ReadContractInput & { contractAddressLink?: string } =
    input;
  try {
    const chainId = getChainIdFromNetwork(input.network);
    const explorerConfig = await db.query.explorerConfigs.findFirst({
      where: eq(explorerConfigs.chainId, chainId),
    });
    if (explorerConfig) {
      const contractAddressLink = getAddressUrl(
        explorerConfig,
        input.contractAddress
      );
      if (contractAddressLink) {
        enrichedInput = { ...input, contractAddressLink };
      }
    }
  } catch {
    // Non-critical: if lookup fails, input logs without the link
  }

  return withPluginMetrics(
    {
      pluginName: "web3",
      actionName: "read-contract",
      executionId: input._context?.executionId,
    },
    () => withStepLogging(enrichedInput, () => stepHandler(input))
  );
}

export const _integrationType = "web3";
