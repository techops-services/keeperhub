"use client";

import { useCallback, useEffect, useState } from "react";
import { Overlay } from "@/components/overlays/overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import { Spinner } from "@/components/ui/spinner";

type WalletOverlayProps = {
  overlayId: string;
};

type WalletData = {
  hasWallet: boolean;
  walletAddress?: string;
  walletId?: string;
  email?: string;
  createdAt?: string;
};

type ChainBalance = {
  chain: string;
  balance: string;
  loading: boolean;
  error?: string;
};

export function WalletOverlay({ overlayId }: WalletOverlayProps) {
  const { closeAll } = useOverlay();
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [balances, setBalances] = useState<ChainBalance[]>([
    { chain: "mainnet", balance: "0", loading: true },
    { chain: "sepolia", balance: "0", loading: true },
  ]);

  const fetchBalances = useCallback(async (address: string) => {
    const chains = [
      { name: "mainnet", display: "Ethereum Mainnet" },
      { name: "sepolia", display: "Sepolia Testnet" },
    ];

    const balancePromises = chains.map(async (chain) => {
      try {
        const rpcUrls: Record<string, string> = {
          mainnet: "https://chain.techops.services/eth-mainnet",
          sepolia: "https://chain.techops.services/eth-sepolia",
        };

        const rpcUrl = rpcUrls[chain.name];
        if (!rpcUrl) {
          throw new Error(`Unsupported network: ${chain.name}`);
        }

        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getBalance",
            params: [address, "latest"],
            id: 1,
          }),
        });

        const result = await response.json();
        if (result.error) {
          throw new Error(result.error.message);
        }

        const balanceWei = BigInt(result.result);
        const balanceEth = Number(balanceWei) / 1e18;

        return {
          chain: chain.name,
          balance: balanceEth.toFixed(6),
          loading: false,
        };
      } catch (error) {
        console.error(`Failed to fetch balance for ${chain.name}:`, error);
        return {
          chain: chain.name,
          balance: "0",
          loading: false,
          error: error instanceof Error ? error.message : "Failed to fetch",
        };
      }
    });

    const results = await Promise.all(balancePromises);
    setBalances(results);
  }, []);

  const loadWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      const response = await fetch("/api/user/wallet");
      const data = await response.json();

      if (data.hasWallet) {
        setWalletData(data);
        setWalletLoading(false);
        if (data.walletAddress) {
          fetchBalances(data.walletAddress);
        }
      } else {
        setWalletData({ hasWallet: false });
        setWalletLoading(false);
      }
    } catch (error) {
      console.error("Failed to load wallet:", error);
      setWalletData({ hasWallet: false });
      setWalletLoading(false);
    }
  }, [fetchBalances]);

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  return (
    <Overlay
      actions={[{ label: "Done", onClick: closeAll }]}
      overlayId={overlayId}
      title="Wallet"
    >
      <p className="-mt-2 mb-4 text-muted-foreground text-sm">
        View your wallet address and balances across different chains
      </p>

      {walletLoading && (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      )}

      {!walletLoading && walletData?.hasWallet && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="mb-2 text-muted-foreground text-sm">
              Wallet Address
            </div>
            <code className="break-all font-mono text-sm">
              {walletData.walletAddress}
            </code>
          </div>

          <div className="space-y-3">
            <h3 className="font-medium text-sm">Balances</h3>
            {balances.map((balance) => {
              let balanceContent: React.ReactNode;
              if (balance.loading) {
                balanceContent = (
                  <div className="mt-1 text-muted-foreground text-xs">
                    Loading...
                  </div>
                );
              } else if (balance.error) {
                balanceContent = (
                  <div className="mt-1 text-destructive text-xs">
                    {balance.error}
                  </div>
                );
              } else {
                balanceContent = (
                  <div className="mt-1 text-muted-foreground text-xs">
                    {balance.balance} ETH
                  </div>
                );
              }

              return (
                <div
                  className="flex items-center justify-between rounded-lg border bg-muted/50 p-3"
                  key={balance.chain}
                >
                  <div className="flex-1">
                    <div className="font-medium text-sm">
                      {balance.chain === "mainnet"
                        ? "Ethereum Mainnet"
                        : "Sepolia Testnet"}
                    </div>
                    {balanceContent}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!(walletLoading || walletData?.hasWallet) && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="text-muted-foreground text-sm">
            No wallet found. Create a wallet in Settings to get started.
          </p>
        </div>
      )}
    </Overlay>
  );
}
