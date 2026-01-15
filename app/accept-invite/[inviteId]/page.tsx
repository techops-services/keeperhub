"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { refetchOrganizations } from "@/keeperhub/lib/refetch-organizations";
import {
  authClient,
  signIn,
  signOut,
  signUp,
  useSession,
} from "@/lib/auth-client";

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

type PageState =
  | "loading"
  | "error"
  | "not-found"
  | "logged-in-match"
  | "logged-in-mismatch"
  | "logged-out";

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

async function trySignIn(email: string, password: string) {
  const response = await signIn.email({ email, password });

  if (!response.error) {
    return { success: true };
  }

  return {
    success: false,
    error: response.error.message || "Failed to sign in",
  };
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

// Component for logged-in users with matching email
function AcceptDirectState({
  invitation,
  onSuccess,
}: {
  invitation: InvitationData;
  onSuccess: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleAccept = async () => {
    setSubmitting(true);
    setError("");

    try {
      const result = await acceptInvitation(invitation.id);
      if (!result.success) {
        setError(result.error || "Failed to accept invitation");
        setSubmitting(false);
        return;
      }
      onSuccess();
    } catch (err) {
      console.error("Failed to accept invitation:", err);
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  };

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

        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-center text-sm">
            You&apos;re signed in as{" "}
            <span className="font-medium">{invitation.email}</span>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            disabled={submitting}
            onClick={handleAccept}
          >
            {submitting && <Spinner className="mr-2 size-4" />}
            {submitting ? "Joining..." : "Accept Invitation"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Component for logged-in users with different email
function EmailMismatchState({
  invitation,
  currentEmail,
}: {
  invitation: InvitationData;
  currentEmail: string;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      window.location.reload();
    } catch (err) {
      console.error("Failed to sign out:", err);
      setSigningOut(false);
    }
  };

  const handleDecline = () => {
    router.push("/workflows");
  };

  return (
    <div className="pointer-events-auto flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border bg-card p-8">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10">
          <svg
            aria-hidden="true"
            className="size-6 text-amber-500"
            fill="none"
            role="img"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <title>Warning icon</title>
            <path
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
            />
          </svg>
        </div>

        <div className="space-y-2 text-center">
          <h1 className="font-semibold text-xl">Wrong Account</h1>
          <p className="text-muted-foreground text-sm">
            This invitation is for{" "}
            <span className="font-medium text-foreground">
              {invitation.email}
            </span>
          </p>
          <p className="text-muted-foreground text-sm">
            You&apos;re currently signed in as{" "}
            <span className="font-medium text-foreground">{currentEmail}</span>
          </p>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            {signingOut && <Spinner className="mr-2 size-4" />}
            {signingOut ? "Signing out..." : "Sign Out & Continue"}
          </Button>
          <Button
            className="w-full"
            disabled={signingOut}
            onClick={handleDecline}
            variant="outline"
          >
            Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper to handle signup flow
async function handleSignupFlow(
  email: string,
  password: string,
  setAuthMode: (mode: "signin" | "signup") => void,
  setFormError: (error: string) => void
): Promise<{ shouldContinue: boolean }> {
  const signUpResult = await trySignUp(email, password);

  if (signUpResult.userExists) {
    setAuthMode("signin");
    setFormError("An account with this email already exists. Please sign in.");
    return { shouldContinue: false };
  }

  if (!signUpResult.success) {
    setFormError(signUpResult.error || "Failed to create account");
    return { shouldContinue: false };
  }

  return { shouldContinue: true };
}

// Helper to handle signin and accept flow
async function handleSigninAndAccept(params: {
  email: string;
  password: string;
  invitationId: string;
  authMode: "signin" | "signup";
  setFormError: (error: string) => void;
  onSuccess: () => void;
}): Promise<void> {
  const { email, password, invitationId, authMode, setFormError, onSuccess } =
    params;

  const signInResult = await trySignIn(email, password);
  if (!signInResult.success) {
    const errorMsg =
      authMode === "signin"
        ? "Incorrect password. Please try again."
        : signInResult.error || "Failed to sign in";
    setFormError(errorMsg);
    return;
  }

  const acceptResult = await acceptInvitation(invitationId);
  if (!acceptResult.success) {
    setFormError(acceptResult.error || "Failed to accept invitation");
    return;
  }

  onSuccess();
}

// Component for logged-out users with sign-in/sign-up toggle
function AuthFormState({
  invitation,
  onSuccess,
}: {
  invitation: InvitationData;
  onSuccess: () => void;
}) {
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (authMode === "signup" && password.length < 8) {
      setFormError("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);

    try {
      if (authMode === "signup") {
        const { shouldContinue } = await handleSignupFlow(
          invitation.email,
          password,
          setAuthMode,
          setFormError
        );
        if (!shouldContinue) {
          setSubmitting(false);
          return;
        }
      }

      await handleSigninAndAccept({
        email: invitation.email,
        password,
        invitationId: invitation.id,
        authMode,
        setFormError,
        onSuccess,
      });
    } catch (error) {
      console.error("Failed to complete auth flow:", error);
      setFormError(
        error instanceof Error ? error.message : "Something went wrong"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAuthMode = () => {
    setAuthMode(authMode === "signin" ? "signup" : "signin");
    setFormError("");
    setPassword("");
  };

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
                authMode === "signin"
                  ? "Enter your password"
                  : "Create a password"
              }
              required
              type="password"
              value={password}
            />
            {authMode === "signup" && (
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
            {submitting && authMode === "signin" && "Signing in..."}
            {submitting && authMode === "signup" && "Creating account..."}
            {!submitting && authMode === "signin" && "Sign In & Join"}
            {!submitting && authMode === "signup" && "Create Account & Join"}
          </Button>
        </form>

        <p className="text-center text-muted-foreground text-sm">
          {authMode === "signup" ? (
            <>
              Already have an account?{" "}
              <button
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                onClick={toggleAuthMode}
                type="button"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Need an account?{" "}
              <button
                className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                onClick={toggleAuthMode}
                type="button"
              >
                Create one
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function computePageState(params: {
  inviteLoading: boolean;
  sessionPending: boolean;
  inviteError: InvitationError | null;
  invitation: InvitationData | null;
  sessionEmail: string | null | undefined;
  sessionUserName: string | null | undefined;
}): PageState {
  const {
    inviteLoading,
    sessionPending,
    inviteError,
    invitation,
    sessionEmail,
    sessionUserName,
  } = params;

  if (inviteLoading || sessionPending) {
    return "loading";
  }
  if (inviteError) {
    return "error";
  }
  if (!invitation) {
    return "not-found";
  }

  const isAnonymous =
    sessionUserName === "Anonymous" || sessionEmail?.startsWith("temp-");
  const isLoggedIn = sessionEmail && !isAnonymous;

  if (isLoggedIn) {
    const emailMatch =
      sessionEmail.toLowerCase() === invitation.email.toLowerCase();
    return emailMatch ? "logged-in-match" : "logged-in-mismatch";
  }

  return "logged-out";
}

export default function AcceptInvitePage() {
  const params = useParams();
  const router = useRouter();
  const inviteId = params.inviteId as string;

  const { data: session, isPending: sessionPending } = useSession();

  const [inviteLoading, setInviteLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [inviteError, setInviteError] = useState<InvitationError | null>(null);

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
        setInviteLoading(false);
      }
    }

    if (inviteId) {
      fetchInvitation();
    }
  }, [inviteId]);

  const pageState = useMemo(
    () =>
      computePageState({
        inviteLoading,
        sessionPending,
        inviteError,
        invitation,
        sessionEmail: session?.user?.email,
        sessionUserName: session?.user?.name,
      }),
    [inviteLoading, sessionPending, inviteError, invitation, session]
  );

  const handleSuccess = async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await authClient.getSession();
    refetchOrganizations();
    toast.success(`Welcome to ${invitation?.organizationName}!`);
    router.push("/workflows");
  };

  if (pageState === "loading") {
    return <LoadingState />;
  }

  if (pageState === "error" && inviteError) {
    return <ErrorState inviteError={inviteError} />;
  }

  if (pageState === "not-found" || !invitation) {
    return <NotFoundState />;
  }

  if (pageState === "logged-in-match") {
    return (
      <AcceptDirectState invitation={invitation} onSuccess={handleSuccess} />
    );
  }

  if (pageState === "logged-in-mismatch" && session?.user?.email) {
    return (
      <EmailMismatchState
        currentEmail={session.user.email}
        invitation={invitation}
      />
    );
  }

  return <AuthFormState invitation={invitation} onSuccess={handleSuccess} />;
}
