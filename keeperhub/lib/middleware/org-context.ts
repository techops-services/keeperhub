import { headers } from "next/headers";
import { auth } from "@/lib/auth";
// start custom keeperhub code //
import { ensureUserHasOrganization } from "@/keeperhub/lib/auto-create-org";
// end keeperhub code //

type User = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

type Organization = {
  id: string;
  name: string;
  slug?: string | null;
  logo?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: Date;
};

type Member = {
  id: string;
  organizationId: string;
  userId: string;
  role: string;
  createdAt: Date;
};

export type OrgContext = {
  user: User | null;
  organization: Organization | null;
  member: Member | null;
  isAnonymous: boolean;
  needsOrganization: boolean;
};

export async function getOrgContext(): Promise<OrgContext> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return {
      user: null,
      organization: null,
      member: null,
      isAnonymous: true,
      needsOrganization: false,
    };
  }

  const activeOrgId = session.session.activeOrganizationId;

  if (!activeOrgId) {
    // start custom keeperhub code //
    // Authenticated user without active organization - auto-create one
    try {
      const { organizationId } = await ensureUserHasOrganization(
        session.user.id,
        session.user.email,
        session.user.name,
        session.session.id
      );

      // Re-fetch the organization and member data after auto-creation
      const orgData = await auth.api.getFullOrganization({
        headers: await headers(),
        query: { organizationId },
      });

      const activeMember = await auth.api.getActiveMember({
        headers: await headers(),
      });

      const organizationData = orgData
        ? {
            id: orgData.id,
            name: orgData.name,
            slug: orgData.slug,
            logo: orgData.logo,
            metadata: orgData.metadata,
            createdAt: orgData.createdAt,
          }
        : null;

      return {
        user: session.user,
        organization: organizationData,
        member: activeMember || null,
        isAnonymous: false,
        needsOrganization: !orgData,
      };
    } catch (error) {
      console.error("[Auto-Create] Failed in getOrgContext:", error);
      // Fall back to needsOrganization state if auto-create fails
      return {
        user: session.user,
        organization: null,
        member: null,
        isAnonymous: false,
        needsOrganization: true,
      };
    }
    // end keeperhub code //
  }

  // Get full organization details
  const orgData = await auth.api.getFullOrganization({
    headers: await headers(),
    query: { organizationId: activeOrgId },
  });

  const activeMember = await auth.api.getActiveMember({
    headers: await headers(),
  });

  // Extract organization data from response (getFullOrganization returns org data merged with members/invitations)
  const organizationData = orgData
    ? {
        id: orgData.id,
        name: orgData.name,
        slug: orgData.slug,
        logo: orgData.logo,
        metadata: orgData.metadata,
        createdAt: orgData.createdAt,
      }
    : null;

  return {
    user: session.user,
    organization: organizationData,
    member: activeMember || null,
    isAnonymous: false,
    needsOrganization: !orgData,
  };
}

// Permission helper
export async function hasPermission(
  resource: string,
  actions: string[]
): Promise<boolean> {
  const result = await auth.api.hasPermission({
    headers: await headers(),
    body: {
      permissions: {
        [resource]: actions,
      },
    },
  });

  return result?.success;
}
