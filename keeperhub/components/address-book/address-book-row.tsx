"use client";

import { Copy, Edit, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { TableCell, TableRow } from "@/components/ui/table";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
import type { AddressBookEntry } from "@/lib/api-client";
import { addressBookApi } from "@/lib/api-client";

type AddressBookRowProps = {
  entry: AddressBookEntry;
  onUpdate: () => void;
  onDelete: (entryId: string) => void;
  deleting: string | null;
};

export function AddressBookRow({
  entry,
  onUpdate,
  onDelete,
  deleting,
}: AddressBookRowProps) {
  const { isOwner } = useActiveMember();
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(entry.label);
  const [editAddress, setEditAddress] = useState(entry.address);
  const [saving, setSaving] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleSave = async () => {
    if (!editLabel.trim()) {
      toast.error("Label cannot be empty");
      return;
    }

    setSaving(true);
    try {
      await addressBookApi.update(entry.id, {
        label: editLabel.trim(),
        address: editAddress !== entry.address ? editAddress : undefined,
      });
      toast.success("Address book entry updated");
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Failed to update entry:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update entry"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditLabel(entry.label);
    setEditAddress(entry.address);
  };

  if (isEditing) {
    return (
      <TableRow>
        <TableCell colSpan={isOwner ? 3 : 2}>
          <div className="space-y-2">
            <Input
              disabled={saving}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="Label"
              value={editLabel}
            />
            <Input
              disabled={saving}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="0x..."
              value={editAddress}
            />
            <div className="flex gap-2">
              <Button disabled={saving} onClick={handleSave} size="sm">
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button
                disabled={saving}
                onClick={handleCancel}
                size="sm"
                variant="ghost"
              >
                Cancel
              </Button>
            </div>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{entry.label}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            {truncateAddress(entry.address)}
          </code>
          <Button
            onClick={() => copyToClipboard(entry.address)}
            size="sm"
            variant="ghost"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
      {isOwner && (
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button
              disabled={deleting === entry.id}
              onClick={() => setIsEditing(true)}
              size="sm"
              variant="ghost"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              disabled={deleting === entry.id}
              onClick={() => onDelete(entry.id)}
              size="sm"
              variant="ghost"
            >
              {deleting === entry.id ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <Trash2 className="h-4 w-4 text-destructive" />
              )}
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  );
}
