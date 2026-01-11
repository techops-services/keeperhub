"use client";

import React, { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { ActionConfigFieldBase } from "@/plugins";

type Chain = {
  id: string;
  chainId: number;
  name: string;
  symbol: string;
  chainType: string;
  isTestnet: boolean;
  isEnabled: boolean;
};

type ChainSelectFieldProps = {
  field: ActionConfigFieldBase;
  value: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  /**
   * Filter chains by type (e.g., "evm" or "solana")
   * If not specified, all chain types are shown
   */
  chainTypeFilter?: string;
};

export function ChainSelectField({
  field,
  value,
  onChange,
  disabled,
  chainTypeFilter,
}: ChainSelectFieldProps) {
  const [chains, setChains] = useState<Chain[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChains() {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch("/api/chains");
        if (!response.ok) {
          throw new Error("Failed to fetch chains");
        }

        const data = (await response.json()) as Chain[];

        // Filter by chain type if specified
        const filteredChains = chainTypeFilter
          ? data.filter((chain) => chain.chainType === chainTypeFilter)
          : data;

        setChains(filteredChains);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chains");
      } finally {
        setIsLoading(false);
      }
    }

    fetchChains();
  }, [chainTypeFilter]);

  if (isLoading) {
    return (
      <div className="flex h-10 items-center justify-center rounded-md border">
        <Spinner className="h-4 w-4" />
        <span className="ml-2 text-muted-foreground text-sm">
          Loading chains...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive text-sm">
        {error}
      </div>
    );
  }

  if (chains.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-3 text-center text-muted-foreground text-sm">
        No chains available
      </div>
    );
  }

  // Group chains by testnet status for better UX
  const mainnets = chains.filter((chain) => !chain.isTestnet);
  const testnets = chains.filter((chain) => chain.isTestnet);

  return (
    <Select disabled={disabled} onValueChange={onChange} value={value}>
      <SelectTrigger className="w-full" id={field.key}>
        <SelectValue placeholder={field.placeholder || "Select a chain"} />
      </SelectTrigger>
      <SelectContent>
        {mainnets.length > 0 && (
          <>
            <div className="px-2 py-1.5 font-semibold text-muted-foreground text-xs">
              Mainnets
            </div>
            {mainnets.map((chain) => (
              <SelectItem key={chain.chainId} value={String(chain.chainId)}>
                <div className="flex items-center gap-2">
                  <span>{chain.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ({chain.symbol})
                  </span>
                </div>
              </SelectItem>
            ))}
          </>
        )}
        {testnets.length > 0 && (
          <>
            <div className="mt-1 px-2 py-1.5 font-semibold text-muted-foreground text-xs">
              Testnets
            </div>
            {testnets.map((chain) => (
              <SelectItem key={chain.chainId} value={String(chain.chainId)}>
                <div className="flex items-center gap-2">
                  <span>{chain.name}</span>
                  <span className="text-muted-foreground text-xs">
                    ({chain.symbol})
                  </span>
                </div>
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
}
