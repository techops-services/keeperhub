"use client";

import { Copy, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TableCell, TableRow } from "@/components/ui/table";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
import type { AddressBookEntry } from "@/lib/api-client";

type AddressBookRowProps = {
  entry: AddressBookEntry;
  onUpdate: () => void;
  onDelete: () => void;
  onEdit: (entry: AddressBookEntry) => void;
  deleting: string | null;
};

export function AddressBookRow({
  entry,
  onUpdate,
  onDelete,
  onEdit,
  deleting,
}: AddressBookRowProps) {
  const { isOwner } = useActiveMember();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 12) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

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
              onClick={() => onEdit(entry)}
              size="sm"
              variant="ghost"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              disabled={deleting === entry.id}
              onClick={onDelete}
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
