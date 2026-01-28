"use client";

import { useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { integrationsVersionAtom } from "@/lib/integrations-store";

type Web3WalletSectionProps = {
  onSuccess?: (integrationId: string) => void;
  closeAll?: () => void;
  showDelete?: boolean;
};

export function Web3WalletSection({
  onSuccess,
  closeAll,
  showDelete = true,
}: Web3WalletSectionProps) {
  const setIntegrationsVersion = useSetAtom(integrationsVersionAtom);
  const [hasWallet, setHasWallet] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  // start keeperhub - store user email for wallet creation
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // end keeperhub

  // Check wallet status and user type on mount
  useEffect(() => {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Sequential checks for wallet status
    async function checkWallet() {
      try {
        // Check if user is anonymous by fetching user profile
        const userResponse = await fetch("/api/user");
        const userData = await userResponse.json();

        // Detect anonymous user by email pattern or isAnonymous flag
        const isAnonUser =
          userData.isAnonymous ||
          userData.email?.includes("@http://") ||
          userData.email?.includes("@https://") ||
          userData.email?.startsWith("temp-");

        setIsAnonymous(isAnonUser);
        // start keeperhub - store user email for wallet creation
        if (!isAnonUser && userData.email) {
          setUserEmail(userData.email);
        }
        // end keeperhub

        // Only check for wallet if not anonymous
        if (!isAnonUser) {
          const response = await fetch("/api/user/wallet");
          const data = await response.json();

          if (data.hasWallet) {
            setHasWallet(true);
            setWalletAddress(data.walletAddress);
          }
        }
      } catch (error) {
        console.error("Failed to check wallet:", error);
      } finally {
        setLoading(false);
      }
    }

    checkWallet();
  }, []);

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Sequential wallet creation with error handling
  async function handleCreateWallet() {
    // start keeperhub - validate email before creating
    if (!userEmail) {
      toast.error("Unable to get your email. Please refresh and try again.");
      return;
    }
    // end keeperhub

    setCreating(true);
    try {
      // start keeperhub - send email in request body
      const response = await fetch("/api/user/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      });
      // end keeperhub

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.error || "Failed to create wallet";
        // Show user-friendly error for anonymous users
        if (errorMsg.includes("Anonymous users")) {
          throw new Error(
            "Please sign in with a real account (email, GitHub, or Google) to create a wallet."
          );
        }
        throw new Error(errorMsg);
      }

      setHasWallet(true);
      setWalletAddress(data.wallet.address);
      toast.success("Wallet created successfully!");

      // Trigger re-fetch of integrations so UI syncs and auto-selects the new wallet
      setIntegrationsVersion((v) => v + 1);

      // Close overlay and return to sidepanel with wallet selected
      if (onSuccess) {
        onSuccess(data.integration?.id || "web3-wallet");
      }
      if (closeAll) {
        closeAll();
      }
    } catch (error) {
      console.error("Wallet creation failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create wallet"
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteWallet() {
    // biome-ignore lint/suspicious/noAlert: Simple confirmation for destructive action
    if (!confirm("Are you sure? This cannot be undone.")) {
      return;
    }

    try {
      const response = await fetch("/api/user/wallet", {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete wallet");
      }

      setHasWallet(false);
      setWalletAddress(null);
      toast.success("Wallet deleted");
      // Trigger re-fetch of integrations so UI syncs
      setIntegrationsVersion((v) => v + 1);
    } catch {
      toast.error("Failed to delete wallet");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-sm">Para Wallet</h3>
        <p className="text-muted-foreground text-sm">
          Use your email address to pre-generate a wallet for Web3 automations.
        </p>
      </div>

      {(() => {
        if (isAnonymous) {
          return (
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-muted-foreground text-sm">
                Please sign in with a real account to create a wallet.
              </p>
            </div>
          );
        }

        if (hasWallet) {
          return (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/50 p-3">
                <div className="mb-1 text-muted-foreground text-xs">
                  Wallet Address
                </div>
                <code className="break-all font-mono text-xs">
                  {walletAddress}
                </code>
              </div>
              {showDelete && (
                <Button
                  className="w-full"
                  onClick={handleDeleteWallet}
                  size="sm"
                  variant="destructive"
                >
                  Delete Wallet
                </Button>
              )}
            </div>
          );
        }

        return (
          <Button
            className="w-full"
            disabled={creating}
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
        );
      })()}
    </div>
  );
}
