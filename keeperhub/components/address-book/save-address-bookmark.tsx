"use client";

import { Bookmark, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
import { addressBookApi } from "@/lib/api-client";
import { ethers } from "ethers";

type SaveAddressBookmarkProps = {
  address: string;
  children: React.ReactNode;
};

export function SaveAddressBookmark({
  address,
  children,
}: SaveAddressBookmarkProps) {
  const { isOwner } = useActiveMember();
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSaveClick = () => {
    if (!isOwner) {
      toast.error("Only organization owners can save addresses");
      return;
    }

    if (!(address && ethers.isAddress(address))) {
      toast.error("Please enter a valid Ethereum address first");
      return;
    }

    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setLabel("");
  };

  const handleSave = async () => {
    if (!label.trim()) {
      toast.error("Please enter a label");
      return;
    }

    if (!(address && ethers.isAddress(address))) {
      toast.error("Invalid address format");
      return;
    }

    setSaving(true);
    try {
      await addressBookApi.create({
        label: label.trim(),
        address,
      });
      toast.success("Address saved to address book");
      setShowForm(false);
      setLabel("");
    } catch (error) {
      console.error("Failed to save address:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to save address to address book"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1">{children}</div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                disabled={
                  !(isOwner && address && ethers.isAddress(address))
                }
                onClick={handleSaveClick}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Bookmark className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isOwner
                ? address && ethers.isAddress(address)
                  ? "Save to Address Book"
                  : "Enter a valid address to save"
                : "Only organization owners can save addresses"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {showForm && (
        <div className="space-y-2 rounded-md border bg-muted/50 p-3">
          <Input
            disabled={saving}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter label (e.g., Treasury Wallet)"
            value={label}
          />
          <div className="flex gap-2">
            <Button
              disabled={saving}
              onClick={handleSave}
              size="sm"
              type="button"
            >
              {saving ? "Saving..." : "Save to Address Book"}
            </Button>
            <Button
              disabled={saving}
              onClick={handleCancel}
              size="sm"
              type="button"
              variant="ghost"
            >
              <X className="mr-1 h-4 w-4" />
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
