import { type Commitment, Connection } from "@solana/web3.js";

/**
 * Solana RPC Provider Manager
 *
 * Similar to the EVM RpcProviderManager but uses @solana/web3.js Connection
 * instead of ethers.JsonRpcProvider.
 */

export type SolanaRpcMetricsCollector = {
  recordPrimaryAttempt(chainName: string): void;
  recordPrimaryFailure(chainName: string): void;
  recordFallbackAttempt(chainName: string): void;
  recordFallbackFailure(chainName: string): void;
  recordFailoverEvent(chainName: string): void;
};

export type SolanaFailoverStateChangeCallback = (
  chainName: string,
  isUsingFallback: boolean,
  reason: "failover" | "recovery"
) => void;

export const noopSolanaMetricsCollector: SolanaRpcMetricsCollector = {
  recordPrimaryAttempt: () => {
    /* noop */
  },
  recordPrimaryFailure: () => {
    /* noop */
  },
  recordFallbackAttempt: () => {
    /* noop */
  },
  recordFallbackFailure: () => {
    /* noop */
  },
  recordFailoverEvent: () => {
    /* noop */
  },
};

export const consoleSolanaMetricsCollector: SolanaRpcMetricsCollector = {
  recordPrimaryAttempt: (chain) =>
    console.debug(`[Solana RPC Metrics] Primary attempt: ${chain}`),
  recordPrimaryFailure: (chain) =>
    console.debug(`[Solana RPC Metrics] Primary failure: ${chain}`),
  recordFallbackAttempt: (chain) =>
    console.debug(`[Solana RPC Metrics] Fallback attempt: ${chain}`),
  recordFallbackFailure: (chain) =>
    console.debug(`[Solana RPC Metrics] Fallback failure: ${chain}`),
  recordFailoverEvent: (chain) =>
    console.debug(`[Solana RPC Metrics] Failover event: ${chain}`),
};

export type SolanaProviderConfig = {
  primaryRpcUrl: string;
  fallbackRpcUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
  chainName?: string;
  commitment?: Commitment;
};

export type SolanaProviderMetrics = {
  primaryAttempts: number;
  primaryFailures: number;
  fallbackAttempts: number;
  fallbackFailures: number;
  totalRequests: number;
  lastFailoverTime: Date | null;
};

export type SolanaProviderManagerOptions = {
  config: SolanaProviderConfig;
  metricsCollector?: SolanaRpcMetricsCollector;
  onFailoverStateChange?: SolanaFailoverStateChangeCallback;
};

export class SolanaProviderManager {
  private primaryConnection: Connection | null = null;
  private fallbackConnection: Connection | null = null;
  private readonly config: Required<
    Omit<SolanaProviderConfig, "fallbackRpcUrl">
  > & {
    fallbackRpcUrl?: string;
  };
  private readonly metrics: SolanaProviderMetrics;
  private readonly metricsCollector: SolanaRpcMetricsCollector;
  private isUsingFallback = false;
  private onFailoverStateChange?: SolanaFailoverStateChangeCallback;

  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_TIMEOUT_MS = 30_000;
  private static readonly DEFAULT_COMMITMENT: Commitment = "confirmed";

  constructor(options: SolanaProviderManagerOptions) {
    const {
      config,
      metricsCollector = noopSolanaMetricsCollector,
      onFailoverStateChange,
    } = options;
    this.onFailoverStateChange = onFailoverStateChange;

    this.config = {
      primaryRpcUrl: config.primaryRpcUrl,
      fallbackRpcUrl: config.fallbackRpcUrl,
      maxRetries:
        config.maxRetries ?? SolanaProviderManager.DEFAULT_MAX_RETRIES,
      timeoutMs: config.timeoutMs ?? SolanaProviderManager.DEFAULT_TIMEOUT_MS,
      chainName: config.chainName ?? "solana",
      commitment: config.commitment ?? SolanaProviderManager.DEFAULT_COMMITMENT,
    };

    this.metricsCollector = metricsCollector;

    this.metrics = {
      primaryAttempts: 0,
      primaryFailures: 0,
      fallbackAttempts: 0,
      fallbackFailures: 0,
      totalRequests: 0,
      lastFailoverTime: null,
    };
  }

