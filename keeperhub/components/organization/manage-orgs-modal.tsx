"use client";

import {
  ArrowLeft,
  Check,
  LogOut,
  Mail,
  Pencil,
  Plus,
  Settings,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useActiveMember,
  useOrganization,
  useOrganizations,
} from "@/keeperhub/lib/hooks/use-organization";
import { refetchOrganizations } from "@/keeperhub/lib/refetch-organizations";
import { api } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

// Helper function to get status color based on invitation status
function getStatusColor(status: string): string {
  switch (status) {
    case "accepted":
      return "text-green-600";
    case "rejected":
    case "cancelled":
      return "text-red-600";
    case "expired":
      return "text-orange-600";
    default:
      return "text-muted-foreground";
  }
}

// Helper function to get status badge classes
function getStatusBadgeClasses(status: string): string {
  switch (status) {
    case "accepted":
      return "bg-green-100 text-green-700";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-700";
    case "expired":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-muted text-muted-foreground";
  }
}

// Component to render a received invitation item
type ReceivedInvitationItemProps = {
  invitation: {
    id: string;
    organizationId?: string;
    organizationName?: string;
    organization?: { name?: string };
    role?: string;
    status?: string;
    expiresAt?: Date | string;
    inviterId?: string;
    inviter?: { user?: { name?: string } };
  };
  processingInvite: string | null;
  onAccept: (invitationId: string) => void;
  onReject: (invitationId: string) => void;
};

function ReceivedInvitationItem({
  invitation,
  processingInvite,
  onAccept,
  onReject,
}: ReceivedInvitationItemProps) {
  const isExpired = invitation.expiresAt
    ? new Date(invitation.expiresAt) < new Date()
    : false;
  const isPending =
    (!invitation.status || invitation.status === "pending") && !isExpired;
  const displayStatus = isExpired ? "expired" : invitation.status || "pending";

  // Use organization name from enriched data or fallback
  const organizationName =
    invitation.organizationName ||
    invitation.organization?.name ||
    "Organization";

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="font-semibold">{organizationName}</h3>
        <p className="text-muted-foreground text-sm">Role: {invitation.role}</p>
        {invitation.inviter?.user?.name && (
          <p className="text-muted-foreground text-sm">
            Invited by: {invitation.inviter.user.name}
          </p>
        )}
      </div>
      {isPending ? (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={processingInvite === invitation.id}
            onClick={() => onAccept(invitation.id)}
          >
            {processingInvite === invitation.id ? "Accepting..." : "Accept"}
          </Button>
          <Button
            className="flex-1"
            disabled={processingInvite === invitation.id}
            onClick={() => onReject(invitation.id)}
            variant="outline"
          >
            {processingInvite === invitation.id ? "Rejecting..." : "Reject"}
          </Button>
        </div>
      ) : (
        <div
          className={`rounded-md px-3 py-2 text-center font-medium text-sm ${getStatusBadgeClasses(displayStatus)}`}
        >
          {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
        </div>
      )}
    </div>
  );
}

// Separate component to render sent invitation items
type SentInvitationItemProps = {
  invitation: {
    id: string;
    email: string;
    role?: string;
    status: string;
    expiresAt?: Date | string;
  };
  cancellingInvite: string | null;
  onCancel: (invitationId: string) => void;
  canManageInvitations: boolean;
};

function SentInvitationItem({
  invitation,
  cancellingInvite,
  onCancel,
  canManageInvitations,
}: SentInvitationItemProps) {
  const isExpired = invitation.expiresAt
    ? new Date(invitation.expiresAt) < new Date()
    : false;
  const statusDisplay =
    invitation.status === "pending" && isExpired
      ? "expired"
      : invitation.status;
  const statusColor = getStatusColor(statusDisplay);
  const canCancel =
    canManageInvitations && invitation.status === "pending" && !isExpired;

  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{invitation.email}</p>
        <p className="text-muted-foreground text-xs">
          Role: {invitation.role || "member"} •{" "}
          <span className={statusColor}>{statusDisplay}</span>
        </p>
      </div>
      {canCancel && (
        <Button
          disabled={cancellingInvite === invitation.id}
          onClick={() => onCancel(invitation.id)}
          size="sm"
          variant="ghost"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Cancel invitation</span>
        </Button>
      )}
    </div>
  );
}

