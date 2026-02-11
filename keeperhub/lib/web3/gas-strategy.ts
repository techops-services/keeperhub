/**
 * Adaptive Gas Strategy for KeeperHub Web3 Operations
 *
 * Provides intelligent gas estimation based on:
 * - Network volatility (coefficient of variation of recent base fees)
 * - Trigger type (event/webhook = time-sensitive, scheduled = cost-optimized)
 * - Chain-specific configurations (from database with hardcoded fallbacks)
 *
 * @see docs/keeperhub/KEEP-1240/gas.md for full specification
 */

import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { db } from "@/lib/db";
import { chains } from "@/lib/db/schema";

export type TriggerType = "event" | "webhook" | "scheduled" | "manual";

export type GasConfig = {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

export type VolatilityMetrics = {
  baseFees: bigint[];
  mean: bigint;
  stdDev: bigint;
  coefficientOfVariation: number;
  isVolatile: boolean;
};

export type GasStrategyConfig = {
  // Gas limit multipliers
  gasLimitMultiplier: number;
  gasLimitMultiplierConservative: number;

  // Volatility thresholds
  volatilityThreshold: number;

  // Percentiles for different volatility levels
  percentileLowVolatility: number;
  percentileHighVolatility: number;

  // Fee bounds (safety rails)
  minPriorityFeeGwei: number;
  maxPriorityFeeGwei: number;
  maxFeeMultiplier: number;

  // Block sample size
  volatilitySampleBlocks: number;
};

type ChainGasConfig = GasStrategyConfig;

const DEFAULT_CONFIG: GasStrategyConfig = {
  gasLimitMultiplier: 2.0,
  gasLimitMultiplierConservative: 2.5,
  volatilityThreshold: 0.3,
  percentileLowVolatility: 60,
  percentileHighVolatility: 80,
  minPriorityFeeGwei: 0.1,
  maxPriorityFeeGwei: 500,
  maxFeeMultiplier: 2.0,
  volatilitySampleBlocks: 10,
};

/**
 * BigInt square root using Newton's method
 */
function bigIntSqrt(n: bigint): bigint {
  if (n < BigInt(0)) {
    throw new Error("Square root of negative number");
  }
  if (n < BigInt(2)) {
    return n;
  }

  let x = n;
  let y = (x + BigInt(1)) / BigInt(2);

  while (y < x) {
    x = y;
    y = (x + n / x) / BigInt(2);
  }

  return x;
}

/**
 * Parse gwei string to bigint wei
 */
function parseGwei(gwei: string | number): bigint {
  return ethers.parseUnits(gwei.toString(), "gwei");
}

/**
 * Measure network volatility from recent base fee history
 */
async function measureVolatility(
  provider: ethers.Provider,
  blockCount = 40
): Promise<VolatilityMetrics> {
  try {
    // Cast to JsonRpcProvider to access send method
    const jsonRpcProvider = provider as ethers.JsonRpcProvider;

    // Fetch fee history for last N blocks
    const history = await jsonRpcProvider.send("eth_feeHistory", [
      `0x${blockCount.toString(16)}`,
      "latest",
      [], // No percentiles needed, just base fees
    ]);

    const baseFees = history.baseFeePerGas
      .slice(0, -1) // Last entry is for next block (prediction)
      .map((hex: string) => BigInt(hex));

    if (baseFees.length === 0) {
      return {
        baseFees: [],
        mean: BigInt(0),
        stdDev: BigInt(0),
        coefficientOfVariation: 0,
        isVolatile: false,
      };
    }

    // Calculate mean
    const sum = baseFees.reduce((a: bigint, b: bigint) => a + b, BigInt(0));
    const mean = sum / BigInt(baseFees.length);

    // Calculate standard deviation
    const squaredDiffs = baseFees.map((fee: bigint) => {
      const diff = fee > mean ? fee - mean : mean - fee;
      return diff * diff;
    });
    const variance =
      squaredDiffs.reduce((a: bigint, b: bigint) => a + b, BigInt(0)) /
      BigInt(baseFees.length);
    const stdDev = bigIntSqrt(variance);

    // Coefficient of variation (normalized measure)
    const cv =
      mean > BigInt(0) ? Number((stdDev * BigInt(1000)) / mean) / 1000 : 0;

    return {
      baseFees,
      mean,
      stdDev,
      coefficientOfVariation: cv,
      isVolatile: cv >= DEFAULT_CONFIG.volatilityThreshold,
    };
  } catch (error) {
    // If fee history fails (some chains don't support it), return non-volatile
    console.warn("[GasStrategy] Failed to fetch fee history:", error);
    return {
      baseFees: [],
      mean: BigInt(0),
      stdDev: BigInt(0),
      coefficientOfVariation: 0,
      isVolatile: false,
    };
  }
}

/**
 * Get percentile-based fee estimation from recent blocks
 */
async function getPercentileFees(
  provider: ethers.Provider,
  blockCount: number,
  percentile: number
): Promise<{ baseFee: bigint; priorityFee: bigint }> {
  try {
    // Cast to JsonRpcProvider to access send method
    const jsonRpcProvider = provider as ethers.JsonRpcProvider;

    const history = await jsonRpcProvider.send("eth_feeHistory", [
      `0x${blockCount.toString(16)}`,
      "latest",
      [percentile],
    ]);

    // Get latest base fee (for next block)
    const baseFee = BigInt(history.baseFeePerGas.at(-1));

    // Get percentile priority fee from rewards
    const rewards = history.reward
      .map((r: string[]) => BigInt(r[0]))
      .filter((r: bigint) => r > BigInt(0));

    if (rewards.length === 0) {
      // Fallback to default
      return { baseFee, priorityFee: parseGwei("1.5") };
    }

    // Sort and get actual percentile
    rewards.sort((a: bigint, b: bigint) => {
      if (a < b) {
        return -1;
      }
      if (a > b) {
        return 1;
      }
      return 0;
    });
    const index = Math.floor((rewards.length * percentile) / 100);
    const priorityFee = rewards[Math.min(index, rewards.length - 1)];

    return { baseFee, priorityFee };
  } catch (error) {
    // Fallback if fee history fails
    console.warn("[GasStrategy] Failed to get percentile fees:", error);
    const feeData = await provider.getFeeData();
    return {
      baseFee: feeData.maxFeePerGas ?? parseGwei("50"),
      priorityFee: feeData.maxPriorityFeePerGas ?? parseGwei("1.5"),
    };
  }
}

export class AdaptiveGasStrategy {
  private readonly config: GasStrategyConfig;

  constructor(config: Partial<GasStrategyConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  /**
   * Get gas configuration for a transaction
   */
  async getGasConfig(
    provider: ethers.Provider,
    triggerType: TriggerType,
    estimatedGas: bigint,
    chainId: number,
    gasLimitMultiplierOverride?: number
  ): Promise<GasConfig> {
    // Apply chain-specific overrides (from DB with hardcoded fallback)
    const chainConfig = await this.getChainConfig(chainId);

    // Calculate gas limit with safety margin
    const gasLimit = this.calculateGasLimit(
      estimatedGas,
      triggerType,
      chainConfig,
      gasLimitMultiplierOverride
    );

    // Get fee configuration based on strategy
    const feeConfig = await this.calculateFees(
      provider,
      triggerType,
      chainConfig
    );

    return {
      gasLimit,
      maxFeePerGas: feeConfig.maxFeePerGas,
      maxPriorityFeePerGas: feeConfig.maxPriorityFeePerGas,
    };
  }

  private calculateGasLimit(
    estimatedGas: bigint,
    triggerType: TriggerType,
    chainConfig: ChainGasConfig,
    gasLimitMultiplierOverride?: number
  ): bigint {
    let multiplier: number;
    if (gasLimitMultiplierOverride && gasLimitMultiplierOverride > 0) {
      multiplier = gasLimitMultiplierOverride;
    } else if (this.isTimeSensitive(triggerType)) {
      multiplier = chainConfig.gasLimitMultiplierConservative;
    } else {
      multiplier = chainConfig.gasLimitMultiplier;
    }

    // Apply multiplier (using integer math with basis points)
    const multiplierBps = BigInt(Math.floor(multiplier * 10_000));
    return (estimatedGas * multiplierBps) / BigInt(10_000);
  }

  private async calculateFees(
    provider: ethers.Provider,
    triggerType: TriggerType,
    chainConfig: ChainGasConfig
  ): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    // Time-sensitive triggers always use conservative strategy
    if (this.isTimeSensitive(triggerType)) {
      return this.getConservativeFees(provider, chainConfig);
    }

    // Check volatility for scheduled/manual triggers
    const volatility = await measureVolatility(
      provider,
      this.config.volatilitySampleBlocks
    );

    if (volatility.isVolatile) {
      console.log(
        `[GasStrategy] High volatility detected (CV=${volatility.coefficientOfVariation.toFixed(3)}), using conservative fees`
      );
      return this.getConservativeFees(provider, chainConfig);
    }

    // Low volatility - use percentile-based estimation
    return this.getOptimizedFees(provider, chainConfig, volatility);
  }

  private async getConservativeFees(
    provider: ethers.Provider,
    chainConfig: ChainGasConfig
  ): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    const feeData = await provider.getFeeData();

    if (!(feeData.maxFeePerGas && feeData.maxPriorityFeePerGas)) {
      // Fallback for non-EIP-1559 chains (legacy gas price)
      const gasPrice = feeData.gasPrice ?? parseGwei("50");
      return {
        maxFeePerGas: (gasPrice * BigInt(120)) / BigInt(100), // +20%
        maxPriorityFeePerGas: (gasPrice * BigInt(10)) / BigInt(100), // 10% as priority
      };
    }

    // Add 20% buffer to current network estimate
    const maxPriorityFeePerGas = this.clampPriorityFee(
      (feeData.maxPriorityFeePerGas * BigInt(120)) / BigInt(100),
      chainConfig
    );

    const maxFeePerGas = (feeData.maxFeePerGas * BigInt(120)) / BigInt(100);

    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  private async getOptimizedFees(
    provider: ethers.Provider,
    chainConfig: ChainGasConfig,
    volatility: VolatilityMetrics
  ): Promise<{ maxFeePerGas: bigint; maxPriorityFeePerGas: bigint }> {
    // Use percentile based on volatility gradient
    const percentile = this.selectPercentile(volatility.coefficientOfVariation);

    const { baseFee, priorityFee } = await getPercentileFees(
      provider,
      this.config.volatilitySampleBlocks,
      percentile
    );

    const maxPriorityFeePerGas = this.clampPriorityFee(
      priorityFee,
      chainConfig
    );

    // Max fee = base fee * multiplier (account for base fee increases)
    const maxFeePerGas =
      (baseFee * BigInt(Math.floor(chainConfig.maxFeeMultiplier * 100))) /
        BigInt(100) +
      maxPriorityFeePerGas;

    console.log(
      `[GasStrategy] Optimized fees: percentile=${percentile}, ` +
        `baseFee=${ethers.formatUnits(baseFee, "gwei")}gwei, ` +
        `priorityFee=${ethers.formatUnits(maxPriorityFeePerGas, "gwei")}gwei`
    );

    return { maxFeePerGas, maxPriorityFeePerGas };
  }

  private selectPercentile(cv: number): number {
    // Gradient-based percentile selection
    if (cv < 0.15) {
      return 50; // Very stable
    }
    if (cv < 0.2) {
      return 60; // Stable
    }
    if (cv < 0.25) {
      return 70; // Moderate
    }
    return 80; // Elevated (but below threshold)
  }

  private clampPriorityFee(fee: bigint, chainConfig: ChainGasConfig): bigint {
    const min = parseGwei(chainConfig.minPriorityFeeGwei);
    const max = parseGwei(chainConfig.maxPriorityFeeGwei);

    if (fee < min) {
      return min;
    }
    if (fee > max) {
      return max;
    }
    return fee;
  }

  private isTimeSensitive(triggerType: TriggerType): boolean {
    return triggerType === "event" || triggerType === "webhook";
  }

  /**
   * Get chain-specific gas configuration.
   * Fetches from database first, falls back to hardcoded defaults.
   */
  private async getChainConfig(chainId: number): Promise<ChainGasConfig> {
    // Try to fetch from database
    try {
      const chain = await db
        .select({ gasConfig: chains.gasConfig })
        .from(chains)
        .where(eq(chains.chainId, chainId))
        .limit(1);

      if (chain.length > 0 && chain[0].gasConfig) {
        const dbConfig = chain[0].gasConfig as Partial<ChainGasConfig>;
        // Merge: default config < hardcoded overrides < database config
        return {
          ...this.config,
          ...this.getHardcodedOverrides(chainId),
          ...dbConfig,
        } as ChainGasConfig;
      }
    } catch (error) {
      // Database unavailable, fall back to hardcoded
      console.warn(
        "[GasStrategy] Failed to fetch chain config from DB:",
        error
      );
    }

    // Fall back to hardcoded overrides
    return {
      ...this.config,
      ...this.getHardcodedOverrides(chainId),
    } as ChainGasConfig;
  }

  /**
   * Hardcoded chain-specific overrides (fallback when DB unavailable)
   */
  private getHardcodedOverrides(chainId: number): Partial<ChainGasConfig> {
    const overrides: Record<number, Partial<ChainGasConfig>> = {
      // Ethereum mainnet
      1: {
        gasLimitMultiplier: 2.0,
        gasLimitMultiplierConservative: 2.5,
        minPriorityFeeGwei: 0.5,
      },
      // Sepolia testnet
      11155111: {
        gasLimitMultiplier: 2.0,
        gasLimitMultiplierConservative: 2.5,
        minPriorityFeeGwei: 0.1,
      },
      // Arbitrum One
      42161: {
        gasLimitMultiplier: 1.5, // L2 estimates are more accurate
        gasLimitMultiplierConservative: 2.0,
        minPriorityFeeGwei: 0.01,
        maxPriorityFeeGwei: 10,
      },
      // Arbitrum Sepolia
      421614: {
        gasLimitMultiplier: 1.5,
        gasLimitMultiplierConservative: 2.0,
        minPriorityFeeGwei: 0.01,
        maxPriorityFeeGwei: 10,
      },
      // Base
      8453: {
        gasLimitMultiplier: 1.5,
        gasLimitMultiplierConservative: 2.0,
        minPriorityFeeGwei: 0.001,
        maxPriorityFeeGwei: 5,
      },
      // Base Sepolia
      84532: {
        gasLimitMultiplier: 1.5,
        gasLimitMultiplierConservative: 2.0,
        minPriorityFeeGwei: 0.001,
        maxPriorityFeeGwei: 5,
      },
      // Polygon
      137: {
        gasLimitMultiplier: 2.0,
        gasLimitMultiplierConservative: 2.5,
        minPriorityFeeGwei: 30, // Polygon has higher base priority fees
        maxPriorityFeeGwei: 1000,
      },
      // Polygon Amoy testnet
      80002: {
        gasLimitMultiplier: 2.0,
        gasLimitMultiplierConservative: 2.5,
        minPriorityFeeGwei: 30,
        maxPriorityFeeGwei: 1000,
      },
    };

    return overrides[chainId] || {};
  }
}

// ============================================================================
// Retry Escalation Strategy
// ============================================================================

/**
 * Configuration for transaction retry with gas escalation
 */
export type RetryConfig = {
  maxAttempts: number;
  escalationFactor: number; // Multiply priority fee by this each retry
  checkIntervalMs: number; // Time between confirmation checks
  stuckThresholdMs: number; // Time before considering tx stuck
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  escalationFactor: 1.5,
  checkIntervalMs: 5000,
  stuckThresholdMs: 30_000,
};

/**
 * Error thrown when a transaction is stuck after max retry attempts
 */
export class TransactionStuckError extends Error {
  readonly txHash: string;
  readonly attempts: number;

  constructor(txHash: string, attempts: number) {
    super(
      `Transaction ${txHash} stuck after ${attempts} attempt(s). Consider manual intervention.`
    );
    this.name = "TransactionStuckError";
    this.txHash = txHash;
    this.attempts = attempts;
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for transaction confirmation with timeout
 */
async function waitForConfirmation(
  tx: ethers.TransactionResponse,
  config: RetryConfig
): Promise<ethers.TransactionReceipt | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < config.stuckThresholdMs) {
    try {
      // Try to get receipt directly
      const receipt = await tx.provider?.getTransactionReceipt(tx.hash);
      if (receipt?.blockNumber) {
        return receipt;
      }
    } catch (_error) {
      // Receipt not available yet, continue waiting
    }

    await sleep(config.checkIntervalMs);
  }

  return null; // Timed out
}

/**
 * Execute a transaction with automatic retry and gas escalation
 *
 * When a transaction is stuck in the mempool, this function will:
 * 1. Wait for confirmation up to stuckThresholdMs
 * 2. If stuck, send a replacement transaction with higher gas (same nonce)
 * 3. Repeat up to maxAttempts times
 *
 * @param signer - Wallet/signer to send transaction
 * @param txRequest - Transaction request (must include nonce for replacement)
 * @param config - Retry configuration
 * @returns Transaction receipt on success
 * @throws TransactionStuckError if all attempts fail
 */
export async function executeWithRetry(
  signer: ethers.Signer,
  txRequest: ethers.TransactionRequest,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<ethers.TransactionReceipt> {
  let lastTxHash = "";
  let currentPriorityFee = txRequest.maxPriorityFeePerGas as bigint;
  let currentMaxFee = txRequest.maxFeePerGas as bigint;

  // Ensure nonce is set for replacement transactions
  if (txRequest.nonce === undefined) {
    txRequest.nonce = await signer.getNonce("pending");
  }

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    // Escalate gas price for retries (replacement transaction)
    if (attempt > 1) {
      const escalationBps = BigInt(Math.floor(config.escalationFactor * 100));
      currentPriorityFee = (currentPriorityFee * escalationBps) / BigInt(100);
      currentMaxFee = (currentMaxFee * escalationBps) / BigInt(100);

      txRequest.maxPriorityFeePerGas = currentPriorityFee;
      txRequest.maxFeePerGas = currentMaxFee;

      console.log(
        `[GasStrategy] Retry attempt ${attempt}, escalating priority fee to ${ethers.formatUnits(currentPriorityFee, "gwei")} gwei`
      );
    }

    // Send transaction
    const tx = await signer.sendTransaction(txRequest);
    lastTxHash = tx.hash;

    console.log(
      `[GasStrategy] Transaction sent: ${tx.hash} (attempt ${attempt}/${config.maxAttempts})`
    );

    // Wait for confirmation with timeout
    const receipt = await waitForConfirmation(tx, config);

    if (receipt) {
      console.log(
        `[GasStrategy] Transaction confirmed: ${tx.hash}, ` +
          `gasUsed=${receipt.gasUsed.toString()} ` +
          `(${((Number(receipt.gasUsed) / Number(txRequest.gasLimit || receipt.gasUsed)) * 100).toFixed(1)}% of limit)`
      );
      return receipt;
    }

    // Transaction stuck - will retry with higher gas (replacement)
    console.warn(
      `[GasStrategy] Transaction ${tx.hash} stuck after ${config.stuckThresholdMs}ms`
    );
  }

  throw new TransactionStuckError(lastTxHash, config.maxAttempts);
}

// ============================================================================
// Singleton & Exports
// ============================================================================

// Singleton instance
let instance: AdaptiveGasStrategy | null = null;

export function getGasStrategy(
  config?: Partial<GasStrategyConfig>
): AdaptiveGasStrategy {
  if (!instance) {
    instance = new AdaptiveGasStrategy(config);
  }
  return instance;
}

// Reset singleton (for testing)
export function resetGasStrategy(): void {
  instance = null;
}