  private createConnection(url: string): Connection {
    return new Connection(url, {
      commitment: this.config.commitment,
      confirmTransactionInitialTimeout: this.config.timeoutMs,
    });
  }

  private getPrimaryConnection(): Connection {
    if (!this.primaryConnection) {
      this.primaryConnection = this.createConnection(this.config.primaryRpcUrl);
    }
    return this.primaryConnection;
  }

  private getFallbackConnection(): Connection | null {
    if (!this.fallbackConnection && this.config.fallbackRpcUrl) {
      this.fallbackConnection = this.createConnection(
        this.config.fallbackRpcUrl
      );
    }
    return this.fallbackConnection;
  }

  getConnection(): Connection {
    if (this.isUsingFallback && this.fallbackConnection) {
      return this.fallbackConnection;
    }
    return this.getPrimaryConnection();
  }

  async executeWithFailover<T>(
    operation: (connection: Connection) => Promise<T>
  ): Promise<T> {
    this.metrics.totalRequests += 1;

    // If we've already switched to fallback, use it directly
    if (this.isUsingFallback) {
      const fallbackConnection = this.getFallbackConnection();
      if (fallbackConnection) {
        const fallbackResult = await this.tryConnection(
          fallbackConnection,
          operation,
          "fallback",
          this.config.maxRetries
        );

        if (fallbackResult.success) {
          return fallbackResult.result as T;
        }

        console.warn(
          JSON.stringify({
            level: "warn",
            event: "SOLANA_RPC_FALLBACK_FAILED",
            message: `Fallback RPC failed for ${this.config.chainName}, attempting primary recovery`,
            chain: this.config.chainName,
            timestamp: new Date().toISOString(),
          })
        );
      }
    }

    const primaryConnection = this.getPrimaryConnection();
    const primaryResult = await this.tryConnection(
      primaryConnection,
      operation,
      "primary",
      this.config.maxRetries
    );

    if (primaryResult.success) {
      if (this.isUsingFallback) {
        console.info(
          JSON.stringify({
            level: "info",
            event: "SOLANA_RPC_FAILOVER_RECOVERY",
            message: `Primary RPC recovered for ${this.config.chainName}, switching back from fallback`,
            chain: this.config.chainName,
            previousState: "fallback",
            newState: "primary",
            timestamp: new Date().toISOString(),
          })
        );
        this.isUsingFallback = false;
        this.onFailoverStateChange?.(this.config.chainName, false, "recovery");
      }
      return primaryResult.result as T;
    }

    const fallbackConnection = this.getFallbackConnection();
    if (fallbackConnection) {
      this.metrics.lastFailoverTime = new Date();
      this.metricsCollector.recordFailoverEvent(this.config.chainName);

      const fallbackResult = await this.tryConnection(
        fallbackConnection,
        operation,
        "fallback",
        this.config.maxRetries
      );

      if (fallbackResult.success) {
        if (!this.isUsingFallback) {
          console.warn(
            JSON.stringify({
              level: "warn",
              event: "SOLANA_RPC_FAILOVER_ACTIVATED",
              message: `Primary RPC failed for ${this.config.chainName}, switching to fallback`,
              chain: this.config.chainName,
              previousState: "primary",
              newState: "fallback",
              primaryError: primaryResult.error,
              timestamp: new Date().toISOString(),
            })
          );
          this.isUsingFallback = true;
          this.onFailoverStateChange?.(this.config.chainName, true, "failover");
        }
        return fallbackResult.result as T;
      }

      console.error(
        JSON.stringify({
          level: "error",
          event: "SOLANA_RPC_BOTH_ENDPOINTS_FAILED",
          message: `Both primary and fallback RPC failed for ${this.config.chainName}`,
          chain: this.config.chainName,
          primaryError: primaryResult.error,
          fallbackError: fallbackResult.error,
          timestamp: new Date().toISOString(),
        })
      );
      throw new Error(
        `Solana RPC failed on both endpoints. Primary: ${primaryResult.error}. Fallback: ${fallbackResult.error}`
      );
    }

    throw new Error(
      `Solana RPC failed on primary endpoint: ${primaryResult.error}`
    );
  }

