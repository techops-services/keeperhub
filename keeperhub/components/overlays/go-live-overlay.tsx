"use client";

import { AlertTriangle, Globe } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/overlays/overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import type { OverlayComponentProps } from "@/components/overlays/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { api, type PublicTag } from "@/lib/api-client";
import { PublicTagSelector } from "./public-tag-selector";

type GoLiveOverlayProps = OverlayComponentProps<{
  workflowId: string;
  currentName: string;
  orgTagNames: string[];
  initialTags?: PublicTag[];
  isEditing?: boolean;
  onConfirm: (data: { name: string; publicTags: PublicTag[] }) => void;
}>;

export function GoLiveOverlay({
  overlayId,
  workflowId,
  currentName,
  orgTagNames,
  initialTags = [],
  isEditing = false,
  onConfirm,
}: GoLiveOverlayProps) {
  const { closeAll } = useOverlay();
  const [name, setName] = useState(currentName);
  const [selectedTags, setSelectedTags] = useState<PublicTag[]>(initialTags);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const title = isEditing ? "Public Settings" : "Go Live";
  const submitLabel = isEditing ? "Save Changes" : "Go Live";
  const submittingTitle = isEditing ? "Saving..." : "Going Live...";

  const handleSubmit = async (): Promise<void> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Please enter a workflow name");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.workflow.goLive(workflowId, {
        name: trimmedName,
        publicTagIds: selectedTags.map((t) => t.id),
      });
      closeAll();
      // Defer state updates until after close animation to prevent visual glitch
      setTimeout(() => {
        onConfirm({ name: trimmedName, publicTags: selectedTags });
      }, 250);
    } catch (error) {
      setIsSubmitting(false);
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to ${title.toLowerCase()}`
      );
    }
  };

  if (isSubmitting) {
    return (
      <Overlay overlayId={overlayId} title={submittingTitle}>
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay
      actions={[
        { label: "Cancel", variant: "outline", onClick: closeAll },
        {
          label: submitLabel,
          onClick: handleSubmit,
          disabled: !name.trim(),
        },
      ]}
      overlayId={overlayId}
      title={title}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="workflow-name">Workflow Name</Label>
          <Input
            id="workflow-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter workflow name..."
            value={name}
          />
          {name.toLowerCase().startsWith("untitled") && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-2 text-xs text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>Give your workflow a descriptive name.</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Tags</Label>
          <p className="text-muted-foreground text-sm">
            Choose tags to make your workflow discoverable on the Hub.
          </p>
          <PublicTagSelector
            initialTags={initialTags}
            onTagsChange={setSelectedTags}
            orgTagNames={orgTagNames}
            selectedTags={selectedTags}
          />
        </div>

        {!isEditing && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="size-4 shrink-0" />
            <p className="text-sm">
              Public workflows are visible on the Hub. Others can view the
              structure and duplicate it. Your credentials and logs remain
              private.
            </p>
          </div>
        )}
      </div>
    </Overlay>
  );
}
