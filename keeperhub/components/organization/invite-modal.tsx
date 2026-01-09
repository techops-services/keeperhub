"use client";

import { Copy, Mail, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { authClient } from "@/lib/auth-client";

export function InviteModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [loading, setLoading] = useState(false);
  const [inviteId, setInviteId] = useState<string | null>(null);

  const handleInvite = async () => {
    setLoading(true);
    try {
      const { data, error } = await authClient.organization.inviteMember({
        email,
        role,
      });

      if (error) {
        toast.error(error.message || "Failed to send invitation");
        return;
      }

      // Type-safe handling of invitation ID
      const invitationData = data as {
        id?: string;
        invitation?: { id?: string };
      } | null;
      const invitationId = invitationData?.id || invitationData?.invitation?.id;
      if (invitationId) {
        setInviteId(invitationId);
        toast.success(`Invitation sent to ${email}`);
        setEmail("");
      } else {
        toast.error("Invitation created but ID not returned");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const copyInviteLink = () => {
    if (!inviteId) {
      return;
    }
    const link = `${window.location.origin}/accept-invite/${inviteId}`;
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard");
  };

  const copyInviteCode = () => {
    if (!inviteId) {
      return;
    }
    navigator.clipboard.writeText(inviteId);
    toast.success("Invite code copied to clipboard");
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Send an invitation to join this organization.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              disabled={loading}
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              type="email"
              value={email}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              onValueChange={(v) => setRole(v as "member" | "admin")}
              value={role}
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
            <div className="space-y-2 rounded-lg border bg-muted p-4">
              <p className="font-medium text-sm">Invitation Created</p>
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
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)} variant="outline">
            Close
          </Button>
          <Button disabled={loading || !email} onClick={handleInvite}>
            <Mail className="mr-2 h-4 w-4" />
            {loading ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