  private async tryConnection<T>(
    connection: Connection,
    operation: (c: Connection) => Promise<T>,
    connectionType: "primary" | "fallback",
    maxRetries: number
  ): Promise<{ success: boolean; result?: T; error?: string }> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (connectionType === "primary") {
          this.metrics.primaryAttempts += 1;
          this.metricsCollector.recordPrimaryAttempt(this.config.chainName);
        } else {
          this.metrics.fallbackAttempts += 1;
          this.metricsCollector.recordFallbackAttempt(this.config.chainName);
        }

        const result = await this.withTimeout(
          operation(connection),
          this.config.timeoutMs
        );

        return { success: true, result };
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (connectionType === "primary") {
          this.metrics.primaryFailures += 1;
          this.metricsCollector.recordPrimaryFailure(this.config.chainName);
        } else {
          this.metrics.fallbackFailures += 1;
          this.metricsCollector.recordFallbackFailure(this.config.chainName);
        }

        if (attempt === maxRetries - 1) {
          break;
        }

        await this.delay(Math.min(1000 * 2 ** attempt, 5000));
      }
    }

    return {
      success: false,
      error: lastError?.message || "Unknown error",
    };
  }

  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Timeout after ${timeoutMs}ms`)),
          timeoutMs
        )
      ),
    ]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getMetrics(): Readonly<SolanaProviderMetrics> {
    return { ...this.metrics };
  }

  isCurrentlyUsingFallback(): boolean {
    return this.isUsingFallback;
  }

  getCurrentConnectionType(): "primary" | "fallback" {
    return this.isUsingFallback ? "fallback" : "primary";
  }

  setFailoverStateChangeCallback(
    callback: SolanaFailoverStateChangeCallback
  ): void {
    this.onFailoverStateChange = callback;
  }

  getChainName(): string {
    return this.config.chainName;
  }
}

// Cache managers by RPC URL combination to persist failover state across requests
const solanaManagerCache = new Map<string, SolanaProviderManager>();

export type CreateSolanaProviderManagerOptions = {
  primaryRpcUrl: string;
  fallbackRpcUrl?: string;
  maxRetries?: number;
  timeoutMs?: number;
  chainName?: string;
  commitment?: Commitment;
  metricsCollector?: SolanaRpcMetricsCollector;
  onFailoverStateChange?: SolanaFailoverStateChangeCallback;
};

export function createSolanaProviderManager(
  options: CreateSolanaProviderManagerOptions
): SolanaProviderManager {
  const cacheKey = `${options.primaryRpcUrl}|${options.fallbackRpcUrl || ""}`;

  let manager = solanaManagerCache.get(cacheKey);
  if (!manager) {
    manager = new SolanaProviderManager({
      config: {
        primaryRpcUrl: options.primaryRpcUrl,
        fallbackRpcUrl: options.fallbackRpcUrl,
        maxRetries: options.maxRetries,
        timeoutMs: options.timeoutMs,
        chainName: options.chainName,
        commitment: options.commitment,
      },
      metricsCollector: options.metricsCollector,
      onFailoverStateChange: options.onFailoverStateChange,
    });
    solanaManagerCache.set(cacheKey, manager);
    console.info(
      JSON.stringify({
        level: "info",
        event: "SOLANA_RPC_PROVIDER_CREATED",
        message: `Created Solana RPC provider manager for ${options.chainName || "solana"}`,
        chain: options.chainName || "solana",
        hasFallback: !!options.fallbackRpcUrl,
        timestamp: new Date().toISOString(),
      })
    );
  } else if (options.onFailoverStateChange) {
    manager.setFailoverStateChangeCallback(options.onFailoverStateChange);
  }

  return manager;
}

export function getAllSolanaFailoverStates(): Map<
  string,
  { chainName: string; isUsingFallback: boolean }
> {
  const states = new Map<
    string,
    { chainName: string; isUsingFallback: boolean }
  >();
  solanaManagerCache.forEach((manager, key) => {
    states.set(key, {
      chainName: manager.getChainName(),
      isUsingFallback: manager.isCurrentlyUsingFallback(),
    });
  });
  return states;
}

export function clearSolanaProviderManagerCache(): void {
  solanaManagerCache.clear();
}
