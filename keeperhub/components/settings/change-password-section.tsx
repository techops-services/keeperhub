"use client";

import { AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useOverlay } from "@/components/overlays/overlay-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";

type ChangePasswordSectionProps = {
  providerId: string | null;
};

export function ChangePasswordSection({
  providerId,
}: ChangePasswordSectionProps) {
  const router = useRouter();
  const { closeAll: closeOverlays } = useOverlay();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isOAuthUser = providerId !== null && providerId !== "credential";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to change password");
      }

      // Sign out user after password change for security
      await authClient.signOut();
      toast.success("Password changed successfully. Please sign in again.");
      closeOverlays();
      router.push("/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to change password"
      );
    } finally {
      setLoading(false);
    }
  };

  if (isOAuthUser) {
    const providerName =
      providerId.charAt(0).toUpperCase() + providerId.slice(1);
    return (
      <Card className="border-0 py-0 shadow-none">
        <CardContent className="p-0">
          <div className="space-y-2">
            <Label className="ml-1">Password</Label>
            <p className="text-muted-foreground text-sm">
              Your password is managed by {providerName}. To change your
              password, please visit your {providerName} account settings.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 py-0 shadow-none">
      <CardContent className="p-0">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Alert variant="default">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You will be signed out after changing your password and will need
              to sign in again.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label className="ml-1" htmlFor="currentPassword">
              Current Password
            </Label>
            <Input
              autoComplete="current-password"
              id="currentPassword"
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
              type="password"
              value={currentPassword}
            />
          </div>

          <div className="space-y-2">
            <Label className="ml-1" htmlFor="newPassword">
              New Password
            </Label>
            <Input
              autoComplete="new-password"
              id="newPassword"
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 8 characters)"
              required
              type="password"
              value={newPassword}
            />
          </div>

          <div className="space-y-2">
            <Label className="ml-1" htmlFor="confirmPassword">
              Confirm New Password
            </Label>
            <Input
              autoComplete="new-password"
              id="confirmPassword"
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
              type="password"
              value={confirmPassword}
            />
          </div>

          <Button
            className="w-full"
            disabled={
              loading || !currentPassword || !newPassword || !confirmPassword
            }
            type="submit"
          >
            {loading ? <Spinner className="mr-2 size-4" /> : null}
            Change Password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
