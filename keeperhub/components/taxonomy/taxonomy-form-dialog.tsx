"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TaxonomyEntry } from "@/lib/api-client";

type TaxonomyFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (entry: TaxonomyEntry) => void;
  title: string;
  createFn: (data: { name: string }) => Promise<TaxonomyEntry>;
};

export function TaxonomyFormDialog({
  open,
  onOpenChange,
  onCreated,
  title,
  createFn,
}: TaxonomyFormDialogProps) {
  const [name, setName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }

    setIsCreating(true);
    try {
      const entry = await createFn({ name: trimmed });
      onCreated(entry);
      setName("");
      onOpenChange(false);
    } catch {
      toast.error(`Failed to create ${title.toLowerCase()}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && name.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>New {title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="taxonomy-name">Name</Label>
            <Input
              autoFocus
              disabled={isCreating}
              id="taxonomy-name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Enter ${title.toLowerCase()} name...`}
              value={name}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim() || isCreating}
            onClick={handleSubmit}
            size="sm"
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
