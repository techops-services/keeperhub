"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { registerOrganizationRefetch } from "@/keeperhub/lib/refetch-organizations";
import { authClient } from "@/lib/auth-client";

export function useOrganization() {
  const {
    data: activeOrg,
    isPending,
    error,
    refetch,
  } = authClient.useActiveOrganization();
  const router = useRouter();

  // Register this hook's refetch callback so it can be triggered externally
  useEffect(
    () =>
      registerOrganizationRefetch(() => {
        console.log("[useOrganization] Refetching active organization...");
        refetch();
      }),
    [refetch]
  );

  const switchOrganization = async (orgId: string) => {
    await authClient.organization.setActive({ organizationId: orgId });
    router.refresh();
  };

  return {
    organization: activeOrg,
    isLoading: isPending,
    error,
    switchOrganization,
    refetch, // Keep exposing refetch for direct use
  };
}

export function useOrganizations() {
  const { data: orgs, isPending, refetch } = authClient.useListOrganizations();

  // Register this hook's refetch callback so it can be triggered externally
  useEffect(
    () =>
      registerOrganizationRefetch(() => {
        console.log("[useOrganizations] Refetching organization list...");
        refetch();
      }),
    [refetch]
  );

  return {
    organizations: orgs || [],
    isLoading: isPending,
    refetch, // Keep exposing refetch for direct use
  };
}

export function useActiveMember() {
  // Use useActiveOrganization to get member info from the organization context
  const { data: activeOrg, isPending } = authClient.useActiveOrganization();

  // Get the session to find current user's membership
  const { data: session } = authClient.useSession();

  // Find the current user's member record in the active organization
  const member = activeOrg?.members?.find(
    (m: { userId: string }) => m.userId === session?.user?.id
  );

  return {
    member: member || null,
    isLoading: isPending,
    role: member?.role as "owner" | "admin" | "member" | undefined,
    isOwner: member?.role === "owner",
    isAdmin: member?.role === "admin" || member?.role === "owner",
  };
}

export function usePermissions() {
  const checkPermission = async (resource: string, actions: string[]) => {
    try {
      const result = await authClient.organization.hasPermission({
        permissions: { [resource]: actions },
      });
      // Handle both data.success and direct success property
      const typedResult = result as {
        data?: { success?: boolean };
        success?: boolean;
      } | null;
      return typedResult?.data?.success || typedResult?.success;
    } catch (error) {
      console.error("Permission check failed:", error);
      return false;
    }
  };

  const checkLocalPermission = (
    role: "owner" | "admin" | "member",
    resource: string,
    actions: string[]
  ) =>
    authClient.organization.checkRolePermission({
      role,
      permissions: { [resource]: actions },
    });

  return {
    checkPermission,
    checkLocalPermission,
  };
}
