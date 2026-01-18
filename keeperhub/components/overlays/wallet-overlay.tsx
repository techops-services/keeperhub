"use client";

import {
  Copy,
  ExternalLink,
  Plus,
  RefreshCw,
  SendHorizontal,
  Trash2,
} from "lucide-react";
import Image from "next/image";
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
import { fetchAllSupportedTokenBalances } from "@/keeperhub/lib/wallet/fetch-balances";
import type {
  ChainBalance,
  ChainData,
  SupportedToken,
  SupportedTokenBalance,
  TokenBalance,
  TokenData,
  WalletData,
} from "@/keeperhub/lib/wallet/types";
import { useWalletBalances } from "@/keeperhub/lib/wallet/use-wallet-balances";
import { useSession } from "@/lib/auth-client";
import { type WithdrawableAsset, WithdrawModal } from "./withdraw-modal";

type WalletOverlayProps = {
  overlayId: string;
};

// ============================================================================
// Utility Functions
// ============================================================================

function truncateAddress(address: string): string {
  if (address.length <= 13) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// ============================================================================
// Balance Display Components
// ============================================================================

function TokenBalanceDisplay({ token }: { token: TokenBalance }) {
  if (token.loading) {
    return <div className="text-muted-foreground text-xs">Loading...</div>;
  }
  if (token.error) {
    return <div className="text-destructive text-xs">{token.error}</div>;
  }
  return (
    <div className="text-muted-foreground text-xs">
      {token.balance} {token.symbol}
    </div>
  );
}

function ChainBalanceDisplay({ balance }: { balance: ChainBalance }) {
  if (balance.loading) {
    return <div className="mt-1 text-muted-foreground text-xs">Loading...</div>;
  }
  if (balance.error) {
    return <div className="mt-1 text-destructive text-xs">{balance.error}</div>;
  }
  return (
    <div className="mt-1 text-muted-foreground text-xs">
      {balance.balance} {balance.symbol}
    </div>
  );
}

function SupportedTokenBalanceDisplay({
  token,
}: {
  token: SupportedTokenBalance;
}) {
  const renderBalance = () => {
    if (token.loading) {
      return <Spinner className="h-3 w-3" />;
    }
    if (token.error) {
      return <span className="text-destructive">{token.error}</span>;
    }
    return `${token.balance} ${token.symbol}`;
  };

  return (
    <div className="flex items-center gap-2 py-1">
      {token.logoUrl && (
        <Image
          alt={token.symbol}
          className="h-4 w-4 rounded-full"
          height={16}
          src={token.logoUrl}
          width={16}
        />
      )}
      <span className="font-medium text-xs">{token.symbol}</span>
      <span className="ml-auto text-muted-foreground text-xs">
        {renderBalance()}
      </span>
    </div>
  );
}

function ChainBalanceItem({
  balance,
  isAdmin,
  onRemoveToken,
  onWithdraw,
  supportedTokenBalances,
  tokenBalances,
}: {
  balance: ChainBalance;
  isAdmin: boolean;
  onRemoveToken: (tokenId: string, symbol: string) => void;
  onWithdraw: (chainId: number, tokenAddress?: string) => void;
  supportedTokenBalances: SupportedTokenBalance[];
  tokenBalances: TokenBalance[];
}) {
  const chainTokens = tokenBalances.filter(
    (t) => t.chainId === balance.chainId
  );
  const chainSupportedTokens = supportedTokenBalances.filter(
    (t) => t.chainId === balance.chainId
  );

  const hasBalance = Number.parseFloat(balance.balance) > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
        <div className="flex-1">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm">{balance.name}</span>
            {balance.explorerUrl && (
              <a
                className="text-muted-foreground hover:text-foreground"
                href={balance.explorerUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <ChainBalanceDisplay balance={balance} />
        </div>
        {isAdmin && hasBalance && (
          <Button
            className="h-7 px-2 text-xs"
            onClick={() => onWithdraw(balance.chainId)}
            size="sm"
            variant="ghost"
          >
            <SendHorizontal className="h-3 w-3" />
            Withdraw
          </Button>
        )}
      </div>
      {/* Supported Token Balances (Stablecoins) */}
      {chainSupportedTokens.length > 0 && (
        <div className="ml-4">
          <div className="mb-1 font-medium text-muted-foreground text-xs">
            Stablecoins
          </div>
          <div className="rounded border bg-background/50 px-2 py-1">
            {chainSupportedTokens.map((token) => (
              <SupportedTokenBalanceDisplay
                key={`${token.chainId}-${token.tokenAddress}`}
                token={token}
              />
            ))}
          </div>
        </div>
      )}
      {/* Custom Tracked Tokens */}
      {chainTokens.length > 0 && (
        <div className="ml-4 space-y-1">
          <div className="font-medium text-muted-foreground text-xs">
            Tracked Tokens
          </div>
          {chainTokens.map((token) => (
            <div
              className="flex items-center justify-between rounded border bg-background p-2"
              key={token.tokenId}
            >
              <div className="flex-1">
                <div className="font-medium text-xs">{token.symbol}</div>
                <TokenBalanceDisplay token={token} />
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

// ============================================================================
// Form Components
// ============================================================================

function AddTokenForm({
  chains,
  onAdd,
  onCancel,
}: {
  chains: ChainData[];
  onAdd: (chainId: number, tokenAddress: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [chainId, setChainId] = useState<number | null>(null);
  const [tokenAddress, setTokenAddress] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!(chainId && tokenAddress)) {
      toast.error("Please select a chain and enter a token address");
      return;
    }
    setAdding(true);
    try {
      await onAdd(chainId, tokenAddress);
      setChainId(null);
      setTokenAddress("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add token"
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Chain</Label>
        <Select
          onValueChange={(value) => setChainId(Number.parseInt(value, 10))}
          value={chainId?.toString() ?? ""}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select chain" />
          </SelectTrigger>
          <SelectContent>
            {chains.map((chain) => (
              <SelectItem key={chain.chainId} value={chain.chainId.toString()}>
                {chain.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Token Address</Label>
        <Input
          disabled={adding}
          onChange={(e) => setTokenAddress(e.target.value)}
          placeholder="0x..."
          value={tokenAddress}
        />
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={adding}
          onClick={onCancel}
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={adding || !chainId || !tokenAddress}
          onClick={handleAdd}
        >
          {adding ? (
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
  );
}

function CreateWalletForm({
  initialEmail,
  onCancel,
  onSubmit,
}: {
  initialEmail: string;
  onCancel: () => void;
  onSubmit: (email: string) => Promise<void>;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!email) {
      toast.error("Email is required");
      return;
    }
    setCreating(true);
    try {
      await onSubmit(email);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create wallet"
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
        <div>
          <h3 className="mb-2 font-medium text-sm">
            Create Organization Wallet
          </h3>
          <p className="mb-4 text-muted-foreground text-xs">
            This wallet will be shared by all members of your organization. Only
            admins and owners can manage it.
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
            This email will be associated with the organization's wallet for
            identification purposes.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={creating}
          onClick={onCancel}
          variant="outline"
        >
          Cancel
        </Button>
        <Button
          className="flex-1"
          disabled={creating || !email}
          onClick={handleCreate}
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
  );
}

// ============================================================================
// Section Components
// ============================================================================

function BalanceListSection({
  balances,
  chains,
  isAdmin,
  onAddToken,
  onRefresh,
  onRemoveToken,
  onWithdraw,
  refreshing,
  showAddToken,
  setShowAddToken,
  supportedTokenBalances,
  tokenBalances,
}: {
  balances: ChainBalance[];
  chains: ChainData[];
  isAdmin: boolean;
  onAddToken: (chainId: number, tokenAddress: string) => Promise<void>;
  onRefresh: () => void;
  onRemoveToken: (tokenId: string, symbol: string) => void;
  onWithdraw: (chainId: number, tokenAddress?: string) => void;
  refreshing: boolean;
  showAddToken: boolean;
  setShowAddToken: (show: boolean) => void;
  supportedTokenBalances: SupportedTokenBalance[];
  tokenBalances: TokenBalance[];
}) {
  const [showTestnets, setShowTestnets] = useState(false);
  const filteredBalances = balances.filter((b) =>
    showTestnets ? b.isTestnet : !b.isTestnet
  );

  return (
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
            onClick={onRefresh}
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
        <div className="text-muted-foreground text-sm">Loading chains...</div>
      ) : (
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {filteredBalances.map((balance) => (
            <ChainBalanceItem
              balance={balance}
              isAdmin={isAdmin}
              key={balance.chainId}
              onRemoveToken={onRemoveToken}
              onWithdraw={onWithdraw}
              supportedTokenBalances={supportedTokenBalances}
              tokenBalances={tokenBalances}
            />
          ))}
          {filteredBalances.length === 0 && (
            <div className="py-4 text-center text-muted-foreground text-sm">
              No {showTestnets ? "testnet" : "mainnet"} chains available
            </div>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="mt-4 border-t pt-4">
          {showAddToken ? (
            <AddTokenForm
              chains={chains}
              onAdd={onAddToken}
              onCancel={() => setShowAddToken(false)}
            />
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
  );
}

function NoWalletSection({
  isAdmin,
  initialEmail,
  onCreateWallet,
}: {
  isAdmin: boolean;
  initialEmail: string;
  onCreateWallet: (email: string) => Promise<void>;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  if (!isAdmin) {
    return (
      <div className="rounded-lg border bg-muted/50 p-4">
        <p className="text-muted-foreground text-sm">
          No wallet found for this organization. Only organization admins and
          owners can create wallets.
        </p>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <CreateWalletForm
        initialEmail={initialEmail}
        onCancel={() => setShowCreateForm(false)}
        onSubmit={onCreateWallet}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/50 p-4">
        <p className="text-muted-foreground text-sm">
          No wallet found for this organization. Create a wallet to use Web3
          features in your workflows.
        </p>
      </div>
      <Button className="w-full" onClick={() => setShowCreateForm(true)}>
        Create Organization Wallet
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

// Component for account details section (email + wallet address)
function AccountDetailsSection({
  email,
  walletAddress,
  isAdmin,
  onEmailUpdated,
}: {
  email: string;
  walletAddress: string;
  isAdmin: boolean;
  onEmailUpdated: () => void;
}) {
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [updating, setUpdating] = useState(false);

  const handleUpdateEmail = async () => {
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
      setIsEditingEmail(false);
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
    setNewEmail(email);
    setIsEditingEmail(true);
  };

  const cancelEditing = () => {
    setIsEditingEmail(false);
    setNewEmail("");
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(walletAddress);
    toast.success("Address copied to clipboard");
  };

  return (
    <div className="rounded-lg border bg-muted/50 p-4">
      <div className="mb-2 text-muted-foreground text-sm">Account details</div>

      {isEditingEmail ? (
        <div className="space-y-2">
          <Input
            className="text-sm"
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
              disabled={updating || !newEmail || newEmail === email}
              onClick={handleUpdateEmail}
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
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm">{email}</span>
            {isAdmin && (
              <Button
                className="h-5 px-1.5 text-xs"
                onClick={startEditing}
                size="sm"
                variant="ghost"
              >
                Edit
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <code className="font-mono text-muted-foreground text-xs">
              {truncateAddress(walletAddress)}
            </code>
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={copyAddress}
              type="button"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function WalletOverlay({ overlayId }: WalletOverlayProps) {
  const { closeAll, push } = useOverlay();
  const { data: session } = useSession();
  const { isAdmin } = useActiveMember();

  const [walletLoading, setWalletLoading] = useState(true);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [supportedTokens, setSupportedTokens] = useState<SupportedToken[]>([]);
  const [supportedTokenBalances, setSupportedTokenBalances] = useState<
    SupportedTokenBalance[]
  >([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddToken, setShowAddToken] = useState(false);

  const { balances, tokenBalances, fetchBalances } = useWalletBalances();

  const fetchChains = useCallback(async (): Promise<ChainData[]> => {
    try {
      const response = await fetch("/api/chains");
      const data: ChainData[] = await response.json();
      const evmChains = data.filter((chain) => chain.chainType === "evm");
      setChains(evmChains);
      return evmChains;
    } catch (error) {
      console.error("Failed to fetch chains:", error);
      return [];
    }
  }, []);

  const fetchTokens = useCallback(async (): Promise<TokenData[]> => {
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

  const fetchSupportedTokensData = useCallback(async (): Promise<
    SupportedToken[]
  > => {
    try {
      const response = await fetch("/api/supported-tokens");
      const data = await response.json();
      const tokenList = data.tokens || [];
      setSupportedTokens(tokenList);
      return tokenList;
    } catch (error) {
      console.error("Failed to fetch supported tokens:", error);
      return [];
    }
  }, []);

  const fetchSupportedBalances = useCallback(
    async (
      walletAddress: string,
      chainList: ChainData[],
      tokenList: SupportedToken[]
    ) => {
      if (tokenList.length === 0) {
        setSupportedTokenBalances([]);
        return;
      }

      // Set loading state
      setSupportedTokenBalances(
        tokenList.map((token) => ({
          chainId: token.chainId,
          tokenAddress: token.tokenAddress,
          symbol: token.symbol,
          name: token.name,
          logoUrl: token.logoUrl,
          balance: "0",
          loading: true,
        }))
      );

      // Fetch balances
      const results = await fetchAllSupportedTokenBalances(
        walletAddress,
        tokenList,
        chainList
      );
      setSupportedTokenBalances(results);
    },
    []
  );

  const loadWallet = useCallback(async () => {
    setWalletLoading(true);
    try {
      // Phase 1: Fetch wallet data first (fast - just address + email)
      const walletResponse = await fetch("/api/user/wallet");
      const data = await walletResponse.json();

      if (!data.hasWallet) {
        setWalletData({ hasWallet: false });
        setWalletLoading(false);
        return;
      }

      // Show wallet info immediately
      setWalletData(data);
      setWalletLoading(false);

      // Phase 2: Fetch chains/tokens in background
      const [chainList, tokenList, supportedList] = await Promise.all([
        fetchChains(),
        fetchTokens(),
        fetchSupportedTokensData(),
      ]);

      // Phase 3: Fetch balances (they show loading states internally)
      if (data.walletAddress && chainList.length > 0) {
        fetchBalances(data.walletAddress, chainList, tokenList);
        fetchSupportedBalances(data.walletAddress, chainList, supportedList);
      }
    } catch (error) {
      console.error("Failed to load wallet:", error);
      setWalletData({ hasWallet: false });
      setWalletLoading(false);
    }
  }, [
    fetchChains,
    fetchTokens,
    fetchSupportedTokensData,
    fetchBalances,
    fetchSupportedBalances,
  ]);

  const handleRefresh = useCallback(async () => {
    if (!(walletData?.walletAddress && chains.length > 0)) {
      return;
    }
    setRefreshing(true);
    await Promise.all([
      fetchBalances(walletData.walletAddress, chains, tokens),
      fetchSupportedBalances(walletData.walletAddress, chains, supportedTokens),
    ]);
    setRefreshing(false);
  }, [
    walletData?.walletAddress,
    chains,
    tokens,
    supportedTokens,
    fetchBalances,
    fetchSupportedBalances,
  ]);

  const handleAddToken = async (chainId: number, tokenAddress: string) => {
    const response = await fetch("/api/user/wallet/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chainId, tokenAddress }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to add token");
    }

    toast.success(`Added ${data.token.symbol} to tracked tokens`);
    setShowAddToken(false);
    await loadWallet();
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
      setTokens((prev) => prev.filter((t) => t.id !== tokenId));
    } catch (error) {
      console.error("Failed to remove token:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to remove token"
      );
    }
  };

  const handleCreateWallet = async (email: string) => {
    const response = await fetch("/api/user/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to create wallet");
    }

    toast.success("Wallet created successfully!");
    await loadWallet();
  };

  const buildWithdrawableAssets = useCallback((): WithdrawableAsset[] => {
    const assets: WithdrawableAsset[] = [];

    // Add native balances
    for (const balance of balances) {
      const chain = chains.find((c) => c.chainId === balance.chainId);
      if (!chain || Number.parseFloat(balance.balance) <= 0) {
        continue;
      }
      assets.push({
        type: "native",
        chainId: balance.chainId,
        chainName: balance.name,
        symbol: balance.symbol,
        balance: balance.balance,
        decimals: 18,
        rpcUrl: chain.defaultPrimaryRpc,
        explorerUrl: balance.explorerUrl,
      });
    }

    // Add supported token balances (stablecoins)
    for (const token of supportedTokenBalances) {
      if (Number.parseFloat(token.balance) <= 0) {
        continue;
      }
      const chain = chains.find((c) => c.chainId === token.chainId);
      if (!chain) {
        continue;
      }
      const balance = balances.find((b) => b.chainId === token.chainId);
      assets.push({
        type: "token",
        chainId: token.chainId,
        chainName: chain.name,
        symbol: token.symbol,
        balance: token.balance,
        tokenAddress: token.tokenAddress,
        decimals: 6,
        rpcUrl: chain.defaultPrimaryRpc,
        explorerUrl: balance?.explorerUrl || null,
      });
    }

    return assets;
  }, [balances, chains, supportedTokenBalances]);

  const findAssetIndex = useCallback(
    (assets: WithdrawableAsset[], chainId: number, tokenAddress?: string) => {
      if (tokenAddress) {
        const idx = assets.findIndex(
          (a) => a.chainId === chainId && a.tokenAddress === tokenAddress
        );
        return idx >= 0 ? idx : 0;
      }
      const idx = assets.findIndex(
        (a) => a.chainId === chainId && a.type === "native"
      );
      return idx >= 0 ? idx : 0;
    },
    []
  );

  const handleWithdraw = useCallback(
    (chainId: number, tokenAddress?: string) => {
      if (!walletData?.walletAddress) {
        return;
      }

      const assets = buildWithdrawableAssets();
      if (assets.length === 0) {
        toast.error("No assets available for withdrawal");
        return;
      }

      const initialIndex = findAssetIndex(assets, chainId, tokenAddress);
      push(WithdrawModal, {
        assets,
        walletAddress: walletData.walletAddress,
        initialAssetIndex: initialIndex,
      });
    },
    [walletData?.walletAddress, buildWithdrawableAssets, findAssetIndex, push]
  );

  useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  const description = walletData?.hasWallet
    ? "View your organization's wallet address and balances across different chains"
    : "Create a wallet for your organization to use in workflows";

  return (
    <Overlay
      actions={[{ label: "Done", onClick: closeAll }]}
      overlayId={overlayId}
      title="Organization Wallet"
    >
      <p className="-mt-2 mb-4 text-muted-foreground text-sm">{description}</p>

      {walletLoading && (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      )}

      {!walletLoading && walletData?.hasWallet && (
        <div className="space-y-4">
          {walletData.email && walletData.walletAddress && (
            <AccountDetailsSection
              email={walletData.email}
              isAdmin={isAdmin}
              onEmailUpdated={loadWallet}
              walletAddress={walletData.walletAddress}
            />
          )}

          <BalanceListSection
            balances={balances}
            chains={chains}
            isAdmin={isAdmin}
            onAddToken={handleAddToken}
            onRefresh={handleRefresh}
            onRemoveToken={handleRemoveToken}
            onWithdraw={handleWithdraw}
            refreshing={refreshing}
            setShowAddToken={setShowAddToken}
            showAddToken={showAddToken}
            supportedTokenBalances={supportedTokenBalances}
            tokenBalances={tokenBalances}
          />
        </div>
      )}

      {!(walletLoading || walletData?.hasWallet) && (
        <NoWalletSection
          initialEmail={session?.user?.email || ""}
          isAdmin={isAdmin}
          onCreateWallet={handleCreateWallet}
        />
      )}
    </Overlay>
  );
}
