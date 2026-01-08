"use client";

import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function useOrganization() {
  const { data: activeOrg, isPending, error } = authClient.useActiveOrganization();
  const router = useRouter();

  const switchOrganization = async (orgId: string) => {
    await authClient.organization.setActive({ organizationId: orgId });
    router.refresh();
  };

  return {
    organization: activeOrg,
    isLoading: isPending,
    error,
    switchOrganization,
  };
}

export function useOrganizations() {
  const { data: orgs, isPending } = authClient.useListOrganizations();

  return {
    organizations: orgs || [],
    isLoading: isPending,
  };
}

export function useActiveMember() {
  // Use useActiveOrganization to get member info from the organization context
  const { data: activeOrg, isPending } = authClient.useActiveOrganization();

  // Get the session to find current user's membership
  const { data: session } = authClient.useSession();

  // Find the current user's member record in the active organization
  const member = activeOrg?.members?.find(
    (m: any) => m.userId === session?.user?.id
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
      return (result as any)?.data?.success || (result as any)?.success || false;
    } catch (error) {
      console.error("Permission check failed:", error);
      return false;
    }
  };

  const checkLocalPermission = (
    role: "owner" | "admin" | "member",
    resource: string,
    actions: string[]
  ) => {
    return authClient.organization.checkRolePermission({
      role,
      permissions: { [resource]: actions },
    });
  };

  return {
    checkPermission,
    checkLocalPermission,
  };
}
