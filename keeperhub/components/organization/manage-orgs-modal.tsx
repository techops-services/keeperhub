"use client";

import {
  Copy,
  LogOut,
  Mail,
  Plus,
  Settings,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
import { authClient } from "@/lib/auth-client";

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

  const { organization, switchOrganization } = useOrganization();
  const { organizations } = useOrganizations();
  const { isOwner } = useActiveMember();
  const router = useRouter();

  // Create organization state
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteId, setInviteId] = useState<string | null>(null);

  // Invitations state
  type Invitation = {
    id: string;
    organization?: { name?: string };
    role?: string;
    expiresAt?: Date | string;
    inviter?: { user?: { name?: string } };
  };
  const [userInvitations, setUserInvitations] = useState<Invitation[]>([]);
  const [, setLoadingInvitations] = useState(false);
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    setLoadingInvitations(true);
    try {
      const result = await authClient.organization.listUserInvitations();
      if (result.data) {
        setUserInvitations(Array.isArray(result.data) ? result.data : []);
      }
    } catch (error) {
      console.error("Failed to fetch invitations:", error);
    } finally {
      setLoadingInvitations(false);
    }
  }, []);

  // Fetch invitations when modal opens
  useEffect(() => {
    if (open) {
      fetchInvitations();
    }
  }, [open, fetchInvitations]);

  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    if (!orgSlug) {
      setOrgSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    }
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
    if (!inviteEmail) {
      return;
    }

    setInviteLoading(true);
    try {
      const { data, error } = await authClient.organization.inviteMember({
        email: inviteEmail,
        role: inviteRole,
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
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!inviteId) {
      return;
    }
    const link = `${window.location.origin}/accept-invite/${inviteId}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };

  const copyInviteCode = () => {
    if (!inviteId) {
      return;
    }
    navigator.clipboard.writeText(inviteId);
    toast.success("Invite code copied");
  };

  const handleAcceptInvitation = async (invitationId: string) => {
    setProcessingInvite(invitationId);
    try {
      const { error } = await authClient.organization.acceptInvitation({
        invitationId,
      });

      if (error) {
        toast.error(error.message || "Failed to accept invitation");
        return;
      }

      toast.success("Invitation accepted");
      fetchInvitations();
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
    if (!organization) {
      return;
    }

    try {
      const { error } = await authClient.organization.leave({
        organizationId: organization.id,
      });

      if (error) {
        toast.error(error.message || "Failed to leave organization");
        return;
      }

      toast.success(`Left ${organization.name}`);
      setShowLeaveDialog(false);
      setOpen(false);

      // Switch to another org if available
      const otherOrg = organizations.find((org) => org.id !== organization.id);
      if (otherOrg) {
        await switchOrganization(otherOrg.id);
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDeleteOrg = async () => {
    if (!organization) {
      return;
    }

    try {
      const { error } = await authClient.organization.delete({
        organizationId: organization.id,
      });

      if (error) {
        toast.error(error.message || "Failed to delete organization");
        return;
      }

      toast.success(`Deleted ${organization.name}`);
      setShowDeleteDialog(false);
      setOpen(false);

      // Switch to another org if available
      const otherOrg = organizations.find((org) => org.id !== organization.id);
      if (otherOrg) {
        await switchOrganization(otherOrg.id);
      }

      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
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
              {/* Create Organization Section */}
              <div className="space-y-3 rounded-lg border p-4">
                {showCreateForm ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        disabled={createLoading}
                        id="org-name"
                        onChange={(e) => handleOrgNameChange(e.target.value)}
                        placeholder="Acme Inc."
                        value={orgName}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-slug">Slug (URL identifier)</Label>
                      <Input
                        disabled={createLoading}
                        id="org-slug"
                        onChange={(e) => setOrgSlug(e.target.value)}
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

              {/* Current Organization Section */}
              {organization && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {organization.name}
                    </h3>
                    <p className="text-muted-foreground text-sm">
                      {isOwner ? "Owner" : "Member"}
                    </p>
                  </div>

                  {/* Invite Members Section */}
                  <div className="space-y-3">
                    {showInviteForm ? (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="invite-email">Email Address</Label>
                          <Input
                            disabled={inviteLoading}
                            id="invite-email"
                            onChange={(e) => setInviteEmail(e.target.value)}
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
                        {inviteId && (
                          <div className="space-y-2 rounded-lg border bg-muted p-3">
                            <p className="font-medium text-sm">
                              Invitation Created
                            </p>
                            <div className="flex gap-2">
                              <Button
                                className="flex-1"
                                onClick={copyInviteLink}
                                size="sm"
                                variant="outline"
                              >
                                <Copy className="mr-2 h-3 w-3" />
                                Copy Link
                              </Button>
                              <Button
                                className="flex-1"
                                onClick={copyInviteCode}
                                size="sm"
                                variant="outline"
                              >
                                <Copy className="mr-2 h-3 w-3" />
                                Copy Code
                              </Button>
                            </div>
                          </div>
                        )}
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
                            Cancel
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
              )}
            </TabsContent>

            <TabsContent className="space-y-4" value="invitations">
              {!userInvitations || userInvitations.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  No pending invitations
                </div>
              ) : (
                <div className="space-y-3">
                  {userInvitations.map((invitation) => (
                    <div
                      className="space-y-3 rounded-lg border p-4"
                      key={invitation.id}
                    >
                      <div>
                        <h3 className="font-semibold">
                          {invitation.organization?.name || "Organization"}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                          Role: {invitation.role}
                        </p>
                        {invitation.inviter?.user?.name && (
                          <p className="text-muted-foreground text-sm">
                            Invited by: {invitation.inviter.user.name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          disabled={processingInvite === invitation.id}
                          onClick={() => handleAcceptInvitation(invitation.id)}
                        >
                          {processingInvite === invitation.id
                            ? "Accepting..."
                            : "Accept"}
                        </Button>
                        <Button
                          className="flex-1"
                          disabled={processingInvite === invitation.id}
                          onClick={() => handleRejectInvitation(invitation.id)}
                          variant="outline"
                        >
                          {processingInvite === invitation.id
                            ? "Rejecting..."
                            : "Reject"}
                        </Button>
                      </div>
                    </div>
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
              Are you sure you want to leave {organization?.name}? You will need
              a new invitation to rejoin.
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
              Are you sure you want to delete {organization?.name}? This action
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
