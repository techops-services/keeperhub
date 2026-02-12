"use client";

import { Globe, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmOverlay } from "@/components/overlays/confirm-overlay";
import { Overlay } from "@/components/overlays/overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TaxonomyFormDialog } from "@/keeperhub/components/taxonomy/taxonomy-form-dialog";
import { api, type TaxonomyEntry } from "@/lib/api-client";

type ProtocolsOverlayProps = {
  overlayId: string;
};

export function ProtocolsOverlay({ overlayId }: ProtocolsOverlayProps) {
  const { open: openOverlay } = useOverlay();
  const [protocols, setProtocols] = useState<TaxonomyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadProtocols = useCallback(async () => {
    try {
      const result = await api.protocol.getAll();
      setProtocols(result);
    } catch {
      toast.error("Failed to load protocols");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProtocols();
  }, [loadProtocols]);

  const handleDelete = (protocol: TaxonomyEntry): void => {
    openOverlay(ConfirmOverlay, {
      title: "Delete Protocol",
      message: `Are you sure you want to delete "${protocol.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      confirmVariant: "destructive" as const,
      destructive: true,
      onConfirm: async () => {
        try {
          await api.protocol.delete(protocol.id);
          setProtocols((prev) => prev.filter((p) => p.id !== protocol.id));
          toast.success(`Protocol "${protocol.name}" deleted`);
        } catch {
          toast.error("Failed to delete protocol");
        }
      },
    });
  };

  const handleCreated = (entry: TaxonomyEntry): void => {
    setProtocols((prev) => [...prev, entry]);
  };

  return (
    <>
      <Overlay
        description="Manage workflow protocols for hub listings"
        overlayId={overlayId}
        title="Protocols"
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="mr-2 size-4" />
              New Protocol
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          )}
          {!isLoading && protocols.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Globe className="size-8" />
              <p className="text-sm">No protocols yet</p>
              <p className="text-xs">
                Create a protocol to classify your public workflows.
              </p>
            </div>
          )}
          {!isLoading && protocols.length > 0 && (
            <div className="space-y-1">
              {protocols.map((protocol) => (
                <div
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                  key={protocol.id}
                >
                  <p className="font-medium text-sm">{protocol.name}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">
                      {protocol.workflowCount}{" "}
                      {protocol.workflowCount === 1 ? "workflow" : "workflows"}
                    </span>
                    {protocol.workflowCount === 0 && (
                      <Button
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(protocol)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Overlay>
      <TaxonomyFormDialog
        createFn={api.protocol.create}
        onCreated={handleCreated}
        onOpenChange={setShowCreateDialog}
        open={showCreateDialog}
        title="Protocol"
      />
    </>
  );
}
