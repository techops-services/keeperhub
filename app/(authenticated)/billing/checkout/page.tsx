"use client";

import { AlertTriangle, ArrowLeft, Check, FlaskConical, X } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatEther, formatUnits, parseEther, parseUnits } from "viem";
import {
  useAccount,
  useBalance,
  useConnect,
  useReadContract,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CHAIN_CONFIG,
  CREDITS_ABI,
  ERC20_ABI,
  getStablecoinAddress,
  hashOrgId,
  SUPPORTED_TOKENS,
  usdToTokenAmount,
} from "@/keeperhub/lib/billing/contracts";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
import { api } from "@/lib/api-client";

const CREDITS_CONTRACT = process.env.NEXT_PUBLIC_CREDITS_CONTRACT_ADDRESS || "";

// Mock token addresses on Sepolia for testing
const MOCK_TOKENS = {
  USDT: "0x9F3BDc4459f0436eA0fe925d9aE6963eF1b7bb17" as `0x${string}`,
  USDS: "0x39d38839AAC04327577c795b4aC1E1235700EfCF" as `0x${string}`,
};

// ABI for mock token faucet function
const MOCK_TOKEN_ABI = [
  {
    name: "faucet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

type PaymentMethod = "eth" | "stablecoin";
type StablecoinSymbol = "USDC" | "USDT" | "USDS";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex payment flow with multiple states and blockchain interactions
function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const usdAmount = searchParams.get("amount") || "25";
  const activeMember = useActiveMember();
  const organizationId = activeMember?.member?.organizationId;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("eth");
  const [selectedToken, setSelectedToken] = useState<StablecoinSymbol>("USDC");
  const [depositTxHash, setDepositTxHash] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState<"USDT" | "USDS" | null>(null);

  const usdInCents = Math.floor(Number.parseFloat(usdAmount) * 1_000_000);
  const isStablecoinPayment = paymentMethod === "stablecoin";

  // Read ETH amount from contract
  const {
    data: ethWeiData,
    isLoading: isLoadingEth,
    error: ethError,
  } = useReadContract({
    address: CREDITS_CONTRACT as `0x${string}`,
    abi: [
      {
        name: "usdToEth",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "usdAmount", type: "uint256" }],
        outputs: [{ type: "uint256" }],
      },
    ],
    functionName: "usdToEth",
    args: [BigInt(usdInCents)],
    chainId: 11_155_111, // Sepolia
    query: {
      enabled: !!CREDITS_CONTRACT,
    },
  });

  // Read credits from contract
  const {
    data: creditsData,
    isLoading: isLoadingCredits,
    error: creditsError,
  } = useReadContract({
    address: CREDITS_CONTRACT as `0x${string}`,
    abi: [
      {
        name: "calculateCredits",
        type: "function",
        stateMutability: "pure",
        inputs: [{ name: "usdAmount", type: "uint256" }],
        outputs: [{ type: "uint256" }],
      },
    ],
    functionName: "calculateCredits",
    args: [BigInt(usdInCents)],
    chainId: 11_155_111, // Sepolia
    query: {
      enabled: !!CREDITS_CONTRACT,
    },
  });

  const ethAmount = ethWeiData ? formatEther(ethWeiData as bigint) : null;
  const estimatedCredits = creditsData ? Number(creditsData) : null;
  const isCalculating = isLoadingEth || isLoadingCredits;
  const hasError = ethError || creditsError;

  // Wallet hooks
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const { writeContract } = useWriteContract();

  // Watch for deposit transaction confirmation
  const { isSuccess: isDepositConfirmed } = useWaitForTransactionReceipt({
    hash: depositTxHash as `0x${string}` | undefined,
    query: {
      enabled: !!depositTxHash,
    },
  });

  // Watch for approval transaction confirmation
  const { isSuccess: isApprovalConfirmed, isLoading: isApprovalPending } =
    useWaitForTransactionReceipt({
      hash: approvalTxHash as `0x${string}` | undefined,
      query: {
        enabled: !!approvalTxHash,
      },
    });

  const SEPOLIA_CHAIN_ID = 11_155_111;
  const isOnSepoliaNetwork = chain?.id === SEPOLIA_CHAIN_ID;

  // Stablecoin logic
  const selectedTokenInfo = SUPPORTED_TOKENS.find(
    (t) => t.symbol === selectedToken
  );
  const stablecoinAddress = isStablecoinPayment
    ? getStablecoinAddress(selectedToken)
    : undefined;
  const tokenAmount = selectedTokenInfo
    ? usdToTokenAmount(Number.parseFloat(usdAmount), selectedTokenInfo.decimals)
    : BigInt(0);

  // Check token allowance
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

  // Refetch allowance after approval is confirmed
  useEffect(() => {
    if (isApprovalConfirmed && approvalTxHash) {
      refetchAllowance();
      toast.success("Approval confirmed! You can now purchase credits.");
      setApprovalTxHash(null);
    }
  }, [isApprovalConfirmed, approvalTxHash, refetchAllowance]);

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

  // Check native ETH balance for ETH payments
  const { data: ethBalanceData } = useBalance({
    address,
    query: {
      enabled: !!(address && !isStablecoinPayment),
    },
  });

  const ethBalance = ethBalanceData?.value ?? BigInt(0);
  const ethRequired = ethAmount ? parseEther(ethAmount) : BigInt(0);
  const hasInsufficientEth =
    !isStablecoinPayment && ethRequired > BigInt(0) && ethBalance < ethRequired;

  // Confirm deposit after transaction is mined
  useEffect(() => {
    if (isDepositConfirmed && depositTxHash && organizationId) {
      const confirmDeposit = async () => {
        try {
          const result = await api.billing.confirmDeposit(
            depositTxHash,
            organizationId,
            estimatedCredits || 0
          );
          toast.success(`${result.credits} credits added!`);
          router.push("/billing");
        } catch {
          toast.error("Failed to credit your account. Please contact support.");
        }
      };
      confirmDeposit();
    }
  }, [
    isDepositConfirmed,
    depositTxHash,
    organizationId,
    estimatedCredits,
    router,
  ]);

  const handleConnect = () => {
    const injectedConnector = connectors.find((c) => c.type === "injected");
    if (injectedConnector) {
      connect({
        connector: injectedConnector,
        chainId: SEPOLIA_CHAIN_ID,
      });
    }
  };

  const handleSwitchToSepolia = () => {
    if (switchChain) {
      switchChain({ chainId: SEPOLIA_CHAIN_ID });
    }
  };

  const handleMintTestTokens = async (token: "USDT" | "USDS") => {
    if (!(address && isOnSepoliaNetwork)) {
      return;
    }

    const tokenAddress = MOCK_TOKENS[token];
    // USDT has 6 decimals, USDS has 18 decimals
    const decimals = token === "USDT" ? 6 : 18;
    const amount = parseUnits("100", decimals); // Mint 100 tokens

    try {
      setIsMinting(token);
      writeContract(
        {
          address: tokenAddress,
          abi: MOCK_TOKEN_ABI,
          functionName: "faucet",
          args: [amount],
          chainId: SEPOLIA_CHAIN_ID,
        },
        {
          onSuccess: () => {
            toast.success(`100 ${token} minted to your wallet!`);
            setIsMinting(null);
          },
          onError: () => {
            toast.error(`Failed to mint ${token}. Please try again.`);
            setIsMinting(null);
          },
        }
      );
    } catch {
      toast.error(`Failed to mint ${token}. Please try again.`);
      setIsMinting(null);
    }
  };

  const handleApprove = async () => {
    if (!(address && stablecoinAddress && organizationId)) {
      return;
    }

    // Check if user is on the correct network
    if (!isOnSepoliaNetwork) {
      toast.error("Please switch to Sepolia network first");
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
          onSuccess: (hash) => {
            setApprovalTxHash(hash);
            toast.success("Approval sent! Waiting for confirmation...");
          },
          onError: () => {
            toast.error("Approval failed. Please try again.");
          },
        }
      );
    } catch {
      toast.error("Failed to approve token spending. Please try again.");
    }
  };

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex payment flow handling both ETH and stablecoin transactions
  const handlePurchase = async () => {
    if (!organizationId) {
      return;
    }

    // Check if user is on the correct network
    if (!isOnSepoliaNetwork) {
      toast.error("Please switch to Sepolia network first");
      return;
    }

    try {
      setIsPurchasing(true);
      const orgIdHash = hashOrgId(organizationId);

      if (isStablecoinPayment) {
        // Stablecoin payment
        if (!(address && stablecoinAddress)) {
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
              toast.success("Transaction sent! Waiting for confirmation...");
            },
            onError: () => {
              toast.error("Transaction failed. Please try again.");
              setIsPurchasing(false);
            },
          }
        );
      } else {
        // ETH payment
        if (!(address && ethAmount)) {
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
              toast.success("Transaction sent! Waiting for confirmation...");
            },
            onError: () => {
              toast.error("Transaction failed. Please try again.");
              setIsPurchasing(false);
            },
          }
        );
      }
    } catch {
      toast.error("Failed to send transaction. Please try again.");
      setIsPurchasing(false);
    }
  };

  if (hasError) {
    return (
      <div className="pointer-events-auto h-screen overflow-y-auto">
        <div className="container mx-auto max-w-2xl space-y-8 p-6 pt-24 pb-16">
          <Button
            className="gap-2"
            onClick={() => router.back()}
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Card className="space-y-6 p-8">
            <div className="space-y-4 py-12 text-center">
              <X className="mx-auto h-12 w-12 text-destructive" />
              <h1 className="font-bold text-2xl">Configuration Error</h1>
              <p className="text-muted-foreground">
                Failed to connect to the smart contract. Please ensure:
              </p>
              <ul className="list-inside list-disc space-y-2 text-left text-muted-foreground text-sm">
                <li>
                  Contract address is set: {CREDITS_CONTRACT || "NOT SET"}
                </li>
                <li>RPC URL is configured</li>
                <li>You're connected to the correct network (Sepolia)</li>
              </ul>
              {(ethError || creditsError) && (
                <div className="mt-4 rounded-md bg-destructive/10 p-4 text-left">
                  <p className="font-semibold text-sm">Error Details:</p>
                  {ethError && (
                    <p className="mt-1 font-mono text-xs">
                      ETH Price: {ethError.message}
                    </p>
                  )}
                  {creditsError && (
                    <p className="mt-1 font-mono text-xs">
                      Credits: {creditsError.message}
                    </p>
                  )}
                </div>
              )}
              <div className="pt-4">
                <Button
                  onClick={() => router.push("/billing")}
                  variant="outline"
                >
                  Back to Billing
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (isCalculating) {
    return (
      <div className="pointer-events-auto h-screen overflow-y-auto">
        <div className="container mx-auto max-w-2xl space-y-8 p-6 pt-24 pb-16">
          <Button
            className="gap-2"
            onClick={() => router.back()}
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div className="py-12 text-center">
            <Spinner className="mx-auto mb-4 h-8 w-8" />
            <p className="text-muted-foreground">
              Calculating purchase details...
            </p>
            <p className="mt-2 text-muted-foreground text-xs">
              Contract: {CREDITS_CONTRACT ? "Connected" : "Not configured"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (depositTxHash) {
    return (
      <div className="pointer-events-auto h-screen overflow-y-auto">
        <div className="container mx-auto max-w-2xl space-y-8 p-6 pt-24 pb-16">
          <div className="space-y-6 py-12 text-center">
            {isDepositConfirmed ? (
              <>
                <Check className="mx-auto h-12 w-12 text-green-500" />
                <h1 className="font-bold text-2xl">Payment Successful!</h1>
                <p className="text-muted-foreground">
                  {estimatedCredits?.toLocaleString()} credits have been added
                  to your account
                </p>
              </>
            ) : (
              <>
                <Spinner className="mx-auto h-8 w-8" />
                <h1 className="font-bold text-2xl">Processing Payment</h1>
                <p className="text-muted-foreground">
                  Waiting for blockchain confirmation...
                </p>
                <a
                  className="text-primary text-sm hover:underline"
                  href={`${
                    CHAIN_CONFIG.chainId === 1
                      ? "https://etherscan.io"
                      : "https://sepolia.etherscan.io"
                  }/tx/${depositTxHash}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  View on Etherscan
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto h-screen overflow-y-auto">
      <div className="container mx-auto max-w-2xl space-y-8 p-6 pt-24 pb-16">
        <Button className="gap-2" onClick={() => router.back()} variant="ghost">
          <ArrowLeft className="size-4" />
          Back to Billing
        </Button>

        <div className="space-y-2">
          <h1 className="font-bold text-4xl">Checkout</h1>
          <p className="text-lg text-muted-foreground">
            Complete your credit purchase
          </p>
        </div>

        <Card className="space-y-6 p-8">
          <div className="space-y-4">
            <h2 className="font-semibold text-xl">Payment Method</h2>

            <RadioGroup
              onValueChange={(value) =>
                setPaymentMethod(value as PaymentMethod)
              }
              value={paymentMethod}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="eth" value="eth" />
                <Label className="cursor-pointer" htmlFor="eth">
                  Ethereum (ETH)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem id="stablecoin" value="stablecoin" />
                <Label className="cursor-pointer" htmlFor="stablecoin">
                  Stablecoin (USDC, USDT, USDS)
                </Label>
              </div>
            </RadioGroup>

            {isStablecoinPayment && (
              <div className="space-y-2">
                <Label htmlFor="token">Select Token</Label>
                <Select
                  onValueChange={(value) =>
                    setSelectedToken(value as StablecoinSymbol)
                  }
                  value={selectedToken}
                >
                  <SelectTrigger id="token">
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
                          <Image
                            alt={token.symbol}
                            className="h-4 w-4 rounded-full"
                            height={16}
                            src={token.logoUrl}
                            width={16}
                          />
                          <span>
                            {token.symbol} - {token.name}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Mint Test Tokens - Only on Sepolia */}
          {isOnSepoliaNetwork && isConnected && (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="gap-2" size="sm" variant="outline">
                  <FlaskConical className="h-4 w-4" />
                  Need test tokens?
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5" />
                    Sepolia Test Token Faucet
                  </DialogTitle>
                </DialogHeader>
                <p className="text-muted-foreground text-sm">
                  Mint 100 USDT or USDS to your wallet for testing on Sepolia
                  testnet.
                </p>
                <div className="flex gap-2">
                  <Button
                    disabled={isMinting !== null}
                    onClick={() => handleMintTestTokens("USDT")}
                    size="sm"
                    variant="outline"
                  >
                    {isMinting === "USDT" ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Minting...
                      </>
                    ) : (
                      "Mint 100 USDT"
                    )}
                  </Button>
                  <Button
                    disabled={isMinting !== null}
                    onClick={() => handleMintTestTokens("USDS")}
                    size="sm"
                    variant="outline"
                  >
                    {isMinting === "USDS" ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Minting...
                      </>
                    ) : (
                      "Mint 100 USDS"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <div className="space-y-4">
            <h2 className="font-semibold text-xl">Order Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount (USD)</span>
                <span className="font-semibold">${usdAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Credits</span>
                <span className="font-semibold">
                  {estimatedCredits?.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t pt-3 font-semibold text-base">
                <span>
                  Total ({isStablecoinPayment ? selectedToken : "ETH"})
                </span>
                <span className="font-mono">
                  {isStablecoinPayment
                    ? `${formatUnits(tokenAmount, selectedTokenInfo?.decimals || 6)} ${selectedToken}`
                    : `${ethAmount} ETH`}
                </span>
              </div>
            </div>
          </div>

          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Check className="size-4 text-green-500" />
                Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
              </div>

              {hasInsufficientBalance && (
                <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-3 text-red-600 text-sm dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Insufficient {selectedToken} balance. You need{" "}
                    {formatUnits(tokenAmount, selectedTokenInfo?.decimals || 6)}{" "}
                    {selectedToken} but only have{" "}
                    {formatUnits(
                      tokenBalance,
                      selectedTokenInfo?.decimals || 6
                    )}{" "}
                    {selectedToken}.
                  </span>
                </div>
              )}

              {hasInsufficientEth && (
                <div className="flex items-start gap-2 rounded-md bg-red-500/10 p-3 text-red-600 text-sm dark:text-red-400">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Insufficient ETH balance. You need {ethAmount} ETH but only
                    have {formatEther(ethBalance)} ETH.
                  </span>
                </div>
              )}

              {isOnSepoliaNetwork ? (
                <div className="space-y-3">
                  {isStablecoinPayment && needsApproval && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            className="w-full"
                            disabled={
                              !!approvalTxHash ||
                              isApprovalPending ||
                              hasInsufficientBalance
                            }
                            onClick={handleApprove}
                            size="lg"
                            variant="outline"
                          >
                            {(() => {
                              if (isApprovalPending) {
                                return (
                                  <>
                                    <Spinner className="mr-2 h-4 w-4" />
                                    Confirming approval...
                                  </>
                                );
                              }
                              if (approvalTxHash) {
                                return (
                                  <>
                                    <Spinner className="mr-2 h-4 w-4" />
                                    Waiting for confirmation...
                                  </>
                                );
                              }
                              return `Approve ${selectedToken}`;
                            })()}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="max-w-[250px] text-xs">
                            Token approval allows the credits contract to
                            transfer {selectedToken} on your behalf. This is a
                            one-time permission for this amount.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {isStablecoinPayment && !needsApproval && (
                    <Button
                      className="w-full text-green-600 dark:text-green-400"
                      disabled
                      size="lg"
                      variant="outline"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      {selectedToken} Approved
                    </Button>
                  )}
                  <Button
                    className="w-full"
                    disabled={
                      isPurchasing ||
                      hasInsufficientBalance ||
                      hasInsufficientEth ||
                      (isStablecoinPayment && needsApproval) ||
                      isApprovalPending
                    }
                    onClick={handlePurchase}
                    size="lg"
                  >
                    {isPurchasing ? (
                      <>
                        <Spinner className="mr-2 h-4 w-4" />
                        Confirming...
                      </>
                    ) : (
                      "Purchase Credits"
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-3 text-amber-600 text-sm dark:text-amber-400">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      You're connected to {chain?.name || "the wrong network"}.
                      Please switch to Sepolia testnet.
                    </span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleSwitchToSepolia}
                    size="lg"
                    variant="outline"
                  >
                    Switch to Sepolia
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">
                Connect your wallet to complete the purchase
              </p>
              <Button className="w-full" onClick={handleConnect} size="lg">
                Connect Wallet
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="pointer-events-auto h-screen overflow-y-auto">
          <div className="container mx-auto max-w-2xl space-y-8 p-6 pt-24 pb-16">
            <div className="py-12 text-center">
              <Spinner className="mx-auto mb-4 h-8 w-8" />
              <p className="text-muted-foreground">Loading checkout...</p>
            </div>
          </div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
