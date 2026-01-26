"use client";

import { ethers } from "ethers";
import { Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";

type SaveAddressButtonProps = {
  address: string;
  onClick: () => void;
};

export function SaveAddressButton({
  address,
  onClick,
}: SaveAddressButtonProps) {
  const { isOwner } = useActiveMember();

  if (!isOwner) {
    return null;
  }

  return (
    <Button
      className="gap-2 border border-gray-700 disabled:opacity-70"
      disabled={!(address && ethers.isAddress(address))}
      onClick={onClick}
      size="sm"
      type="button"
      variant="ghost"
    >
      <Bookmark className="h-4 w-4" fill="currentColor" />
      Save
    </Button>
  );
}
