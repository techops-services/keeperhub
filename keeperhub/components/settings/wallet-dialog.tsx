"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
import { useSession } from "@/lib/auth-client";

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

// Extracted component for editing wallet email to reduce cognitive complexity
function WalletEmailEditor({
  currentEmail,
  isAdmin,
  onEmailUpdated,
}: {
  currentEmail: string;
  isAdmin: boolean;
  onEmailUpdated: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [updating, setUpdating] = useState(false);

  const handleUpdate = async () => {
    if (!newEmail) {
      toast.error("Email is required");
      return;
    }

    setUpdating(true);
    try {
      const response = await fetch("/api/user/wallet", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update email");
      }

      toast.success("Wallet email updated successfully!");
      setIsEditing(false);
      setNewEmail("");
      onEmailUpdated();
    } catch (error) {
      console.error("Failed to update wallet email:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update email"
      );
    } finally {
      setUpdating(false);
    }
  };

  const startEditing = () => {
    setNewEmail(currentEmail);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setNewEmail("");
  };

  return (
    <div>
      <div className="mb-1 text-muted-foreground text-sm">Associated Email</div>
      {isEditing ? (
        <div className="space-y-2">
          <Input
            className="font-mono text-sm"
            disabled={updating}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="newemail@example.com"
            type="email"
            value={newEmail}
          />
          <div className="flex gap-2">
            <Button
              disabled={updating}
              onClick={cancelEditing}
              size="sm"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={updating || !newEmail || newEmail === currentEmail}
              onClick={handleUpdate}
              size="sm"
            >
              {updating ? (
                <>
                  <Spinner className="mr-2 h-3 w-3" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <code className="break-all font-mono text-sm">{currentEmail}</code>
          {isAdmin && (
            <Button
              className="h-6 px-2 text-xs"
              onClick={startEditing}
              size="sm"
              variant="ghost"
            >
              Edit
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function WalletDialog({ open, onOpenChange }: WalletDialogProps) {
  const { data: session } = useSession();
  const { isAdmin } = useActiveMember();

  const [walletLoading, setWalletLoading] = useState(true);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [balances, setBalances] = useState<ChainBalance[]>([
    { chain: "mainnet", balance: "0", loading: true },
    { chain: "sepolia", balance: "0", loading: true },
  ]);

  // Create wallet state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);

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
      // Prefill email with current user's email
      if (session?.user?.email) {
        setEmail(session.user.email);
      }
      // Debug logging
      console.log("[WalletDialog] Dialog opened", {
        isAdmin,
        hasSession: !!session,
        email: session?.user?.email,
      });
    }
  }, [open, loadWallet, session?.user?.email, isAdmin, session]);

  const handleCreateWallet = async () => {
    if (!email) {
      toast.error("Email is required");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/user/wallet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create wallet");
      }

      toast.success("Wallet created successfully!");
      setShowCreateForm(false);
      // Reload wallet data
      await loadWallet();
    } catch (error) {
      console.error("Failed to create wallet:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create wallet"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Organization Wallet</DialogTitle>
          <DialogDescription>
            {walletData?.hasWallet
              ? "View your organization's wallet address and balances across different chains"
              : "Create a wallet for your organization to use in workflows"}
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
              <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                <div>
                  <div className="mb-1 text-muted-foreground text-sm">
                    Wallet Address
                  </div>
                  <code className="break-all font-mono text-sm">
                    {walletData.walletAddress}
                  </code>
                </div>

                {walletData.email && (
                  <WalletEmailEditor
                    currentEmail={walletData.email}
                    isAdmin={isAdmin}
                    onEmailUpdated={loadWallet}
                  />
                )}
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
            </>
          )}
          {!(walletLoading || walletData?.hasWallet) && (
            <div className="space-y-4">
              {/* Debug info */}
              {process.env.NODE_ENV === "development" && (
                <div className="rounded-lg border border-yellow-500 bg-yellow-50 p-2 text-xs dark:bg-yellow-900/20">
                  <strong>Debug:</strong> isAdmin={String(isAdmin)},
                  showCreateForm={String(showCreateForm)}, hasEmail=
                  {String(!!email)}
                </div>
              )}

              {!isAdmin && (
                <div className="rounded-lg border bg-muted/50 p-4">
                  <p className="text-muted-foreground text-sm">
                    No wallet found for this organization. Only organization
                    admins and owners can create wallets.
                  </p>
                </div>
              )}
              {isAdmin && showCreateForm && (
                <div className="space-y-4">
                  <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                    <div>
                      <h3 className="mb-2 font-medium text-sm">
                        Create Organization Wallet
                      </h3>
                      <p className="mb-4 text-muted-foreground text-xs">
                        This wallet will be shared by all members of your
                        organization. Only admins and owners can manage it.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="wallet-email">Email Address</Label>
                      <Input
                        disabled={creating}
                        id="wallet-email"
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        type="email"
                        value={email}
                      />
                      <p className="text-muted-foreground text-xs">
                        This email will be associated with the organization's
                        wallet for identification purposes.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      disabled={creating}
                      onClick={() => setShowCreateForm(false)}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={creating || !email}
                      onClick={handleCreateWallet}
                    >
                      {creating ? (
                        <>
                          <Spinner className="mr-2 h-4 w-4" />
                          Creating...
                        </>
                      ) : (
                        "Create Wallet"
                      )}
                    </Button>
                  </div>
                </div>
              )}
              {isAdmin && !showCreateForm && (
                <div className="space-y-4">
                  <div className="rounded-lg border bg-muted/50 p-4">
                    <p className="text-muted-foreground text-sm">
                      No wallet found for this organization. Create a wallet to
                      use Web3 features in your workflows.
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => setShowCreateForm(true)}
                  >
                    Create Organization Wallet
                  </Button>
                </div>
              )}
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
