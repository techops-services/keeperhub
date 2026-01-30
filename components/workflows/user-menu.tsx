"use client";

import {
  Bookmark,
  Github,
  Key,
  LogOut,
  Moon,
  Plug,
  Settings,
  Sun,
  Users,
  Wallet,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  AuthDialog,
  isSingleProviderSignInInitiated,
} from "@/components/auth/dialog";
import { ApiKeysOverlay } from "@/components/overlays/api-keys-overlay";
import { IntegrationsOverlay } from "@/components/overlays/integrations-overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import { SettingsOverlay } from "@/components/overlays/settings-overlay";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
// start custom keeperhub code //
import { ManageOrgsModal } from "@/keeperhub/components/organization/manage-orgs-modal";
import { useOrganization } from "@/keeperhub/lib/hooks/use-organization";
import { AddressBookOverlay } from "@/keeperhub/components/overlays/address-book-overlay";
import { FeedbackOverlay } from "@/keeperhub/components/overlays/feedback-overlay";
import { WalletOverlay } from "@/keeperhub/components/overlays/wallet-overlay";
// end keeperhub code //
import { api } from "@/lib/api-client";
import { signOut, useSession } from "@/lib/auth-client";

export const UserMenu = () => {
  const { data: session, isPending } = useSession();
  const { theme, setTheme } = useTheme();
  const { open: openOverlay } = useOverlay();
  const [providerId, setProviderId] = useState<string | null>(null);
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  // start custom keeperhub code //
  const { organization } = useOrganization();
  // end keeperhub code //

  // Fetch provider info when session is available
  useEffect(() => {
    if (session?.user && !session.user.name?.startsWith("Anonymous")) {
      api.user
        .get()
        .then((user) => {
          setProviderId(user.providerId);
        })
        .catch(() => {
          setProviderId(null);
        });
    }
  }, [session?.user]);

  const handleLogout = async () => {
    await signOut();
    // Full page refresh to clear all React/jotai state
    window.location.href = "/";
  };

  // OAuth users can't edit their profile
  const isOAuthUser =
    providerId === "vercel" ||
    providerId === "github" ||
    providerId === "google";

  const getUserInitials = () => {
    if (session?.user?.name) {
      return session.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (session?.user?.email) {
      return session.user.email.slice(0, 2).toUpperCase();
    }
    return "U";
  };

  const signInInProgress = isSingleProviderSignInInitiated();

  // Check if user is anonymous
  // Better Auth anonymous plugin creates users with name "Anonymous" and temp- email
  const isAnonymousUser =
    !session?.user ||
    session.user.name === "Anonymous" ||
    session.user.email?.startsWith("temp-");

  // Check if user's email is verified
  const isEmailVerified = session?.user?.emailVerified === true;

  // Don't render anything while session is loading to prevent flash
  // BUT if sign-in is in progress, keep showing the AuthDialog with loading state
  if (isPending && !signInInProgress) {
    return (
      <div className="h-9 w-9" /> // Placeholder to maintain layout
    );
  }

  // Show Sign In button if user is anonymous, not logged in, or email not verified
  if (isAnonymousUser || !isEmailVerified) {
    return (
      <div className="flex items-center gap-2">
        <AuthDialog>
          <Button
            className="h-9 disabled:opacity-100 disabled:*:text-muted-foreground"
            size="sm"
            variant="default"
          >
            Sign In
          </Button>
        </AuthDialog>
      </div>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="relative h-9 w-9 rounded-full border p-0"
            variant="ghost"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage
                alt={session?.user?.name || ""}
                src={session?.user?.image || ""}
              />
              <AvatarFallback>{getUserInitials()}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="font-medium text-sm leading-none">
                {session?.user?.name || "User"}
              </p>
              <p className="text-muted-foreground text-xs leading-none">
                {session?.user?.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* start custom keeperhub code */}
          <div className="lg:hidden">
            <DropdownMenuItem onClick={() => setOrgModalOpen(true)}>
              <Users className="size-4" />
              <span className="truncate">
                {organization?.name ?? "Organization"}
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </div>
          <DropdownMenuItem onClick={() => openOverlay(FeedbackOverlay)}>
            <Github className="size-4" />
            <span>Report an issue</span>
          </DropdownMenuItem>
          {/* end keeperhub code */}
          {!isOAuthUser && (
            <DropdownMenuItem onClick={() => openOverlay(SettingsOverlay)}>
              <Settings className="size-4" />
              <span>Settings</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => openOverlay(IntegrationsOverlay)}>
            <Plug className="size-4" />
            <span>Connections</span>
          </DropdownMenuItem>
          {/* start custom keeperhub code */}
          <DropdownMenuItem onClick={() => openOverlay(ApiKeysOverlay)}>
            <Key className="size-4" />
            <span>API Keys</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openOverlay(WalletOverlay)}>
            <Wallet className="size-4" />
            <span>Wallet</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openOverlay(AddressBookOverlay)}>
            <Bookmark className="size-4" />
            <span>Address Book</span>
          </DropdownMenuItem>
          {/* end keeperhub code */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span>Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup onValueChange={setTheme} value={theme}>
                <DropdownMenuRadioItem value="light">
                  Light
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  System
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>
            <LogOut className="size-4" />
            <span>Logout</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ManageOrgsModal onOpenChange={setOrgModalOpen} open={orgModalOpen} />
    </>
  );
};
