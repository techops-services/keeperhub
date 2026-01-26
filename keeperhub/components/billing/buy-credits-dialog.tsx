"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatEther, formatUnits, parseEther } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CHAIN_CONFIG,
  CREDITS_ABI,
  ERC20_ABI,
  getStablecoinAddress,
  hashOrgId,
  SUPPORTED_TOKENS,
  usdToTokenAmount,
} from "@/keeperhub/lib/billing/contracts";
import { api } from "@/lib/api-client";
import { getRpcUrlByChainId } from "@/lib/rpc/rpc-config";

const CREDITS_CONTRACT = process.env.NEXT_PUBLIC_CREDITS_CONTRACT_ADDRESS || "";
const SEPOLIA_CHAIN_ID = 11_155_111;

// Get RPC URL from centralized CHAIN_RPC_CONFIG at module initialization
function getSepoliaRpcUrl(): string {
  try {
    return getRpcUrlByChainId(SEPOLIA_CHAIN_ID, "primary");
  } catch {
    // Fallback to public Sepolia RPC
    return "https://ethereum-sepolia-rpc.publicnode.com";
  }
}

const SEPOLIA_RPC_URL = getSepoliaRpcUrl();

type Step =
  | "input"
  | "connect"
  | "confirm"
  | "approve"
  | "processing"
  | "success";
type PaymentMethod = "eth" | "stablecoin";
type StablecoinSymbol = "USDC" | "USDT" | "USDS";

type BuyCreditsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSuccess?: (credits: number) => void;
  initialAmount?: string;
  skipInput?: boolean;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex payment flow with ETH/stablecoin switching, approval logic, and transaction tracking
