"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { useOrganization, useOrganizations, useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Settings, Plus, Mail, LogOut, Trash2, UserPlus, Copy } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export function ManageOrgsModal() {
  const [open, setOpen] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
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
  const [userInvitations, setUserInvitations] = useState<any[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  const fetchInvitations = async () => {
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
  };

  // Fetch invitations when modal opens
  useEffect(() => {
    if (open) {
      fetchInvitations();
    }
  }, [open]);

  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    if (!orgSlug) {
      setOrgSlug(value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
    }
  };

  const handleCreateOrg = async () => {
    if (!orgName || !orgSlug) return;

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

      const orgId = (data as any)?.id;
      if (orgId) {
        await authClient.organization.setActive({ organizationId: orgId });
        toast.success(`Organization "${orgName}" created`);
        setOrgName("");
        setOrgSlug("");
        setShowCreateForm(false);
        router.refresh();
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!inviteEmail) return;

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

      const invitationId = (data as any)?.id || (data as any)?.invitation?.id;
      if (invitationId) {
        setInviteId(invitationId);
        toast.success(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setInviteLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!inviteId) return;
    const link = `${window.location.origin}/accept-invite/${inviteId}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied");
  };

  const copyInviteCode = () => {
    if (!inviteId) return;
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
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
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
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setProcessingInvite(null);
    }
  };

  const handleLeaveOrg = async () => {
    if (!organization) return;

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
      const otherOrg = organizations.find(org => org.id !== organization.id);
      if (otherOrg) {
        await switchOrganization(otherOrg.id);
      }

      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  const handleDeleteOrg = async () => {
    if (!organization) return;

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
      const otherOrg = organizations.find(org => org.id !== organization.id);
      if (otherOrg) {
        await switchOrganization(otherOrg.id);
      }

      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Organizations</DialogTitle>
            <DialogDescription>
              Create organizations, manage invitations, and organize your team.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="organizations" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="organizations">Organizations</TabsTrigger>
              <TabsTrigger value="invitations">
                Invitations
                {userInvitations && userInvitations.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                    {userInvitations.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="organizations" className="space-y-4">
              {/* Create Organization Section */}
              <div className="border rounded-lg p-4 space-y-3">
                {!showCreateForm ? (
                  <Button
                    onClick={() => setShowCreateForm(true)}
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Organization
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="org-name">Organization Name</Label>
                      <Input
                        id="org-name"
                        value={orgName}
                        onChange={(e) => handleOrgNameChange(e.target.value)}
                        placeholder="Acme Inc."
                        disabled={createLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="org-slug">Slug (URL identifier)</Label>
                      <Input
                        id="org-slug"
                        value={orgSlug}
                        onChange={(e) => setOrgSlug(e.target.value)}
                        placeholder="acme-inc"
                        disabled={createLoading}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          setShowCreateForm(false);
                          setOrgName("");
                          setOrgSlug("");
                        }}
                        variant="outline"
                        className="flex-1"
                        disabled={createLoading}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleCreateOrg}
                        className="flex-1"
                        disabled={createLoading || !orgName || !orgSlug}
                      >
                        {createLoading ? "Creating..." : "Create"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Current Organization Section */}
              {organization && (
                <div className="border rounded-lg p-4 space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{organization.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {isOwner ? "Owner" : "Member"}
                    </p>
                  </div>

                  {/* Invite Members Section */}
                  <div className="space-y-3">
                    {!showInviteForm ? (
                      <Button
                        onClick={() => setShowInviteForm(true)}
                        variant="outline"
                        className="w-full"
                      >
                        <UserPlus className="mr-2 h-4 w-4" />
                        Invite Members
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label htmlFor="invite-email">Email Address</Label>
                          <Input
                            id="invite-email"
                            type="email"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            placeholder="colleague@example.com"
                            disabled={inviteLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="invite-role">Role</Label>
                          <Select
                            value={inviteRole}
                            onValueChange={(v: any) => setInviteRole(v)}
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
                          <div className="space-y-2 p-3 border rounded-lg bg-muted">
                            <p className="text-sm font-medium">Invitation Created</p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={copyInviteLink}
                                className="flex-1"
                              >
                                <Copy className="mr-2 h-3 w-3" />
                                Copy Link
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={copyInviteCode}
                                className="flex-1"
                              >
                                <Copy className="mr-2 h-3 w-3" />
                                Copy Code
                              </Button>
                            </div>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button
                            onClick={() => {
                              setShowInviteForm(false);
                              setInviteEmail("");
                              setInviteId(null);
                            }}
                            variant="outline"
                            className="flex-1"
                            disabled={inviteLoading}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={handleInviteMember}
                            className="flex-1"
                            disabled={inviteLoading || !inviteEmail}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            {inviteLoading ? "Sending..." : "Send Invitation"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Leave/Delete Organization */}
                  <div className="pt-3 border-t space-y-2">
                    {!isOwner ? (
                      <Button
                        onClick={() => setShowLeaveDialog(true)}
                        variant="outline"
                        className="w-full text-orange-600 hover:text-orange-700"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Leave Organization
                      </Button>
                    ) : (
                      <Button
                        onClick={() => setShowDeleteDialog(true)}
                        variant="outline"
                        className="w-full text-destructive hover:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Organization
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="invitations" className="space-y-4">
              {!userInvitations || userInvitations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending invitations
                </div>
              ) : (
                <div className="space-y-3">
                  {userInvitations.map((invitation: any) => (
                    <div
                      key={invitation.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div>
                        <h3 className="font-semibold">
                          {invitation.organization?.name || "Organization"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Role: {invitation.role}
                        </p>
                        {invitation.inviter?.user?.name && (
                          <p className="text-sm text-muted-foreground">
                            Invited by: {invitation.inviter.user.name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleAcceptInvitation(invitation.id)}
                          className="flex-1"
                          disabled={processingInvite === invitation.id}
                        >
                          {processingInvite === invitation.id
                            ? "Accepting..."
                            : "Accept"}
                        </Button>
                        <Button
                          onClick={() => handleRejectInvitation(invitation.id)}
                          variant="outline"
                          className="flex-1"
                          disabled={processingInvite === invitation.id}
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
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
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
              onClick={handleLeaveOrg}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Leave Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Organization Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
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
              onClick={handleDeleteOrg}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
