"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface Member {
  id: string;
  user: {
    name: string;
    email: string;
    image?: string;
  };
  role: string;
  createdAt: Date;
}

interface MembersListProps {
  members: Member[];
  onUpdate: () => void;
}

export function MembersList({ members, onUpdate }: MembersListProps) {
  const { isAdmin, member: currentMember } = useActiveMember();
  const [updating, setUpdating] = useState<string | null>(null);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    setUpdating(memberId);
    try {
      await authClient.organization.updateMemberRole({
        memberId,
        role: newRole,
      });
      onUpdate();
    } catch (error) {
      console.error("Failed to update role:", error);
    } finally {
      setUpdating(null);
    }
  };

  const handleRemove = async (memberId: string, email: string) => {
    try {
      await authClient.organization.removeMember({
        memberIdOrEmail: email,
      });
      onUpdate();
    } catch (error) {
      console.error("Failed to remove member:", error);
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-sm text-muted-foreground">
        Only admins and owners can manage members.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Joined</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                {member.user.image && (
                  <img
                    src={member.user.image}
                    alt={member.user.name}
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <div>
                  <div className="font-medium">{member.user.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {member.user.email}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Select
                value={member.role}
                onValueChange={(role) => handleRoleChange(member.id, role)}
                disabled={
                  !isAdmin ||
                  member.id === currentMember?.id ||
                  updating === member.id
                }
              >
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="owner">Owner</SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell>
              {new Date(member.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-right">
              {member.id !== currentMember?.id && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Member</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to remove {member.user.name} from
                        this organization? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRemove(member.id, member.user.email)}
                        className="bg-destructive text-destructive-foreground"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
