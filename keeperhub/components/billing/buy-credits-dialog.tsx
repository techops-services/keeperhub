"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatEther, parseEther } from "viem";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useSendTransaction,
  useWaitForTransactionReceipt,
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
import { hashOrgId } from "@/keeperhub/lib/billing/contracts";
import { api } from "@/lib/api-client";

const CREDITS_CONTRACT = process.env.NEXT_PUBLIC_CREDITS_CONTRACT_ADDRESS || "";

type Step = "input" | "connect" | "confirm" | "processing" | "success";

type BuyCreditsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  onSuccess?: (credits: number) => void;
  initialAmount?: string;
  skipInput?: boolean;
};

export function BuyCreditsDialog({
  open,
  onOpenChange,
  organizationId,
  onSuccess,
  initialAmount = "25",
  skipInput = false,
}: BuyCreditsDialogProps) {
  const [step, setStep] = useState<Step>(skipInput ? "connect" : "input");
  const [usdAmount, setUsdAmount] = useState(initialAmount);
  const [ethAmount, setEthAmount] = useState<string | null>(null);
  const [estimatedCredits, setEstimatedCredits] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isCalculating, setIsCalculating] = useState(skipInput);

  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { sendTransaction, isPending: isSendingTx } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash: txHash as `0x${string}` | undefined,
    });

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

  // Calculate ETH amount and credits when USD amount changes
  const calculateEthAmount = async () => {
    if (!usdAmount || Number.parseFloat(usdAmount) <= 0) {
      setEthAmount(null);
      setEstimatedCredits(null);
      return;
    }

    try {
      const usdInCents = Math.floor(Number.parseFloat(usdAmount) * 1_000_000);

      // Call contract to get ETH amount needed
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY"}`,
        {
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
        }
      );

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
  };

  const handleConnect = () => {
    const injectedConnector = connectors.find((c) => c.type === "injected");
    if (injectedConnector) {
      connect({ connector: injectedConnector });
      setStep("confirm");
    }
  };

  const handleBuy = async () => {
    if (!(address && ethAmount)) {
      return;
    }

    try {
      setStep("processing");

      const orgIdHash = hashOrgId(organizationId);

      sendTransaction(
        {
          to: CREDITS_CONTRACT as `0x${string}`,
          value: parseEther(ethAmount),
          data: `0xd8b4cb51${orgIdHash.slice(2)}`, // depositETH(bytes32)
        },
        {
          onSuccess: (hash) => {
            setTxHash(hash);
            toast.success("Transaction sent. Waiting for confirmation...");
          },
          onError: (error) => {
            console.error("Transaction failed:", error);
            toast.error(`Transaction failed: ${error.message}`);
            setStep("confirm");
          },
        }
      );
    } catch (error) {
      console.error("Failed to send transaction:", error);
      toast.error("Failed to send transaction");
      setStep("confirm");
    }
  };

  // Confirm deposit after transaction is mined
  const confirmDeposit = async () => {
    if (!txHash) {
      return;
    }

    try {
      const result = await api.billing.confirmDeposit(txHash, organizationId);

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
  if (isConfirmed && txHash && step === "processing") {
    confirmDeposit();
  }

  const resetDialog = () => {
    setStep(skipInput ? "connect" : "input");
    setEthAmount(null);
    setEstimatedCredits(null);
    setTxHash(null);
  };

  // Reset dialog when it closes
  useEffect(() => {
    if (!open) {
      resetDialog();
    }
  }, [open, resetDialog]);

  return (
    <Dialog
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) {
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
            {process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "Ethereum" : "Sepolia"}.
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

            {ethAmount && estimatedCredits && (
              <div className="space-y-2 rounded-lg bg-muted p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">ETH Required:</span>
                  <span className="font-mono">
                    {Number.parseFloat(ethAmount).toFixed(6)} ETH
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
              disabled={!(ethAmount && estimatedCredits)}
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
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-mono">{ethAmount} ETH</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Credits:</span>
                <span className="font-semibold">
                  {estimatedCredits?.toLocaleString()}
                </span>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={isSendingTx}
              onClick={handleBuy}
            >
              {isSendingTx ? "Confirming..." : "Confirm Purchase"}
            </Button>

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
            {txHash && (
              <a
                className="text-primary text-sm hover:underline"
                href={`${process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "https://etherscan.io" : "https://sepolia.etherscan.io"}/tx/${txHash}`}
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
