"use client";

import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api-client";
import { authClient, signIn, signUp } from "@/lib/auth-client";
import {
  getEnabledAuthProviders,
  getSingleProvider,
} from "@/lib/auth-providers";

type AuthDialogProps = {
  children?: ReactNode;
};

type ModalView = "signin" | "signup" | "request-access" | "request-success";

const VercelIcon = ({ className = "mr-2 h-3 w-3" }: { className?: string }) => (
  <svg
    aria-label="Vercel"
    className={className}
    fill="currentColor"
    role="img"
    viewBox="0 0 76 65"
  >
    <title>Vercel</title>
    <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
  </svg>
);

const GitHubIcon = () => (
  <svg
    aria-label="GitHub"
    className="mr-2 h-4 w-4"
    fill="currentColor"
    role="img"
    viewBox="0 0 24 24"
  >
    <title>GitHub</title>
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

const GoogleIcon = () => (
  <svg
    aria-label="Google"
    className="mr-2 h-4 w-4"
    role="img"
    viewBox="0 0 24 24"
  >
    <title>Google</title>
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="currentColor"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="currentColor"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="currentColor"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="currentColor"
    />
  </svg>
);

type Provider = "email" | "github" | "google" | "vercel";

const getProviderIcon = (provider: Provider, compact = false) => {
  const iconClass = compact ? "size-3.5" : undefined;
  switch (provider) {
    case "vercel":
      return <VercelIcon className={iconClass} />;
    case "github":
      return <GitHubIcon />;
    case "google":
      return <GoogleIcon />;
    default:
      return null;
  }
};

const getProviderLabel = (provider: Provider) => {
  switch (provider) {
    case "vercel":
      return "Vercel";
    case "github":
      return "GitHub";
    case "google":
      return "Google";
    default:
      return "Email";
  }
};

// Social buttons component
type SocialButtonsProps = {
  enabledProviders: { vercel: boolean; github: boolean; google: boolean };
  onSignIn: (provider: "github" | "google" | "vercel") => void;
  loadingProvider: "github" | "google" | "vercel" | null;
};

const SocialButtons = ({
  enabledProviders,
  onSignIn,
  loadingProvider,
}: SocialButtonsProps) => (
  <div className="flex flex-col gap-2">
    {enabledProviders.vercel && (
      <Button
        className="w-full"
        disabled={loadingProvider !== null}
        onClick={() => onSignIn("vercel")}
        type="button"
        variant="outline"
      >
        <VercelIcon />
        {loadingProvider === "vercel" ? "Loading..." : "Continue with Vercel"}
      </Button>
    )}
    {enabledProviders.github && (
      <Button
        className="w-full"
        disabled={loadingProvider !== null}
        onClick={() => onSignIn("github")}
        type="button"
        variant="outline"
      >
        <GitHubIcon />
        {loadingProvider === "github" ? "Loading..." : "Continue with GitHub"}
      </Button>
    )}
    {enabledProviders.google && (
      <Button
        className="w-full"
        disabled={loadingProvider !== null}
        onClick={() => onSignIn("google")}
        type="button"
        variant="outline"
      >
        <GoogleIcon />
        {loadingProvider === "google" ? "Loading..." : "Continue with Google"}
      </Button>
    )}
  </div>
);

// Sign In Form
type SignInFormProps = {
  email: string;
  password: string;
  error: string;
  loading: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCreateAccount: () => void;
};

const SignInForm = ({
  email,
  password,
  error,
  loading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onCreateAccount,
}: SignInFormProps) => (
  <div className="space-y-4">
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label className="ml-1" htmlFor="email">
          Email
        </Label>
        <Input
          id="email"
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </div>
      <div className="space-y-2">
        <Label className="ml-1" htmlFor="password">
          Password
        </Label>
        <Input
          id="password"
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="Enter your password"
          required
          type="password"
          value={password}
        />
      </div>
      {error && <div className="text-destructive text-sm">{error}</div>}
      <Button className="w-full" disabled={loading} type="submit">
        {loading ? <Spinner className="mr-2 size-4" /> : null}
        Sign in
      </Button>
    </form>
    <div className="flex items-center justify-center gap-1 text-sm">
      <span className="text-muted-foreground">New here?</span>
      <button
        className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
        onClick={onCreateAccount}
        type="button"
      >
        Create account
      </button>
    </div>
  </div>
);

// Request Access Form
type RequestAccessFormProps = {
  email: string;
  error: string;
  loading: boolean;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSignIn: () => void;
};

const RequestAccessForm = ({
  email,
  error,
  loading,
  onEmailChange,
  onSubmit,
  onSignIn,
}: RequestAccessFormProps) => (
  <div className="space-y-4">
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label className="ml-1" htmlFor="request-email">
          Email
        </Label>
        <Input
          id="request-email"
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="you@example.com"
          required
          type="email"
          value={email}
        />
      </div>
      {error && <div className="text-destructive text-sm">{error}</div>}
      <Button className="w-full" disabled={loading} type="submit">
        {loading ? <Spinner className="mr-2 size-4" /> : null}
        Request access
      </Button>
    </form>
    <div className="flex items-center justify-center gap-1 text-sm">
      <span className="text-muted-foreground">Already have an account?</span>
      <button
        className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
        onClick={onSignIn}
        type="button"
      >
        Sign in
      </button>
    </div>
  </div>
);

// Request Success View
type RequestSuccessProps = {
  email: string;
  onClose: () => void;
  onSignIn: () => void;
};

const RequestSuccessView = ({
  email,
  onClose,
  onSignIn,
}: RequestSuccessProps) => (
  <div className="space-y-6 py-4 text-center">
    <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
      <svg
        aria-label="Success"
        className="size-6 text-green-600 dark:text-green-400"
        fill="none"
        role="img"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <title>Success</title>
        <path
          d="M5 13l4 4L19 7"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
        />
      </svg>
    </div>
    <div className="space-y-2">
      <h3 className="font-semibold text-lg">Request submitted</h3>
      <p className="text-muted-foreground text-sm">
        Thanks for your interest. We will email you at{" "}
        <span className="font-medium text-foreground">{email}</span> when your
        account is ready.
      </p>
    </div>
    <div className="flex flex-col gap-2">
      <Button className="w-full" onClick={onClose}>
        Close
      </Button>
      <Button className="w-full" onClick={onSignIn} variant="ghost">
        Back to sign in
      </Button>
    </div>
  </div>
);

// Single provider button
let singleProviderSignInInitiated = false;
export const isSingleProviderSignInInitiated = () =>
  singleProviderSignInInitiated;

type SingleProviderButtonProps = {
  provider: Provider;
  loadingProvider: "github" | "google" | "vercel" | null;
  onSignIn: (provider: "github" | "google" | "vercel") => Promise<void>;
};

const SingleProviderButton = ({
  provider,
  loadingProvider,
  onSignIn,
}: SingleProviderButtonProps) => {
  const [isInitiated, setIsInitiated] = useState(singleProviderSignInInitiated);
  const isLoading = loadingProvider === provider || isInitiated;

  const handleClick = () => {
    singleProviderSignInInitiated = true;
    setIsInitiated(true);
    onSignIn(provider as "github" | "google" | "vercel");
  };

  return (
    <Button
      className="h-9 gap-1.5 px-2 disabled:opacity-100 sm:px-3"
      disabled={isLoading}
      onClick={handleClick}
      size="sm"
      variant="default"
    >
      {isLoading ? (
        <Spinner className="size-3.5" />
      ) : (
        getProviderIcon(provider, true)
      )}
      <span className="text-sm">Sign In</span>
    </Button>
  );
};

// Helper functions
const getViewTitle = (view: ModalView) => {
  switch (view) {
    case "signin":
      return "Sign in";
    case "signup":
      return "Create account";
    case "request-access":
      return "Request access";
    default:
      return "Request submitted";
  }
};

const getViewDescription = (view: ModalView) => {
  switch (view) {
    case "signin":
      return "Sign in with an email that has been approved for the beta.";
    case "signup":
      return "Create your account to get started.";
    case "request-access":
      return "We are in closed beta. Enter your email and we will notify you when you can sign up.";
    default:
      return null;
  }
};

export const AuthDialog = ({ children }: AuthDialogProps) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<ModalView>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<
    "github" | "google" | "vercel" | null
  >(null);

  const enabledProviders = getEnabledAuthProviders();
  const singleProvider = getSingleProvider();
  const hasSocialProviders =
    enabledProviders.vercel ||
    enabledProviders.github ||
    enabledProviders.google;

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setRequestEmail("");
    setError("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setTimeout(() => {
        setView("signin");
        resetForm();
      }, 200);
    }
  };

  const handleSocialSignIn = async (
    provider: "github" | "google" | "vercel"
  ) => {
    try {
      setLoadingProvider(provider);
      await signIn.social({ provider, callbackURL: window.location.pathname });
    } catch {
      toast.error(`Failed to sign in with ${getProviderLabel(provider)}`);
      setLoadingProvider(null);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await signIn.email({ email, password });
      if (response.error) {
        setError(response.error.message || "Sign in failed");
        return;
      }
      toast.success("Signed in successfully!");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCheckEmailAndSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const timestamp = new Date().toISOString();

    try {

      const { isAllowlisted } = await api.beta.checkEmail(email);
      if (!isAllowlisted) {
        setError(
          "This app is currently in closed beta. This email has not been approved yet."
        );
        setLoading(false);
        return;
      }

      const signUpResponse = await signUp.email({
        email,
        password,
        name: email.split("@")[0],
      });

      if (signUpResponse.error) {
        setError(signUpResponse.error.message || "Sign up failed");
        return;
      }

      const signInResponse = await signIn.email({ email, password });

      if (signInResponse.error) {
        setError(signInResponse.error.message || "Sign in failed");
        return;
      }

      // Fetch fresh session to see if org is there
      const session = await authClient.getSession();

      toast.success("Account created successfully!");
      setOpen(false);

      // // Force page refresh to reload org context
      window.location.reload();
    } catch (err) {
      console.error(`[Signup Dialog] ${timestamp} Error:`, err);
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.beta.requestAccess(requestEmail);
      setView("request-success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  if (singleProvider && singleProvider !== "email") {
    return (
      <SingleProviderButton
        loadingProvider={loadingProvider}
        onSignIn={handleSocialSignIn}
        provider={singleProvider}
      />
    );
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="default">
            Sign In
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        {view !== "request-success" && (
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>{getViewTitle(view)}</DialogTitle>
              <Badge
                className="rounded-full bg-muted/50 px-2 py-0.5 font-normal text-xs"
                variant="secondary"
              >
                Private beta
              </Badge>
            </div>
            {getViewDescription(view) && (
              <DialogDescription>{getViewDescription(view)}</DialogDescription>
            )}
          </DialogHeader>
        )}

        <div className="space-y-4">
          {view === "signin" && (
            <>
              {hasSocialProviders && enabledProviders.email && (
                <>
                  <SocialButtons
                    enabledProviders={enabledProviders}
                    loadingProvider={loadingProvider}
                    onSignIn={handleSocialSignIn}
                  />
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or continue with email
                      </span>
                    </div>
                  </div>
                </>
              )}
              {hasSocialProviders && !enabledProviders.email && (
                <SocialButtons
                  enabledProviders={enabledProviders}
                  loadingProvider={loadingProvider}
                  onSignIn={handleSocialSignIn}
                />
              )}
              {enabledProviders.email && (
                <SignInForm
                  email={email}
                  error={error}
                  loading={loading}
                  onCreateAccount={() => {
                    setView("signup");
                    setError("");
                  }}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onSubmit={handleSignIn}
                  password={password}
                />
              )}
            </>
          )}

          {view === "signup" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-1 rounded-lg border bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">Not approved yet?</span>
                <button
                  className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
                  onClick={() => {
                    setView("request-access");
                    setError("");
                  }}
                  type="button"
                >
                  Request access
                </button>
              </div>
              <form className="space-y-4" onSubmit={handleCheckEmailAndSignUp}>
                <div className="space-y-2">
                  <Label className="ml-1" htmlFor="signup-email">
                    Email
                  </Label>
                  <Input
                    id="signup-email"
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    type="email"
                    value={email}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="ml-1" htmlFor="signup-password">
                    Password
                  </Label>
                  <Input
                    id="signup-password"
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    required
                    type="password"
                    value={password}
                  />
                </div>
                {error && (
                  <div className="text-destructive text-sm">{error}</div>
                )}
                <Button className="w-full" disabled={loading} type="submit">
                  {loading ? <Spinner className="mr-2 size-4" /> : null}
                  Create account
                </Button>
              </form>
              <div className="flex items-center justify-center gap-1 text-sm">
                <span className="text-muted-foreground">
                  Already have an account?
                </span>
                <button
                  className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
                  onClick={() => {
                    setView("signin");
                    setError("");
                  }}
                  type="button"
                >
                  Sign in
                </button>
              </div>
            </div>
          )}

          {view === "request-access" && (
            <RequestAccessForm
              email={requestEmail}
              error={error}
              loading={loading}
              onEmailChange={setRequestEmail}
              onSignIn={() => {
                setView("signin");
                setError("");
              }}
              onSubmit={handleRequestAccess}
            />
          )}

          {view === "request-success" && (
            <RequestSuccessView
              email={requestEmail}
              onClose={() => setOpen(false)}
              onSignIn={() => {
                setView("signin");
                setRequestEmail("");
              }}
            />
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
};