type ManageOrgsModalProps = {
  triggerText?: string;
  defaultShowCreateForm?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex modal with multiple states - refactoring would split related logic
export function ManageOrgsModal({
  triggerText,
  defaultShowCreateForm = false,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: ManageOrgsModalProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Use external state if provided, otherwise use internal state
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = externalOnOpenChange || setInternalOpen;
  const [showCreateForm, setShowCreateForm] = useState(defaultShowCreateForm);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);

  // Track which org is being managed (null = list view, string = detail view)
  const [managedOrgId, setManagedOrgId] = useState<string | null>(null);

  const { organization, switchOrganization } = useOrganization();
  const { organizations } = useOrganizations();
  const { isOwner: isActiveOrgOwner, isAdmin: isActiveOrgAdmin } =
    useActiveMember();
  const router = useRouter();
  const { data: session } = authClient.useSession();

  // Get the managed organization object (for detail view)
  const managedOrg = managedOrgId
    ? organizations.find((org) => org.id === managedOrgId)
    : null;
  const managedOrgName = managedOrg?.name ?? "";

  // Determine if the managed org is the active session org
  const isManagedOrgActive = managedOrgId === organization?.id;

  // Create organization state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [orgSlugManuallyEdited, setOrgSlugManuallyEdited] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Organization name editing state (managed org detail view)
  const [isEditingOrgName, setIsEditingOrgName] = useState(false);
  const [editingOrgName, setEditingOrgName] = useState("");
  const [updatingOrgName, setUpdatingOrgName] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteId, setInviteId] = useState<string | null>(null);

  // Invitations state (received by current user)
  type Invitation = {
    id: string;
    organizationId?: string;
    organizationName?: string;
    organization?: { name?: string };
    role?: string;
    status?: string;
    expiresAt?: Date | string;
    inviterId?: string;
    inviter?: { user?: { name?: string } };
  };
  const [userInvitations, setUserInvitations] = useState<Invitation[]>([]);
  const [, setLoadingInvitations] = useState(false);
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  // Sent invitations state (invitations sent by org admins)
  type SentInvitation = {
    id: string;
    email: string;
    role?: string;
    status: string;
    expiresAt?: Date | string;
  };
  const [sentInvitations, setSentInvitations] = useState<SentInvitation[]>([]);
  const [, setLoadingSentInvitations] = useState(false);
  const [cancellingInvite, setCancellingInvite] = useState<string | null>(null);

  // Organization members state
  type Member = {
    id: string;
    userId: string;
    role: string;
    user: {
      name?: string;
      email?: string;
    };
  };
  const [members, setMembers] = useState<Member[]>([]);
  const [, setLoadingMembers] = useState(false);

  // Compute user's role in the managed org from fetched members
  const currentUserMember = members.find((m) => m.userId === session?.user?.id);
  const managedOrgRole = currentUserMember?.role as
    | "owner"
    | "admin"
    | "member"
    | undefined;
  const isOwner = isManagedOrgActive
    ? isActiveOrgOwner
    : managedOrgRole === "owner";
  const isAdmin = isManagedOrgActive
    ? isActiveOrgAdmin
    : managedOrgRole === "admin" || managedOrgRole === "owner";

  const fetchInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    try {
      const result = await authClient.organization.listUserInvitations();
      if (result.data) {
        const invitations = Array.isArray(result.data) ? result.data : [];

        // Fetch organization names for each invitation using our custom API
        const enrichedInvitations = await Promise.all(
          invitations.map(async (inv: Invitation) => {
            try {
              const response = await fetch(`/api/invitations/${inv.id}`);
              const data = await response.json();
              // Extract organization name from response (works for both OK and 410 responses)
              const extractedOrgName =
                data.invitation?.organizationName || data.organizationName;
              if (extractedOrgName) {
                return {
                  ...inv,
                  organizationName: extractedOrgName,
                };
              }
            } catch {
              // Ignore errors, just use the original invitation
            }
            return inv;
          })
        );

        setUserInvitations(enrichedInvitations);
      }
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
    } finally {
      setLoadingInvitations(false);
    }
  }, []);

  // Fetch sent invitations for the managed organization (for admins)
  const organizationId = managedOrgId;
  const fetchSentInvitations = useCallback(async () => {
    if (!organizationId) {
      return;
    }
    setLoadingSentInvitations(true);
    try {
      const result = await authClient.organization.listInvitations({
        query: { organizationId },
      });
      if (result.data) {
        const invitations = Array.isArray(result.data)
          ? result.data
          : [result.data];
        setSentInvitations(invitations.filter(Boolean) as SentInvitation[]);
      }
    } catch (error) {
      console.error("Failed to fetch sent invitations:", error);
      setSentInvitations([]);
    } finally {
      setLoadingSentInvitations(false);
    }
  }, [organizationId]);

  // Fetch organization members
  const fetchMembers = useCallback(async () => {
    if (!organizationId) {
      return;
    }
    setLoadingMembers(true);
    try {
      const result = await authClient.organization.listMembers({
        query: { organizationId },
      });
      if (result.data) {
        // API returns { members: [...], total: number }
        const data = result.data as { members?: Member[] } | Member[];
        const membersList = Array.isArray(data) ? data : data.members || [];
        setMembers(membersList.filter(Boolean) as Member[]);
      }
    } catch (error) {
      console.error("Failed to fetch members:", error);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  }, [organizationId]);

  // Fetch invitations when modal opens
  useEffect(() => {
    if (open) {
      fetchInvitations();
    }
  }, [open, fetchInvitations]);

  // Fetch org-specific data when managed org changes
  useEffect(() => {
    if (open && managedOrgId) {
      fetchSentInvitations();
      fetchMembers();
    }
  }, [open, managedOrgId, fetchSentInvitations, fetchMembers]);

  // Keep edit input in sync when switching orgs / name updates
  const lastManagedOrgIdForNameEditRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastManagedOrgIdForNameEditRef.current !== managedOrgId) {
      lastManagedOrgIdForNameEditRef.current = managedOrgId;
      setIsEditingOrgName(false);
    }

    if (!managedOrgId) {
      setEditingOrgName("");
      return;
    }

    if (isEditingOrgName) {
      return;
    }

    setEditingOrgName(managedOrgName);
  }, [managedOrgId, managedOrgName, isEditingOrgName]);

  // Reset managed org when modal closes
  useEffect(() => {
    if (!open) {
      setManagedOrgId(null);
      setShowInviteForm(false);
      setInviteId(null);
    }
  }, [open]);

  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    if (!orgSlugManuallyEdited) {
      setOrgSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    }
  };

  const handleOrgSlugChange = (value: string) => {
    setOrgSlug(value);
    setOrgSlugManuallyEdited(true);
  };

  const handleCreateOrg = async () => {
    if (!(orgName && orgSlug)) {
      return;
    }

    setCreateLoading(true);
    try {
      const { data, error } = await authClient.organization.create({
        name: orgName,
        slug: orgSlug,
      });

      if (error) {
        toast.error(error.message || "Failed to create organization");
        return;
      }

      const orgId = (data as { id: string } | null)?.id;
      if (orgId) {
        await authClient.organization.setActive({ organizationId: orgId });
        toast.success(`Organization "${orgName}" created`);
        setOrgName("");
        setOrgSlug("");
        setOrgSlugManuallyEdited(false);
        setShowCreateForm(false);
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!(inviteEmail && managedOrgId)) {
      return;
    }

    setInviteLoading(true);
    try {
      const { data, error } = await authClient.organization.inviteMember({
        email: inviteEmail,
        role: inviteRole,
        organizationId: managedOrgId,
      });

      if (error) {
        toast.error(error.message || "Failed to send invitation");
        return;
      }

      const invitationData = data as {
        id?: string;
        invitation?: { id?: string };
      } | null;
      const invitationId = invitationData?.id || invitationData?.invitation?.id;
      if (invitationId) {
        setInviteId(invitationId);
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        // Refresh sent invitations list
        fetchSentInvitations();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setCancellingInvite(invitationId);
    try {
      const { error } = await authClient.organization.cancelInvitation({
        invitationId,
      });

      if (error) {
        toast.error(error.message || "Failed to cancel invitation");
        return;
      }

      toast.success("Invitation cancelled");
      fetchSentInvitations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setCancellingInvite(null);
    }
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    setProcessingInvite(invitationId);
    try {
      const result = await authClient.organization.acceptInvitation({
        invitationId,
      });

      if (result.error) {
        toast.error(
          result.error.message ||
            result.error.code ||
            "Failed to accept invitation"
        );
        return;
      }

      toast.success("Invitation accepted! You are now a member.");
      // Remove accepted invitation from list immediately
      setUserInvitations((prev) =>
        prev.filter((inv) => inv.id !== invitationId)
      );
      // Refresh the organizations list so the new org appears in the dropdown
      refetchOrganizations();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleRejectInvitation = async (invitationId: string) => {
    setProcessingInvite(invitationId);
    try {
      const { error } = await authClient.organization.rejectInvitation({
        invitationId,
      });

      if (error) {
        toast.error(error.message || "Failed to reject invitation");
        return;
      }

      toast.success("Invitation rejected");
      fetchInvitations();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleLeaveOrg = async () => {
    if (!managedOrg) {
      return;
    }

    try {
      const { error } = await authClient.organization.leave({
        organizationId: managedOrg.id,
      });

      if (error) {
        toast.error(error.message || "Failed to leave organization");
        return;
      }

      toast.success(`Left ${managedOrg.name}`);
      setShowLeaveDialog(false);
      setManagedOrgId(null);

      // If we left the active org, switch to another org if available
      if (isManagedOrgActive) {
        const otherOrg = organizations.find((org) => org.id !== managedOrg.id);
        if (otherOrg) {
          await switchOrganization(otherOrg.id);
        }
      }

      refetchOrganizations();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDeleteOrg = async () => {
    if (!managedOrg) {
      return;
    }

    try {
      const { error } = await authClient.organization.delete({
        organizationId: managedOrg.id,
      });

      if (error) {
        toast.error(error.message || "Failed to delete organization");
        return;
      }

      toast.success(`Deleted ${managedOrg.name}`);
      setShowDeleteDialog(false);
      setManagedOrgId(null);

      // If we deleted the active org, switch to another org if available
      if (isManagedOrgActive) {
        const otherOrg = organizations.find((org) => org.id !== managedOrg.id);
        if (otherOrg) {
          await switchOrganization(otherOrg.id);
        }
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleUpdateOrgName = async () => {
    if (!(managedOrgId && managedOrg)) {
      return;
    }

    const nextName = editingOrgName.trim();

    if (!nextName) {
      toast.error("Organization name is required");
      return;
    }

    if (nextName === managedOrg.name) {
      setIsEditingOrgName(false);
      return;
    }

    setUpdatingOrgName(true);
    try {
      await api.organization.updateName(managedOrgId, { name: nextName });
      toast.success("Organization name updated");
      setIsEditingOrgName(false);
      refetchOrganizations();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update name");
    } finally {
      setUpdatingOrgName(false);
    }
  };

  return (
    <>
      <Dialog onOpenChange={setOpen} open={open}>
        {/* Only show trigger when not controlled externally */}
        {externalOpen === undefined && (
          <DialogTrigger asChild>
            {triggerText ? (
              <Button size="sm" variant="default">
                {triggerText}
              </Button>
            ) : (
              <Button size="sm" variant="ghost">
                <Settings className="h-4 w-4" />
              </Button>
            )}
          </DialogTrigger>
        )}
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Organizations</DialogTitle>
            <DialogDescription>
              Create organizations, manage invitations, and organize your team.
            </DialogDescription>
          </DialogHeader>

          <Tabs className="w-full" defaultValue="organizations">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="organizations">Organizations</TabsTrigger>
              <TabsTrigger value="invitations">
                Invitations
                {userInvitations && userInvitations.length > 0 && (
                  <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-primary-foreground text-xs">
                    {userInvitations.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent className="space-y-4" value="organizations">
              {/* LIST VIEW - Show when no org is being managed */}
              {!managedOrgId && (
                <>
                  {/* Create Organization Section */}
                  <div className="space-y-3 rounded-lg border p-4">
                    {showCreateForm ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="org-name">Organization Name</Label>
                          <Input
                            disabled={createLoading}
                            id="org-name"
                            onChange={(e) =>
                              handleOrgNameChange(e.target.value)
                            }
                            placeholder="Acme Inc."
                            value={orgName}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="org-slug">
                            Slug (URL identifier)
                          </Label>
                          <Input
                            disabled={createLoading}
                            id="org-slug"
                            onChange={(e) =>
                              handleOrgSlugChange(e.target.value)
                            }
                            placeholder="acme-inc"
                            value={orgSlug}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            className="flex-1"
                            disabled={createLoading}
                            onClick={() => {
                              setShowCreateForm(false);
                              setOrgName("");
                              setOrgSlug("");
                              setOrgSlugManuallyEdited(false);
                            }}
                            variant="outline"
                          >
                            Cancel
                          </Button>
                          <Button
                            className="flex-1"
                            disabled={createLoading || !orgName || !orgSlug}
                            onClick={handleCreateOrg}
                          >
                            {createLoading ? "Creating..." : "Create"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        className="w-full"
                        onClick={() => setShowCreateForm(true)}
                        variant="outline"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create New Organization
                      </Button>
                    )}
                  </div>

                  {/* Organizations List */}
                  {organizations.length > 0 ? (
                    <div className="space-y-2">
                      {organizations.map((org) => {
                        const isActive = org.id === organization?.id;
                        return (
                          <div
                            className="flex items-center justify-between rounded-lg border p-3"
                            key={org.id}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate font-medium text-sm">
                                  {org.name}
                                </p>
                                {isActive && (
                                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 text-xs">
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground text-xs capitalize">
                                {(org as { role?: string }).role || "Member"}
                              </p>
                            </div>
                            <Button
                              onClick={() => setManagedOrgId(org.id)}
                              size="sm"
                              variant="outline"
                            >
                              <Settings className="mr-2 h-3 w-3" />
                              Manage
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-muted-foreground text-sm">
                      No organizations yet. Create one to get started.
                    </div>
                  )}
                </>
              )}

              {/* DETAIL VIEW - Show when managing a specific org */}
              {managedOrgId && managedOrg && (
                <div className="space-y-4">
                  {/* Back Button */}
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setManagedOrgId(null);
                      setShowInviteForm(false);
                      setInviteId(null);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to organizations
                  </Button>

                  <div className="space-y-4 rounded-lg border p-4">
                    <div>
                      <div className="flex items-center gap-2">
                        {isEditingOrgName ? (
                          <>
                            <Input
                              aria-label="Organization name"
                              className="h-8 max-w-xs"
                              disabled={updatingOrgName}
                              onChange={(e) =>
                                setEditingOrgName(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleUpdateOrgName();
                                }
                                if (e.key === "Escape") {
                                  setIsEditingOrgName(false);
                                  setEditingOrgName(managedOrg.name);
                                }
                              }}
                              value={editingOrgName}
                            />
                            <Button
                              aria-label="Save organization name"
                              disabled={
                                updatingOrgName || !editingOrgName.trim()
                              }
                              onClick={handleUpdateOrgName}
                              size="icon"
                              variant="ghost"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              aria-label="Cancel editing organization name"
                              disabled={updatingOrgName}
                              onClick={() => {
                                setIsEditingOrgName(false);
                                setEditingOrgName(managedOrg.name);
                              }}
                              size="icon"
                              variant="ghost"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <h3 className="font-semibold text-lg">
                              {managedOrg.name}
                            </h3>
                            {isOwner && (
                              <Button
                                aria-label="Edit organization name"
                                disabled={updatingOrgName}
                                onClick={() => {
                                  setIsEditingOrgName(true);
                                  setEditingOrgName(managedOrg.name);
                                }}
                                size="icon"
                                variant="ghost"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                        {isManagedOrgActive && (
                          <span className="min-w-11 rounded-full bg-green-100 px-2 py-0.5 text-green-700 text-xs">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-sm">
                        {managedOrgRole || "Member"}
                      </p>
                    </div>

                    {/* Pending Invitations Section */}
                    {sentInvitations.filter((inv) => inv.status === "pending")
                      .length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-muted-foreground text-sm">
                          Pending Invitations
                        </h4>
                        <div className="space-y-2">
                          {sentInvitations
                            .filter((inv) => inv.status === "pending")
                            .map((invitation) => (
                              <SentInvitationItem
                                cancellingInvite={cancellingInvite}
                                canManageInvitations={isAdmin}
                                invitation={invitation}
                                key={invitation.id}
                                onCancel={handleCancelInvitation}
                              />
                            ))}
                        </div>
                      </div>
                    )}

                    {/* Members Section */}
                    {members.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-medium text-muted-foreground text-sm">
                          Members
                        </h4>
                        <div className="space-y-2">
                          {members.map((member, index) => (
                            <div
                              className="flex items-center justify-between rounded-lg border p-3"
                              key={member.id || `member-${index}`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-sm">
                                  {member.user?.email || "Unknown"}
                                </p>
                                <p className="text-muted-foreground text-xs">
                                  {member.role}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Invite Members Section */}
                    <div className="space-y-3">
                      {showInviteForm ? (
                        <div className="space-y-3">
                          <div className="space-y-2">
                            <Label htmlFor="invite-email">Email Address</Label>
                            <Input
                              disabled={inviteLoading}
                              id="invite-email"
                              onChange={(e) => {
                                setInviteEmail(e.target.value);
                                if (inviteId) {
                                  setInviteId(null);
                                }
                              }}
                              placeholder="colleague@example.com"
                              type="email"
                              value={inviteEmail}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="invite-role">Role</Label>
                            <Select
                              onValueChange={(v) =>
                                setInviteRole(v as "member" | "admin")
                              }
                              value={inviteRole}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="member">
                                  Member - Can create workflows
                                </SelectItem>
                                <SelectItem value="admin">
                                  Admin - Can manage members and wallets
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              className="flex-1"
                              disabled={inviteLoading}
                              onClick={() => {
                                setShowInviteForm(false);
                                setInviteEmail("");
                                setInviteId(null);
                              }}
                              variant="outline"
                            >
                              Close
                            </Button>
                            <Button
                              className="flex-1"
                              disabled={inviteLoading || !inviteEmail}
                              onClick={handleInviteMember}
                            >
                              <Mail className="mr-2 h-4 w-4" />
                              {inviteLoading ? "Sending..." : "Send Invitation"}
                            </Button>
                          </div>
                          {inviteId && (
                            <div className="rounded-md bg-green-50 px-3 py-2 text-center text-green-700 text-sm">
                              Invitation sent
                            </div>
                          )}
                        </div>
                      ) : (
                        <Button
                          className="w-full"
                          onClick={() => setShowInviteForm(true)}
                          variant="outline"
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Invite Members
                        </Button>
                      )}
                    </div>

                    {/* Leave/Delete Organization */}
                    <div className="space-y-2 border-t pt-3">
                      {isOwner ? (
                        <Button
                          className="w-full text-destructive hover:text-destructive"
                          onClick={() => setShowDeleteDialog(true)}
                          variant="outline"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Organization
                        </Button>
                      ) : (
                        <Button
                          className="w-full text-orange-600 hover:text-orange-700"
                          onClick={() => setShowLeaveDialog(true)}
                          variant="outline"
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          Leave Organization
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent className="space-y-4" value="invitations">
              {!userInvitations || userInvitations.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No invitations
                </div>
              ) : (
                <div className="space-y-3">
                  {userInvitations.map((invitation) => (
                    <ReceivedInvitationItem
                      invitation={invitation}
                      key={invitation.id}
                      onAccept={handleAcceptInvitation}
                      onReject={handleRejectInvitation}
                      processingInvite={processingInvite}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Leave Organization Dialog */}
      <AlertDialog onOpenChange={setShowLeaveDialog} open={showLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave {managedOrg?.name}? You will need a
              new invitation to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={handleLeaveOrg}
            >
              Leave Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Organization Dialog */}
      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {managedOrg?.name}? This action
              cannot be undone. All workflows, credentials, and data will be
              permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteOrg}
            >
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