export function BuyCreditsDialog({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
  initialAmount = "25",
  skipInput = false,
}: BuyCreditsDialogProps) {
  const [step, setStep] = useState<Step>(skipInput ? "connect" : "input");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("eth");
  const [selectedToken, setSelectedToken] = useState<StablecoinSymbol>("USDC");
  const [usdAmount, setUsdAmount] = useState(initialAmount);
  const [ethAmount, setEthAmount] = useState<string | null>(null);
  const [estimatedCredits, setEstimatedCredits] = useState<number | null>(null);
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(skipInput);

  const isStablecoinPayment = paymentMethod === "stablecoin";
  const selectedTokenInfo = SUPPORTED_TOKENS.find(
    (t) => t.symbol === selectedToken
  );
  const stablecoinAddress = isStablecoinPayment
    ? getStablecoinAddress(selectedToken)
    : undefined;
  const tokenAmount = selectedTokenInfo
    ? usdToTokenAmount(Number.parseFloat(usdAmount), selectedTokenInfo.decimals)
    : BigInt(0);

  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { writeContract, isPending: isSendingTx } = useWriteContract();

  // Only watch for deposit transaction confirmation, not approval
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: depositTxHash as `0x${string}` | undefined,
      query: {
        enabled: !!depositTxHash,
      },
    });

  // Check token allowance for stablecoins
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: stablecoinAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args:
      address && stablecoinAddress
        ? [address, CREDITS_CONTRACT as `0x${string}`]
        : undefined,
    query: {
      enabled: !!(address && stablecoinAddress && isStablecoinPayment),
    },
  });

  const currentAllowance = allowanceData
    ? (allowanceData as bigint)
    : BigInt(0);
  const needsApproval = isStablecoinPayment && currentAllowance < tokenAmount;

  // Check token balance
  const { data: balanceData } = useReadContract({
    address: stablecoinAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!(address && stablecoinAddress && isStablecoinPayment),
    },
  });

  const tokenBalance = balanceData ? (balanceData as bigint) : BigInt(0);
  const hasInsufficientBalance =
    isStablecoinPayment && tokenBalance < tokenAmount;

  const isOnSepoliaNetwork = chain?.id === SEPOLIA_CHAIN_ID;

  // Calculate ETH amount and credits when USD amount changes
  const calculateEthAmount = useCallback(async () => {
    if (!usdAmount || Number.parseFloat(usdAmount) <= 0) {
      setEthAmount(null);
      setEstimatedCredits(null);
      return;
    }

    try {
      const usdInCents = Math.floor(Number.parseFloat(usdAmount) * 1_000_000);

      // Call contract to get ETH amount needed
      const response = await fetch(SEPOLIA_RPC_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_call",
          params: [
            {
              to: CREDITS_CONTRACT,
              data: `0x8803dbee${usdInCents.toString(16).padStart(64, "0")}`, // usdToEth(uint256)
            },
            "latest",
          ],
          id: 1,
        }),
      });

      const result = await response.json();
      const ethWei = BigInt(result.result);
      setEthAmount(formatEther(ethWei));

      // Calculate credits (100 credits per USD, with bonuses)
      const baseCredits = Math.floor(Number.parseFloat(usdAmount) * 100);
      let credits = baseCredits;

      if (usdInCents >= 500_000_000) {
        credits = Math.floor(baseCredits * 1.2); // 20% bonus
      } else if (usdInCents >= 100_000_000) {
        credits = Math.floor(baseCredits * 1.1); // 10% bonus
      }

      setEstimatedCredits(credits);
    } catch (error) {
      console.error("Failed to calculate ETH amount:", error);
      toast.error("Failed to calculate ETH amount. Please try again.");
    }
  }, [usdAmount]);

  // Auto-calculate when dialog opens with pre-selected package
  useEffect(() => {
    if (open && skipInput && !ethAmount) {
      setIsCalculating(true);
      calculateEthAmount().then(() => {
        setIsCalculating(false);
        if (isConnected) {
          setStep("confirm");
        }
      });
    }
  }, [open, skipInput, isConnected, calculateEthAmount, ethAmount]);

  const handleConnect = () => {
    const injectedConnector = connectors.find((c) => c.type === "injected");
    if (injectedConnector) {
      connect({ connector: injectedConnector });
      setStep("confirm");
    }
  };

  const handleApprove = () => {
    if (!(address && stablecoinAddress)) {
      return;
    }

    try {
      writeContract(
        {
          address: stablecoinAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [CREDITS_CONTRACT as `0x${string}`, tokenAmount],
          chainId: SEPOLIA_CHAIN_ID,
        },
        {
          onSuccess: () => {
            toast.success("Approval successful!");
            refetchAllowance();
            setStep("confirm");
          },
          onError: (error) => {
            console.error("Approval failed:", error);
            toast.error(`Approval failed: ${error.message}`);
          },
        }
      );
    } catch (error) {
      console.error("Failed to approve:", error);
      toast.error("Failed to approve token spending");
    }
  };

  const handleBuy = () => {
    if (!address) {
      return;
    }

    try {
      setStep("processing");

      const orgIdHash = hashOrgId(organizationId);

      if (isStablecoinPayment) {
        // Stablecoin payment
        if (!stablecoinAddress) {
          return;
        }

        writeContract(
          {
            address: CREDITS_CONTRACT as `0x${string}`,
            abi: CREDITS_ABI,
            functionName: "depositStable",
            args: [orgIdHash as `0x${string}`, stablecoinAddress, tokenAmount],
            chainId: SEPOLIA_CHAIN_ID,
          },
          {
            onSuccess: (hash) => {
              setDepositTxHash(hash);
              toast.success("Transaction sent. Waiting for confirmation...");
            },
            onError: (error) => {
              console.error("Transaction failed:", error);
              toast.error(`Transaction failed: ${error.message}`);
              setStep("confirm");
            },
          }
        );
      } else {
        // ETH payment
        if (!ethAmount) {
          return;
        }

        writeContract(
          {
            address: CREDITS_CONTRACT as `0x${string}`,
            abi: CREDITS_ABI,
            functionName: "depositETH",
            args: [orgIdHash as `0x${string}`],
            value: parseEther(ethAmount),
            chainId: SEPOLIA_CHAIN_ID,
          },
          {
            onSuccess: (hash) => {
              setDepositTxHash(hash);
              toast.success("Transaction sent. Waiting for confirmation...");
            },
            onError: (error) => {
              console.error("Transaction failed:", error);
              toast.error(`Transaction failed: ${error.message}`);
              setStep("confirm");
            },
          }
        );
      }
    } catch (error) {
      console.error("Failed to send transaction:", error);
      toast.error("Failed to send transaction");
      setStep("confirm");
    }
  };

  // Confirm deposit after transaction is mined
  const confirmDeposit = async () => {
    if (!depositTxHash) {
      return;
    }

    try {
      const result = await api.billing.confirmDeposit(
        depositTxHash,
        organizationId,
        estimatedCredits || 0
      );

      toast.success(`${result.credits} credits added to your account`);

      setStep("success");
      onSuccess?.(result.credits);

      // Reset and close after 2 seconds
      setTimeout(() => {
        onOpenChange(false);
        resetDialog();
      }, 2000);
    } catch (error) {
      console.error("Failed to confirm deposit:", error);
      toast.error("Failed to credit your account. Please contact support.");
    }
  };

  // Watch for transaction confirmation
  if (isConfirmed && depositTxHash && step === "processing") {
    confirmDeposit();
  }

  const resetDialog = useCallback(() => {
    setStep(skipInput ? "connect" : "input");
    setEthAmount(null);
    setEstimatedCredits(null);
    setDepositTxHash(null);
  }, [skipInput]);

  // Reset dialog when it closes
  useEffect(() => {
    if (!open) {
      resetDialog();
    }
  }, [open, resetDialog]);

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          resetDialog();
        }
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Buy Credits</DialogTitle>
          <DialogDescription>
            Purchase credits to run workflows. Pay with ETH on{" "}
            {CHAIN_CONFIG.chainId === 1 ? "Ethereum" : "Sepolia"}.
          </DialogDescription>
        </DialogHeader>

        {isCalculating && (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-primary border-b-2" />
            <p className="text-muted-foreground text-sm">Calculating...</p>
          </div>
        )}

        {!isCalculating && step === "input" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                min="1"
                onBlur={calculateEthAmount}
                onChange={(e) => setUsdAmount(e.target.value)}
                placeholder="25"
                type="number"
                value={usdAmount}
              />
              <p className="text-muted-foreground text-sm">
                Bonuses: 10% at $100, 20% at $500
              </p>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <RadioGroup
                onValueChange={(value) => {
                  setPaymentMethod(value as PaymentMethod);
                  // Recalculate if switching payment methods
                  if (value === "eth") {
                    calculateEthAmount();
                  }
                }}
                value={paymentMethod}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="eth-input" value="eth" />
                  <Label
                    className="cursor-pointer font-normal"
                    htmlFor="eth-input"
                  >
                    Ethereum (ETH)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem id="stablecoin-input" value="stablecoin" />
                  <Label
                    className="cursor-pointer font-normal"
                    htmlFor="stablecoin-input"
                  >
                    Stablecoin
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {isStablecoinPayment && (
              <div className="space-y-2">
                <Label htmlFor="token-select">Select Token</Label>
                <Select
                  onValueChange={(value) =>
                    setSelectedToken(value as StablecoinSymbol)
                  }
                  value={selectedToken}
                >
                  <SelectTrigger id="token-select">
                    <SelectValue placeholder="Select a token" />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_TOKENS.map((token) => (
                      <SelectItem
                        disabled={
                          token.disabledOnSepolia &&
                          SEPOLIA_CHAIN_ID === 11_155_111
                        }
                        key={token.symbol}
                        value={token.symbol}
                      >
                        <span className="flex items-center gap-2">
                          <span>{token.icon}</span>
                          <span>{token.symbol}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {((paymentMethod === "eth" && ethAmount && estimatedCredits) ||
              (isStablecoinPayment && estimatedCredits)) && (
              <div className="space-y-2 rounded-lg bg-muted p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {isStablecoinPayment ? "Amount Required:" : "ETH Required:"}
                  </span>
                  <span className="font-mono">
                    {isStablecoinPayment
                      ? `${formatUnits(tokenAmount, selectedTokenInfo?.decimals || 6)} ${selectedToken}`
                      : `${Number.parseFloat(ethAmount || "0").toFixed(6)} ETH`}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Credits:</span>
                  <span className="font-semibold">
                    {estimatedCredits.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <Button
              className="w-full"
              disabled={
                paymentMethod === "eth"
                  ? !(ethAmount && estimatedCredits)
                  : !estimatedCredits
              }
              onClick={() =>
                isConnected ? setStep("confirm") : setStep("connect")
              }
            >
              Continue
            </Button>
          </div>
        )}

        {!isCalculating && step === "connect" && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Connect your wallet to continue with the purchase.
            </p>
            <Button className="w-full" onClick={handleConnect}>
              Connect Wallet
            </Button>
            <Button
              className="w-full"
              onClick={() => setStep("input")}
              variant="outline"
            >
              Back
            </Button>
          </div>
        )}

        {!isCalculating && step === "confirm" && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg bg-muted p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Wallet:</span>
                <span className="font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {isStablecoinPayment ? "Network:" : "Amount:"}
                </span>
                <span className="font-mono">
                  {isStablecoinPayment
                    ? chain?.name || "Unknown"
                    : `${ethAmount} ETH`}
                </span>
              </div>
              {isStablecoinPayment && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-mono">
                    {formatUnits(tokenAmount, selectedTokenInfo?.decimals || 6)}{" "}
                    {selectedToken}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credits:</span>
                <span className="font-semibold">
                  {estimatedCredits?.toLocaleString()}
                </span>
              </div>
            </div>

            {hasInsufficientBalance && (
              <div className="rounded-md bg-red-500/10 p-3 text-red-600 text-sm dark:text-red-400">
                ⚠️ Insufficient balance. You need{" "}
                {formatUnits(tokenAmount, selectedTokenInfo?.decimals || 6)}{" "}
                {selectedToken} but only have{" "}
                {formatUnits(tokenBalance, selectedTokenInfo?.decimals || 6)}{" "}
                {selectedToken}.
              </div>
            )}

            {!isOnSepoliaNetwork && (
              <div className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                ⚠️ Please switch to Sepolia network
              </div>
            )}

            {isStablecoinPayment && needsApproval && (
              <>
                <Button
                  className="w-full"
                  disabled={
                    isSendingTx || hasInsufficientBalance || !isOnSepoliaNetwork
                  }
                  onClick={handleApprove}
                  variant="outline"
                >
                  {isSendingTx ? "Approving..." : `Approve ${selectedToken}`}
                </Button>
                <p className="text-center text-muted-foreground text-xs">
                  Step 1 of 2: Approve {selectedToken} spending
                </p>
              </>
            )}

            <Button
              className="w-full"
              disabled={
                isSendingTx ||
                hasInsufficientBalance ||
                !isOnSepoliaNetwork ||
                (isStablecoinPayment && needsApproval)
              }
              onClick={handleBuy}
            >
              {isSendingTx ? "Confirming..." : "Confirm Purchase"}
            </Button>

            {isStablecoinPayment && needsApproval && (
              <p className="text-center text-muted-foreground text-xs">
                Approve token first before purchasing
              </p>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={() => setStep("input")}
                variant="outline"
              >
                Back
              </Button>
              <Button
                className="flex-1"
                onClick={() => disconnect()}
                variant="outline"
              >
                Disconnect
              </Button>
            </div>
          </div>
        )}

        {!isCalculating && step === "processing" && (
          <div className="space-y-4 py-6 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-primary border-b-2" />
            <p className="text-muted-foreground text-sm">
              {isConfirming
                ? "Waiting for confirmation..."
                : "Processing transaction..."}
            </p>
            {depositTxHash && (
              <a
                className="text-primary text-sm hover:underline"
                href={`${CHAIN_CONFIG.chainId === 1 ? "https://etherscan.io" : "https://sepolia.etherscan.io"}/tx/${depositTxHash}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                View on Etherscan
              </a>
            )}
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4 py-6 text-center">
            <div className="text-6xl text-green-500">✓</div>
            <p className="font-semibold text-lg">Credits Added!</p>
            <p className="text-muted-foreground text-sm">
              {estimatedCredits?.toLocaleString()} credits have been added to
              your account
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
