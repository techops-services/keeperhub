import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { ethers } from "ethers";
import type {
  CustomToken,
  TokenFieldValue,
} from "@/keeperhub/lib/wallet/types";
import { ERC20_ABI } from "@/lib/contracts";
import { db } from "@/lib/db";
import {
  explorerConfigs,
  supportedTokens,
  workflowExecutions,
} from "@/lib/db/schema";
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

type TokenBalance = {
  balance: string;
  balanceRaw: string;
  symbol: string;
  decimals: number;
  name: string;
  tokenAddress: string;
};

type CheckTokenBalanceResult =
  | {
      success: true;
      balances: TokenBalance[];
      address: string;
      addressLink: string;
    }
  | { success: false; error: string };

export type CheckTokenBalanceCoreInput = {
  network: string;
  address: string;
  tokenConfig: string; // JSON string of TokenConfig
  // Legacy support
  tokenAddress?: string;
};

export type CheckTokenBalanceInput = StepInput & CheckTokenBalanceCoreInput;

/**
 * Parse token config from input
 */
function parseTokenConfig(input: CheckTokenBalanceInput): TokenFieldValue {
  // Legacy support: if tokenAddress is provided directly, use custom mode
  if (input.tokenAddress && !input.tokenConfig) {
    return {
      mode: "custom",
      supportedTokenIds: [],
      customTokens: [{ address: input.tokenAddress, symbol: "???" }],
    };
  }

  if (!input.tokenConfig) {
    return {
      mode: "supported",
      supportedTokenIds: [],
      customTokens: [],
    };
  }

  try {
    const parsed = JSON.parse(input.tokenConfig);

    // Parse custom tokens - support multiple formats for backwards compatibility
    let customTokens: CustomToken[] = [];
    if (Array.isArray(parsed.customTokens)) {
      customTokens = parsed.customTokens;
    } else if (Array.isArray(parsed.customTokenAddresses)) {
      // Legacy: convert addresses to tokens
      customTokens = parsed.customTokenAddresses
        .filter((addr: string) => addr && addr.trim() !== "")
        .map((address: string) => ({ address, symbol: "???" }));
    } else if (parsed.customTokenAddress) {
      // Legacy: single address
      customTokens = [{ address: parsed.customTokenAddress, symbol: "???" }];
    }

    return {
      mode: parsed.mode || "supported",
      supportedTokenIds: Array.isArray(parsed.supportedTokenIds)
        ? parsed.supportedTokenIds
        : [],
      customTokens,
    };
  } catch {
    // If parsing fails and it looks like an address, treat as custom
    if (input.tokenConfig.startsWith("0x")) {
      return {
        mode: "custom",
        supportedTokenIds: [],
        customTokens: [{ address: input.tokenConfig, symbol: "???" }],
      };
    }
    return {
      mode: "supported",
      supportedTokenIds: [],
      customTokens: [],
    };
  }
}

/**
 * Get token addresses to check based on config
 * Returns ALL tokens (both supported and custom)
 */
async function getTokenAddresses(
  config: TokenFieldValue,
  chainId: number
): Promise<string[]> {
  const addresses: string[] = [];

  // Get supported token addresses from database
  if (config.supportedTokenIds.length > 0) {
    const tokens = await db
      .select({ tokenAddress: supportedTokens.tokenAddress })
      .from(supportedTokens)
      .where(
        and(
          eq(supportedTokens.chainId, chainId),
          inArray(supportedTokens.id, config.supportedTokenIds)
        )
      );
    addresses.push(...tokens.map((t) => t.tokenAddress));
  }

  // Add custom token addresses
  addresses.push(...config.customTokens.map((t) => t.address));

  // Return unique addresses
  return [...new Set(addresses)];
}

/**
 * Fetch balance for a single token
 */
async function fetchTokenBalance(
  provider: ethers.JsonRpcProvider,
  walletAddress: string,
  tokenAddress: string
): Promise<TokenBalance> {
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  const [balanceRaw, decimals, symbol, name] = await Promise.all([
    contract.balanceOf(walletAddress) as Promise<bigint>,
    contract.decimals() as Promise<bigint>,
    contract.symbol() as Promise<string>,
    contract.name() as Promise<string>,
  ]);

  const decimalsNum = Number(decimals);
  const balance = ethers.formatUnits(balanceRaw, decimalsNum);

  return {
    balance,
    balanceRaw: balanceRaw.toString(),
    symbol,
    decimals: decimalsNum,
    name,
    tokenAddress: tokenAddress.toLowerCase(),
  };
}

/**
 * Core check token balance logic
 */
async function stepHandler(
  input: CheckTokenBalanceInput
): Promise<CheckTokenBalanceResult> {
  console.log("[Check Token Balance] Starting step with input:", {
    network: input.network,
    address: input.address,
    tokenConfig: input.tokenConfig,
    executionId: input._context?.executionId,
  });

  const { network, address, _context } = input;
  const tokenConfig = parseTokenConfig(input);

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

  // Get token addresses to check
  const tokenAddresses = await getTokenAddresses(tokenConfig, chainId);

  if (tokenAddresses.length === 0) {
    return {
      success: false,
      error: "No tokens selected to check",
    };
  }

  console.log(
    "[Check Token Balance] Checking balances for tokens:",
    tokenAddresses
  );

  // Validate all token addresses
  for (const tokenAddress of tokenAddresses) {
    if (!ethers.isAddress(tokenAddress)) {
      console.error(
        "[Check Token Balance] Invalid token address:",
        tokenAddress
      );
      return {
        success: false,
        error: `Invalid token address: ${tokenAddress}`,
      };
    }
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

  // Check balances for all tokens
  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balances: TokenBalance[] = [];

    // Fetch balances in parallel
    const balancePromises = tokenAddresses.map(async (tokenAddress) => {
      try {
        return await fetchTokenBalance(provider, address, tokenAddress);
      } catch (error) {
        console.error(
          `[Check Token Balance] Failed to fetch balance for ${tokenAddress}:`,
          error
        );
        // Return null for failed tokens, we'll filter them out
        return null;
      }
    });

    const results = await Promise.all(balancePromises);

    for (const result of results) {
      if (result) {
        balances.push(result);
      }
    }

    if (balances.length === 0) {
      return {
        success: false,
        error: "Failed to fetch any token balances",
      };
    }

    console.log(
      "[Check Token Balance] Token balances retrieved successfully:",
      {
        address,
        tokenCount: balances.length,
        balances: balances.map((b) => ({
          symbol: b.symbol,
          balance: b.balance,
        })),
      }
    );

    // Fetch explorer config for address link
    const explorerConfig = await db.query.explorerConfigs.findFirst({
      where: eq(explorerConfigs.chainId, chainId),
    });
    const addressLink = explorerConfig
      ? getAddressUrl(explorerConfig, address)
      : "";

    return {
      success: true,
      balances,
      address,
      addressLink,
    };
  } catch (error) {
    console.error(
      "[Check Token Balance] Failed to check token balances:",
      error
    );
    return {
      success: false,
      error: `Failed to check token balances: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * Check Token Balance Step
 * Checks the ERC20 token balance(s) of an address
 */
// biome-ignore lint/suspicious/useAwait: "use step" directive requires async
export async function checkTokenBalanceStep(
  input: CheckTokenBalanceInput
): Promise<CheckTokenBalanceResult> {
  "use step";

  return withStepLogging(input, () => stepHandler(input));
}

export const _integrationType = "web3";
