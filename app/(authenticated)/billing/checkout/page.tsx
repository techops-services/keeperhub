"use client";

import { ArrowLeft, Check } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatEther, parseEther } from "viem";
import {
  useAccount,
  useConnect,
  useReadContract,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { hashOrgId } from "@/keeperhub/lib/billing/contracts";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
import { api } from "@/lib/api-client";

const CREDITS_CONTRACT = process.env.NEXT_PUBLIC_CREDITS_CONTRACT_ADDRESS || "";

export default function CheckoutPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const usdAmount = searchParams.get("amount") || "25";
  const activeMember = useActiveMember();
  const organizationId = activeMember?.member?.organizationId;

  const [txHash, setTxHash] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);

  const usdInCents = Math.floor(Number.parseFloat(usdAmount) * 1_000_000);

  // Log contract address for debugging
  useEffect(() => {
    console.log("Credits Contract Address:", CREDITS_CONTRACT);
    console.log("USD Amount:", usdAmount);
    console.log("USD in cents:", usdInCents);
    console.log("Organization ID:", organizationId);
  }, [usdAmount, usdInCents, organizationId]);

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

  // Log errors for debugging
  useEffect(() => {
    if (ethError) {
      console.error("Error fetching ETH amount:", ethError);
      console.error("Full error details:", {
        message: ethError.message,
        cause: ethError.cause,
        name: ethError.name,
      });
    }
    if (creditsError) {
      console.error("Error calculating credits:", creditsError);
      console.error("Full error details:", {
        message: creditsError.message,
        cause: creditsError.cause,
        name: creditsError.name,
      });
    }
  }, [ethError, creditsError]);

  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { switchChain } = useSwitchChain();
  const { sendTransaction } = useSendTransaction();
  const { isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash as `0x${string}` | undefined,
  });

  const SEPOLIA_CHAIN_ID = 11_155_111;
  const isOnSepoliaNetwork = chain?.id === SEPOLIA_CHAIN_ID;

  // Confirm deposit after transaction is mined
  useEffect(() => {
    if (isConfirmed && txHash && organizationId) {
      const confirmDeposit = async () => {
        try {
          const result = await api.billing.confirmDeposit(
            txHash,
            organizationId
          );
          toast.success(`${result.credits} credits added!`);
          router.push("/billing");
        } catch (error) {
          console.error("Failed to confirm:", error);
          toast.error("Failed to credit your account. Please contact support.");
        }
      };
      confirmDeposit();
    }
  }, [isConfirmed, txHash, organizationId]);

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

  const handlePurchase = async () => {
    if (!(address && ethAmount && organizationId)) return;

    // Check if user is on the correct network
    if (!isOnSepoliaNetwork) {
      toast.error("Please switch to Sepolia network first");
      return;
    }

    try {
      setIsPurchasing(true);
      const orgIdHash = hashOrgId(organizationId);

      sendTransaction(
        {
          to: CREDITS_CONTRACT as `0x${string}`,
          value: parseEther(ethAmount),
          data: `0xd8b4cb51${orgIdHash.slice(2)}`,
          chainId: SEPOLIA_CHAIN_ID,
        },
        {
          onSuccess: (hash) => {
            setTxHash(hash);
            toast.success("Transaction sent! Waiting for confirmation...");
          },
          onError: (error) => {
            console.error("Transaction failed:", error);
            toast.error(`Transaction failed: ${error.message}`);
            setIsPurchasing(false);
          },
        }
      );
    } catch (error) {
      console.error("Failed to send transaction:", error);
      toast.error("Failed to send transaction");
      setIsPurchasing(false);
    }
  };

  if (hasError) {
    return (
      <div className="container pointer-events-auto mx-auto max-w-2xl space-y-8 p-6">
        <Button className="gap-2" onClick={() => router.back()} variant="ghost">
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <Card className="space-y-6 p-8">
          <div className="space-y-4 py-12 text-center">
            <div className="text-6xl text-destructive">✕</div>
            <h1 className="font-bold text-2xl">Configuration Error</h1>
            <p className="text-muted-foreground">
              Failed to connect to the smart contract. Please ensure:
            </p>
            <ul className="list-inside list-disc space-y-2 text-left text-muted-foreground text-sm">
              <li>Contract address is set: {CREDITS_CONTRACT || "NOT SET"}</li>
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
              <Button onClick={() => router.push("/billing")} variant="outline">
                Back to Billing
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (isCalculating) {
    return (
      <div className="container pointer-events-auto mx-auto max-w-2xl space-y-8 p-6">
        <Button className="gap-2" onClick={() => router.back()} variant="ghost">
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="py-12 text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-primary border-b-2" />
          <p className="text-muted-foreground">
            Calculating purchase details...
          </p>
          <p className="mt-2 text-muted-foreground text-xs">
            Contract: {CREDITS_CONTRACT ? "Connected" : "Not configured"}
          </p>
        </div>
      </div>
    );
  }

  if (txHash) {
    return (
      <div className="container pointer-events-auto mx-auto max-w-2xl space-y-8 p-6">
        <div className="space-y-6 py-12 text-center">
          {isConfirmed ? (
            <>
              <div className="text-6xl text-green-500">✓</div>
              <h1 className="font-bold text-2xl">Payment Successful!</h1>
              <p className="text-muted-foreground">
                {estimatedCredits?.toLocaleString()} credits have been added to
                your account
              </p>
            </>
          ) : (
            <>
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-primary border-b-2" />
              <h1 className="font-bold text-2xl">Processing Payment</h1>
              <p className="text-muted-foreground">
                Waiting for blockchain confirmation...
              </p>
              <a
                className="text-primary text-sm hover:underline"
                href={`${
                  process.env.NEXT_PUBLIC_CHAIN_ID === "1"
                    ? "https://etherscan.io"
                    : "https://sepolia.etherscan.io"
                }/tx/${txHash}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                View on Etherscan
              </a>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container pointer-events-auto mx-auto max-w-2xl space-y-8 p-6">
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
              <span>Total (ETH)</span>
              <span className="font-mono">{ethAmount} ETH</span>
            </div>
          </div>
        </div>

        {isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Check className="size-4 text-green-500" />
              Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
            {isOnSepoliaNetwork ? (
              <Button
                className="w-full"
                disabled={isPurchasing}
                onClick={handlePurchase}
                size="lg"
              >
                {isPurchasing ? "Confirming..." : "Purchase Credits"}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-600 dark:text-yellow-400">
                  ⚠️ You're connected to {chain?.name || "the wrong network"}.
                  Please switch to Sepolia testnet.
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
  );
}
