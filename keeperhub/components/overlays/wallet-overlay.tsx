"use client";

import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/overlays/overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
import { useSession } from "@/lib/auth-client";

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

type ChainData = {
  id: string;
  chainId: number;
  name: string;
  symbol: string;
  chainType: string;
  defaultPrimaryRpc: string;
  isTestnet: boolean;
  isEnabled: boolean;
};

type ChainBalance = {
  chainId: number;
  name: string;
  symbol: string;
  balance: string;
  loading: boolean;
  isTestnet: boolean;
  error?: string;
};

type TokenData = {
  id: string;
  chainId: number;
  tokenAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoUrl: string | null;
};

type TokenBalance = {
  tokenId: string;
  chainId: number;
  symbol: string;
  name: string;
  balance: string;
  loading: boolean;
  error?: string;
};

// Component for editing wallet email
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

function ChainBalanceItem({
  balance,
  tokenBalances,
  isAdmin,
  onRemoveToken,
}: {
  balance: ChainBalance;
  tokenBalances: TokenBalance[];
  isAdmin: boolean;
  onRemoveToken: (tokenId: string, symbol: string) => void;
}) {
  let balanceContent: React.ReactNode;
  if (balance.loading) {
    balanceContent = (
      <div className="mt-1 text-muted-foreground text-xs">Loading...</div>
    );
  } else if (balance.error) {
    balanceContent = (
      <div className="mt-1 text-destructive text-xs">{balance.error}</div>
    );
  } else {
    balanceContent = (
      <div className="mt-1 text-muted-foreground text-xs">
        {balance.balance} {balance.symbol}
      </div>
    );
  }

  // Filter token balances for this chain
  const chainTokens = tokenBalances.filter(
    (t) => t.chainId === balance.chainId
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
        <div className="flex-1">
          <div className="font-medium text-sm">{balance.name}</div>
          {balanceContent}
        </div>
      </div>
      {/* Token balances for this chain */}
      {chainTokens.length > 0 && (
        <div className="ml-4 space-y-1">
          {chainTokens.map((token) => (
            <div
              className="flex items-center justify-between rounded border bg-background p-2"
              key={token.tokenId}
            >
              <div className="flex-1">
                <div className="font-medium text-xs">{token.symbol}</div>
                {token.loading ? (
                  <div className="text-muted-foreground text-xs">
                    Loading...
                  </div>
                ) : token.error ? (
                  <div className="text-destructive text-xs">{token.error}</div>
                ) : (
                  <div className="text-muted-foreground text-xs">
                    {token.balance} {token.symbol}
                  </div>
                )}
              </div>
              {isAdmin && (
                <Button
                  className="h-6 w-6"
                  onClick={() => onRemoveToken(token.tokenId, token.symbol)}
                  size="icon"
                  variant="ghost"
                >
                  <Trash2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WalletOverlay({ overlayId }: WalletOverlayProps) {
  const { closeAll } = useOverlay();
  const { data: session } = useSession();
  const { isAdmin } = useActiveMember();

  const [walletLoading, setWalletLoading] = useState(true);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [balances, setBalances] = useState<ChainBalance[]>([]);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showTestnets, setShowTestnets] = useState(false);

  // Create wallet state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [email, setEmail] = useState("");
  const [creating, setCreating] = useState(false);

  // Add token state
  const [showAddToken, setShowAddToken] = useState(false);
  const [newTokenChainId, setNewTokenChainId] = useState<number | null>(null);
  const [newTokenAddress, setNewTokenAddress] = useState("");
  const [addingToken, setAddingToken] = useState(false);

  const fetchChains = useCallback(async () => {
    try {
      const response = await fetch("/api/chains");
      const data: ChainData[] = await response.json();
      // Filter to only EVM chains
      const evmChains = data.filter((chain) => chain.chainType === "evm");
      setChains(evmChains);
      return evmChains;
    } catch (error) {
      console.error("Failed to fetch chains:", error);
      return [];
    }
  }, []);

  const fetchTokens = useCallback(async () => {
    try {
      const response = await fetch("/api/user/wallet/tokens");
      const data = await response.json();
      setTokens(data.tokens || []);
      return data.tokens || [];
    } catch (error) {
      console.error("Failed to fetch tokens:", error);
      return [];
    }
  }, []);

  const fetchTokenBalances = useCallback(
    async (address: string, tokenList: TokenData[], chainList: ChainData[]) => {
      if (tokenList.length === 0) {
        setTokenBalances([]);
        return;
      }

      // Initialize token balances with loading state
      setTokenBalances(
        tokenList.map((token) => ({
          tokenId: token.id,
          chainId: token.chainId,
          symbol: token.symbol,
          name: token.name,
          balance: "0",
          loading: true,
        }))
      );

      // ERC20 balanceOf function signature
      const balanceOfSelector = "0x70a08231";

      const balancePromises = tokenList.map(async (token) => {
        try {
          const chain = chainList.find((c) => c.chainId === token.chainId);
          if (!chain) {
            throw new Error(`Chain ${token.chainId} not found`);
          }

          // Encode the balanceOf call data
          // Remove 0x prefix from address and pad to 64 chars
          const addressWithoutPrefix = address.startsWith("0x")
            ? address.slice(2)
            : address;
          const paddedAddress = addressWithoutPrefix
            .toLowerCase()
            .padStart(64, "0");
          const callData = `${balanceOfSelector}${paddedAddress}`;

          const response = await fetch(chain.defaultPrimaryRpc, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_call",
              params: [{ to: token.tokenAddress, data: callData }, "latest"],
              id: 1,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const result = await response.json();
          if (result.error) {
            throw new Error(result.error.message || "RPC error");
          }

          if (!result.result || result.result === "0x") {
            // No balance or contract doesn't exist on this chain
            return {
              tokenId: token.id,
              chainId: token.chainId,
              symbol: token.symbol,
              name: token.name,
              balance: "0.000000",
              loading: false,
            };
          }

          const balanceWei = BigInt(result.result);
          const balance = Number(balanceWei) / 10 ** token.decimals;

          return {
            tokenId: token.id,
            chainId: token.chainId,
            symbol: token.symbol,
            name: token.name,
            balance: balance.toFixed(6),
            loading: false,
          };
        } catch (error) {
          console.error(`Failed to fetch balance for ${token.symbol}:`, error);
          return {
            tokenId: token.id,
            chainId: token.chainId,
            symbol: token.symbol,
            name: token.name,
            balance: "0",
            loading: false,
            error: error instanceof Error ? error.message : "Failed to fetch",
          };
        }
      });

      const results = await Promise.all(balancePromises);
      setTokenBalances(results);
    },
    []
  );

  const fetchBalances = useCallback(
    async (address: string, chainList: ChainData[]) => {
      if (chainList.length === 0) return;

      // Initialize balances with loading state
      setBalances(
        chainList.map((chain) => ({
          chainId: chain.chainId,
          name: chain.name,
          symbol: chain.symbol,
          balance: "0",
          loading: true,
          isTestnet: chain.isTestnet,
        }))
      );

      const balancePromises = chainList.map(async (chain) => {
        try {
          const response = await fetch(chain.defaultPrimaryRpc, {
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
            chainId: chain.chainId,
            name: chain.name,
            symbol: chain.symbol,
            balance: balanceEth.toFixed(6),
            loading: false,
            isTestnet: chain.isTestnet,
          };
        } catch (error) {
          console.error(`Failed to fetch balance for ${chain.name}:`, error);
          return {
            chainId: chain.chainId,
            name: chain.name,
            symbol: chain.symbol,
            balance: "0",
            loading: false,
            isTestnet: chain.isTestnet,
            error: error instanceof Error ? error.message : "Failed to fetch",
          };
        }
      });

      const results = await Promise.all(balancePromises);
      setBalances(results);
    },
    []
  );

  const loadWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      // Fetch chains, tokens, and wallet data in parallel
      const [chainList, tokenList, walletResponse] = await Promise.all([
        fetchChains(),
        fetchTokens(),
        fetch("/api/user/wallet"),
      ]);
      const data = await walletResponse.json();

      if (data.hasWallet) {
        setWalletData(data);
        setWalletLoading(false);
        if (data.walletAddress && chainList.length > 0) {
          // Fetch native and token balances in parallel
          await Promise.all([
            fetchBalances(data.walletAddress, chainList),
            fetchTokenBalances(data.walletAddress, tokenList, chainList),
          ]);
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
  }, [fetchChains, fetchTokens, fetchBalances, fetchTokenBalances]);

  const handleRefresh = useCallback(async () => {
    if (!walletData?.walletAddress || chains.length === 0) return;
    setRefreshing(true);
    await Promise.all([
      fetchBalances(walletData.walletAddress, chains),
      fetchTokenBalances(walletData.walletAddress, tokens, chains),
    ]);
    setRefreshing(false);
  }, [
    walletData?.walletAddress,
    chains,
    tokens,
    fetchBalances,
    fetchTokenBalances,
  ]);

  const handleAddToken = async () => {
    if (!(newTokenChainId && newTokenAddress)) {
      toast.error("Please select a chain and enter a token address");
      return;
    }

    setAddingToken(true);
    try {
      const response = await fetch("/api/user/wallet/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: newTokenChainId,
          tokenAddress: newTokenAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add token");
      }

      toast.success(`Added ${data.token.symbol} to tracked tokens`);
      setShowAddToken(false);
      setNewTokenChainId(null);
      setNewTokenAddress("");
      // Reload wallet to get updated token list
      await loadWallet();
    } catch (error) {
      console.error("Failed to add token:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to add token"
      );
    } finally {
      setAddingToken(false);
    }
  };

  const handleRemoveToken = async (tokenId: string, symbol: string) => {
    try {
      const response = await fetch("/api/user/wallet/tokens", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove token");
      }

      toast.success(`Removed ${symbol} from tracked tokens`);
      // Update local state
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
      setTokenBalances((prev) => prev.filter((t) => t.tokenId !== tokenId));
    } catch (error) {
      console.error("Failed to remove token:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove token"
      );
    }
  };

  useEffect(() => {
    loadWallet();
    // Prefill email with current user's email
    if (session?.user?.email) {
      setEmail(session.user.email);
    }
  }, [loadWallet, session?.user?.email]);

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
    <Overlay
      actions={[{ label: "Done", onClick: closeAll }]}
      overlayId={overlayId}
      title="Organization Wallet"
    >
      <p className="-mt-2 mb-4 text-muted-foreground text-sm">
        {walletData?.hasWallet
          ? "View your organization's wallet address and balances across different chains"
          : "Create a wallet for your organization to use in workflows"}
      </p>

      {walletLoading && (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      )}

      {!walletLoading && walletData?.hasWallet && (
        <div className="space-y-4">
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
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Balances</h3>
              <div className="flex items-center gap-2">
                <div className="flex rounded-md border">
                  <Button
                    className="h-7 rounded-r-none border-0 px-3 text-xs"
                    onClick={() => setShowTestnets(false)}
                    size="sm"
                    variant={showTestnets ? "ghost" : "default"}
                  >
                    Mainnets
                  </Button>
                  <Button
                    className="h-7 rounded-l-none border-0 px-3 text-xs"
                    onClick={() => setShowTestnets(true)}
                    size="sm"
                    variant={showTestnets ? "default" : "ghost"}
                  >
                    Testnets
                  </Button>
                </div>
                <Button
                  disabled={refreshing}
                  onClick={handleRefresh}
                  size="sm"
                  variant="ghost"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </div>
            {balances.length === 0 ? (
              <div className="text-muted-foreground text-sm">
                Loading chains...
              </div>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {balances
                  .filter((b) => (showTestnets ? b.isTestnet : !b.isTestnet))
                  .map((balance) => (
                    <ChainBalanceItem
                      balance={balance}
                      isAdmin={isAdmin}
                      key={balance.chainId}
                      onRemoveToken={handleRemoveToken}
                      tokenBalances={tokenBalances}
                    />
                  ))}
                {balances.filter((b) =>
                  showTestnets ? b.isTestnet : !b.isTestnet
                ).length === 0 && (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    No {showTestnets ? "testnet" : "mainnet"} chains available
                  </div>
                )}
              </div>
            )}

            {/* Add Token Section */}
            {isAdmin && (
              <div className="mt-4 border-t pt-4">
                {showAddToken ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Chain</Label>
                      <Select
                        onValueChange={(value) =>
                          setNewTokenChainId(Number.parseInt(value))
                        }
                        value={newTokenChainId?.toString() ?? ""}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select chain" />
                        </SelectTrigger>
                        <SelectContent>
                          {chains.map((chain) => (
                            <SelectItem
                              key={chain.chainId}
                              value={chain.chainId.toString()}
                            >
                              {chain.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Token Address</Label>
                      <Input
                        disabled={addingToken}
                        onChange={(e) => setNewTokenAddress(e.target.value)}
                        placeholder="0x..."
                        value={newTokenAddress}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={addingToken}
                        onClick={() => {
                          setShowAddToken(false);
                          setNewTokenChainId(null);
                          setNewTokenAddress("");
                        }}
                        variant="outline"
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1"
                        disabled={
                          addingToken || !newTokenChainId || !newTokenAddress
                        }
                        onClick={handleAddToken}
                      >
                        {addingToken ? (
                          <>
                            <Spinner className="mr-2 h-4 w-4" />
                            Adding...
                          </>
                        ) : (
                          "Add Token"
                        )}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => setShowAddToken(true)}
                    variant="outline"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Token
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!(walletLoading || walletData?.hasWallet) && (
        <div className="space-y-4">
          {!isAdmin && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-muted-foreground text-sm">
                No wallet found for this organization. Only organization admins
                and owners can create wallets.
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
                    This email will be associated with the organization's wallet
                    for identification purposes.
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
                  No wallet found for this organization. Create a wallet to use
                  Web3 features in your workflows.
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
    </Overlay>
  );
}
