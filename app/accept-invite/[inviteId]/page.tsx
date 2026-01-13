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

function getErrorTitle(inviteError: InvitationError): string {
  if (inviteError.expired) {
    return "Invitation Expired";
  }
  if (inviteError.alreadyAccepted) {
    return "Already Accepted";
  }
  if (inviteError.rejected) {
    return "Invitation Rejected";
  }
  return "Invalid Invitation";
}

function ErrorState({ inviteError }: { inviteError: InvitationError }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-destructive/10">
          <svg
            aria-hidden="true"
            className="size-6 text-destructive"
            fill="none"
            role="img"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <title>Error icon</title>
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
            {getErrorTitle(inviteError)}
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

function NotFoundState() {
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

function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner className="size-8" />
    </div>
  );
}

async function trySignUp(email: string, password: string) {
  const response = await signUp.email({
    email,
    password,
    name: email.split("@")[0],
  });

  if (!response.error) {
    return { success: true, userExists: false };
  }

  const errorMessage = response.error.message?.toLowerCase() || "";
  const userExists =
    errorMessage.includes("already exists") ||
    errorMessage.includes("user with this email");

  if (userExists) {
    return { success: false, userExists: true };
  }

  return {
    success: false,
    userExists: false,
    error: response.error.message || "Failed to create account",
  };
}

async function trySignIn(email: string, password: string, isExisting: boolean) {
  const response = await signIn.email({ email, password });

  if (!response.error) {
    return { success: true };
  }

  const error = isExisting
    ? "Incorrect password. Please try again."
    : response.error.message || "Failed to sign in";

  return { success: false, error };
}

async function acceptInvitation(invitationId: string) {
  const response = await authClient.organization.acceptInvitation({
    invitationId,
  });

  if (response.error) {
    return {
      success: false,
      error: response.error.message || "Failed to accept invitation",
    };
  }

  return { success: true };
}

type AuthFlowResult = {
  success: boolean;
  error?: string;
  userExists?: boolean;
};

async function performAuthFlow(
  email: string,
  password: string,
  invitationId: string,
  isExistingUser: boolean
): Promise<AuthFlowResult> {
  let shouldSignIn = isExistingUser;

  // Try signup for new users
  if (!isExistingUser) {
    const signUpResult = await trySignUp(email, password);
    if (signUpResult.userExists) {
      shouldSignIn = true;
      return { success: false, userExists: true };
    }
    if (!signUpResult.success) {
      return { success: false, error: signUpResult.error };
    }
  }

  // Sign in
  const signInResult = await trySignIn(email, password, shouldSignIn);
  if (!signInResult.success) {
    return { success: false, error: signInResult.error };
  }

  // Accept invitation
  const acceptResult = await acceptInvitation(invitationId);
  if (!acceptResult.success) {
    return { success: false, error: acceptResult.error };
  }

  return { success: true };
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const inviteId = params.inviteId as string;

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [inviteError, setInviteError] = useState<InvitationError | null>(null);

  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);

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

    if (!invitation) {
      return;
    }

    if (!isExistingUser && password.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);

    try {
      const result = await performAuthFlow(
        invitation.email,
        password,
        invitation.id,
        isExistingUser
      );

      if (result.userExists) {
        setIsExistingUser(true);
        setFormError("Please enter your password to sign in.");
        setSubmitting(false);
        return;
      }

      if (!result.success) {
        setFormError(result.error || "Something went wrong");
        setSubmitting(false);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
      await authClient.getSession();
      refetchOrganizations();
      toast.success(`Welcome to ${invitation.organizationName}!`);
      router.push("/workflows");
    } catch (error) {
      console.error("Failed to accept invitation:", error);
      setFormError(
        error instanceof Error ? error.message : "Something went wrong"
      );
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  if (inviteError) {
    return <ErrorState inviteError={inviteError} />;
  }

  if (!invitation) {
    return <NotFoundState />;
  }

  return (
    <div className="pointer-events-auto flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8">
        <div className="space-y-2 text-center">
          <h1 className="font-semibold text-2xl">
            Join {invitation.organizationName}
          </h1>
          <p className="text-muted-foreground text-sm">
            {invitation.inviterName} invited you to join as{" "}
            <span className="font-medium text-foreground">
              {invitation.role}
            </span>
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input disabled id="email" type="email" value={invitation.email} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              disabled={submitting}
              id="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                isExistingUser ? "Enter your password" : "Create a password"
              }
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
            {submitting && <Spinner className="mr-2 size-4" />}
            {submitting && isExistingUser && "Signing in..."}
            {submitting && !isExistingUser && "Creating account..."}
            {!submitting && isExistingUser && "Sign In & Join"}
            {!(submitting || isExistingUser) && "Create Account & Join"}
          </Button>
        </form>

        {isExistingUser && (
          <p className="text-center text-muted-foreground text-xs">
            An account with this email already exists. Enter your password to
            sign in and join.
          </p>
        )}
      </div>
    </div>
  );
}
