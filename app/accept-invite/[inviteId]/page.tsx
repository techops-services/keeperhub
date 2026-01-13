"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { refetchOrganizations } from "@/keeperhub/lib/refetch-organizations";
import { authClient, signIn, signUp } from "@/lib/auth-client";

type InvitationData = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  organizationName: string;
  inviterName: string;
};

type InvitationError = {
  error: string;
  expired?: boolean;
  alreadyAccepted?: boolean;
  rejected?: boolean;
  invitation?: {
    email: string;
    organizationName: string;
  };
};

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const inviteId = params.inviteId as string;

  // Invitation state
  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [inviteError, setInviteError] = useState<InvitationError | null>(null);

  // Form state
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);

  // Fetch invitation details
  useEffect(() => {
    async function fetchInvitation() {
      try {
        const response = await fetch(`/api/invitations/${inviteId}`);
        const data = await response.json();

        if (!response.ok) {
          setInviteError(data);
          return;
        }

        setInvitation(data.invitation);
      } catch (error) {
        console.error("Failed to fetch invitation:", error);
        setInviteError({ error: "Failed to load invitation details" });
      } finally {
        setLoading(false);
      }
    }

    if (inviteId) {
      fetchInvitation();
    }
  }, [inviteId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!invitation) return;

    // Validate password length for new users
    if (!isExistingUser && password.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);

    try {
      // Try to create account first (for new users)
      if (!isExistingUser) {
        const signUpResponse = await signUp.email({
          email: invitation.email,
          password,
          name: invitation.email.split("@")[0],
        });

        if (signUpResponse.error) {
          // Check if user already exists
          const errorMessage = signUpResponse.error.message?.toLowerCase() || "";
          if (
            errorMessage.includes("already exists") ||
            errorMessage.includes("user with this email")
          ) {
            // User exists, switch to sign in mode and try to sign in
            setIsExistingUser(true);
          } else {
            setFormError(signUpResponse.error.message || "Failed to create account");
            setSubmitting(false);
            return;
          }
        }
      }

      // Sign in (either after signup or for existing users)
      const signInResponse = await signIn.email({
        email: invitation.email,
        password,
      });

      if (signInResponse.error) {
        if (isExistingUser) {
          setFormError("Incorrect password. Please try again.");
        } else {
          setFormError(signInResponse.error.message || "Failed to sign in");
        }
        setSubmitting(false);
        return;
      }

      // Accept the invitation
      const acceptResponse = await authClient.organization.acceptInvitation({
        invitationId: invitation.id,
      });

      if (acceptResponse.error) {
        setFormError(
          acceptResponse.error.message || "Failed to accept invitation"
        );
        setSubmitting(false);
        return;
      }

      // Small delay to let session update
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Refresh session to get the new organization
      await authClient.getSession();

      // Trigger organization refetch
      refetchOrganizations();

      toast.success(`Welcome to ${invitation.organizationName}!`);

      // Redirect to workflows
      router.push("/workflows");
    } catch (error) {
      console.error("Failed to accept invitation:", error);
      setFormError(
        error instanceof Error ? error.message : "Something went wrong"
      );
      setSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  // Error states
  if (inviteError) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="size-6 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M6 18L18 6M6 6l12 12"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="font-semibold text-xl">
              {inviteError.expired && "Invitation Expired"}
              {inviteError.alreadyAccepted && "Already Accepted"}
              {inviteError.rejected && "Invitation Rejected"}
              {!inviteError.expired &&
                !inviteError.alreadyAccepted &&
                !inviteError.rejected &&
                "Invalid Invitation"}
            </h1>
            <p className="text-muted-foreground text-sm">{inviteError.error}</p>
          </div>

          {inviteError.invitation && (
            <p className="text-muted-foreground text-sm">
              Organization: {inviteError.invitation.organizationName}
            </p>
          )}
        </div>
      </div>
    );
  }

  // No invitation found
  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 text-center">
          <h1 className="font-semibold text-xl">Invitation Not Found</h1>
          <p className="text-muted-foreground text-sm">
            This invitation link is invalid or has been removed.
          </p>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="flex min-h-screen items-center justify-center p-4 pointer-events-auto">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8">
        <div className="space-y-2 text-center">
          <h1 className="font-semibold text-2xl">Join {invitation.organizationName}</h1>
          <p className="text-muted-foreground text-sm">
            {invitation.inviterName} invited you to join as{" "}
            <span className="font-medium text-foreground">{invitation.role}</span>
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              disabled
              id="email"
              type="email"
              value={invitation.email}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              disabled={submitting}
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isExistingUser ? "Enter your password" : "Create a password"}
              required
              type="password"
              value={password}
            />
            {!isExistingUser && (
              <p className="text-muted-foreground text-xs">
                Password must be at least 8 characters.
              </p>
            )}
          </div>

          {formError && (
            <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
              {formError}
            </div>
          )}

          <Button className="w-full" disabled={submitting} type="submit">
            {submitting ? (
              <>
                <Spinner className="mr-2 size-4" />
                {isExistingUser ? "Signing in..." : "Creating account..."}
              </>
            ) : isExistingUser ? (
              "Sign In & Join"
            ) : (
              "Create Account & Join"
            )}
          </Button>
        </form>

        {isExistingUser && (
          <p className="text-center text-muted-foreground text-xs">
            An account with this email already exists. Enter your password to sign in and join.
          </p>
        )}
      </div>
    </div>
  );
}
