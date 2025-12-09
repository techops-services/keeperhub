"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

type WalletDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function WalletDialog({ open, onOpenChange }: WalletDialogProps) {
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

        // Convert wei to ETH
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
        // Fetch balances separately after wallet is loaded
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
    if (open) {
      loadWallet();
    }
  }, [open, loadWallet]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Wallet</DialogTitle>
          <DialogDescription>
            View your wallet address and balances across different chains
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {walletLoading && (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          )}
          {!walletLoading && walletData?.hasWallet && (
            <>
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
                      <div className="mt-1 space-y-1">
                        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
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
                      {balance.loading && <Spinner className="h-4 w-4" />}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {!(walletLoading || walletData?.hasWallet) && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-muted-foreground text-sm">
                No wallet found. Create a wallet in Settings to get started.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
