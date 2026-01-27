"use client";

import { ethers } from "ethers";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
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
import { SaveAddressBookmark } from "@/keeperhub/components/address-book/save-address-bookmark";

export type WithdrawableAsset = {
  type: "native" | "token";
  chainId: number;
  chainName: string;
  symbol: string;
  balance: string;
  tokenAddress?: string;
  decimals: number;
  rpcUrl: string;
  explorerUrl: string | null;
};

type WithdrawModalProps = {
  overlayId: string;
  assets: WithdrawableAsset[];
  walletAddress: string;
  initialAssetIndex?: number;
};

type WithdrawState = "input" | "confirming" | "success" | "error";

export function WithdrawModal({
  overlayId,
  assets,
  walletAddress,
  initialAssetIndex = 0,
}: WithdrawModalProps) {
  const { closeAll, pop } = useOverlay();

  const [selectedAssetIndex, setSelectedAssetIndex] =
    useState(initialAssetIndex);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [state, setState] = useState<WithdrawState>("input");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [gasEstimate, _setGasEstimate] = useState<string | null>(null);

  const selectedAsset = assets[selectedAssetIndex];

  const handleMaxClick = () => {
    if (selectedAsset) {
      setAmount(selectedAsset.balance);
    }
  };

  const validateWithdrawal = (): string | null => {
    if (!selectedAsset) {
      return "Please select an asset";
    }
    if (!amount || Number.parseFloat(amount) <= 0) {
      return "Please enter a valid amount";
    }
    if (Number.parseFloat(amount) > Number.parseFloat(selectedAsset.balance)) {
      return "Insufficient balance";
    }
    if (!ethers.isAddress(recipient)) {
      return "Please enter a valid recipient address";
    }
    if (recipient.toLowerCase() === walletAddress.toLowerCase()) {
      return "Cannot withdraw to the same address";
    }
    return null;
  };

  const handleSubmit = async () => {
    const validationError = validateWithdrawal();
    if (validationError || !selectedAsset) {
      if (validationError) {
        toast.error(validationError);
      }
      return;
    }

    setState("confirming");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/user/wallet/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: selectedAsset.chainId,
          tokenAddress: selectedAsset.tokenAddress,
          amount,
          recipient,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Withdrawal failed");
      }

      setTxHash(data.txHash);
      setState("success");
      toast.success("Withdrawal successful!");
    } catch (error) {
      console.error("Withdrawal failed:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Withdrawal failed"
      );
      setState("error");
    }
  };

  // Success state
  if (state === "success" && txHash) {
    return (
      <Overlay
        actions={[{ label: "Done", onClick: closeAll }]}
        overlayId={overlayId}
        title="Withdrawal Complete"
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="mb-4 size-12 text-green-500" />
          <p className="mb-2 font-medium">
            {amount} {selectedAsset?.symbol} sent
          </p>
          <p className="mb-4 text-muted-foreground text-sm">
            To: {recipient.slice(0, 6)}...{recipient.slice(-4)}
          </p>
        </div>
      </Overlay>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <Overlay
        actions={[
          { label: "Try Again", onClick: () => setState("input") },
          { label: "Close", variant: "outline", onClick: closeAll },
        ]}
        overlayId={overlayId}
        title="Withdrawal Failed"
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertCircle className="mb-4 size-12 text-destructive" />
          <p className="mb-2 font-medium">Transaction failed</p>
          <p className="text-muted-foreground text-sm">{errorMessage}</p>
        </div>
      </Overlay>
    );
  }

  // Confirming state
  if (state === "confirming") {
    return (
      <Overlay overlayId={overlayId} title="Processing Withdrawal">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Loader2 className="mb-4 size-12 animate-spin text-primary" />
          <p className="mb-2 font-medium">Signing and sending transaction...</p>
          <p className="text-muted-foreground text-sm">
            Please wait while we process your withdrawal
          </p>
        </div>
      </Overlay>
    );
  }

  // Input state
  return (
    <Overlay
      actions={[
        { label: "Cancel", variant: "outline", onClick: pop },
        {
          label: "Withdraw",
          onClick: handleSubmit,
          disabled:
            !(amount && recipient && ethers.isAddress(recipient)) ||
            Number.parseFloat(amount) <= 0 ||
            Number.parseFloat(amount) >
              Number.parseFloat(selectedAsset?.balance || "0"),
        },
      ]}
      overlayId={overlayId}
      title="Withdraw Funds"
    >
      <p className="-mt-2 mb-4 text-muted-foreground text-sm">
        Send funds from your Para wallet to another address
      </p>

      <div className="space-y-4">
        {/* Asset Selection */}
        <div className="space-y-2">
          <Label>Asset</Label>
          <Select
            onValueChange={(value) => {
              setSelectedAssetIndex(Number.parseInt(value, 10));
              setAmount("");
            }}
            value={selectedAssetIndex.toString()}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select asset" />
            </SelectTrigger>
            <SelectContent>
              {assets.map((asset, index) => (
                <SelectItem
                  key={`${asset.chainId}-${asset.tokenAddress || "native"}`}
                  value={index.toString()}
                >
                  {asset.symbol} on {asset.chainName} ({asset.balance})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <Label>Amount</Label>
          <div className="flex gap-2">
            <Input
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              type="number"
              value={amount}
            />
            <Button
              onClick={handleMaxClick}
              size="sm"
              type="button"
              variant="outline"
            >
              Max
            </Button>
          </div>
          {selectedAsset && (
            <p className="text-muted-foreground text-xs">
              Available: {selectedAsset.balance} {selectedAsset.symbol}
            </p>
          )}
        </div>

        {/* Recipient Address */}
        <div className="space-y-2">
          <Label>Recipient Address</Label>
          <SaveAddressBookmark address={recipient}>
            <Input
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              value={recipient}
            />
          </SaveAddressBookmark>
          {recipient && !ethers.isAddress(recipient) && (
            <p className="text-destructive text-xs">Invalid address format</p>
          )}
        </div>

        {/* Gas Estimate (informational) */}
        {gasEstimate && (
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="text-muted-foreground text-xs">
              Estimated network fee: {gasEstimate}
            </p>
          </div>
        )}
      </div>
    </Overlay>
  );
}
