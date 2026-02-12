"use client";

import { Layers, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmOverlay } from "@/components/overlays/confirm-overlay";
import { Overlay } from "@/components/overlays/overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TaxonomyFormDialog } from "@/keeperhub/components/taxonomy/taxonomy-form-dialog";
import { api, type TaxonomyEntry } from "@/lib/api-client";

type CategoriesOverlayProps = {
  overlayId: string;
};

export function CategoriesOverlay({ overlayId }: CategoriesOverlayProps) {
  const { open: openOverlay } = useOverlay();
  const [categories, setCategories] = useState<TaxonomyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      const result = await api.category.getAll();
      setCategories(result);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleDelete = (category: TaxonomyEntry): void => {
    openOverlay(ConfirmOverlay, {
      title: "Delete Category",
      message: `Are you sure you want to delete "${category.name}"? This cannot be undone.`,
      confirmLabel: "Delete",
      confirmVariant: "destructive" as const,
      destructive: true,
      onConfirm: async () => {
        try {
          await api.category.delete(category.id);
          setCategories((prev) => prev.filter((c) => c.id !== category.id));
          toast.success(`Category "${category.name}" deleted`);
        } catch {
          toast.error("Failed to delete category");
        }
      },
    });
  };

  const handleCreated = (entry: TaxonomyEntry): void => {
    setCategories((prev) => [...prev, entry]);
  };

  return (
    <>
      <Overlay
        description="Manage workflow categories for hub listings"
        overlayId={overlayId}
        title="Categories"
      >
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowCreateDialog(true)} size="sm">
              <Plus className="mr-2 size-4" />
              New Category
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          )}
          {!isLoading && categories.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
              <Layers className="size-8" />
              <p className="text-sm">No categories yet</p>
              <p className="text-xs">
                Create a category to classify your public workflows.
              </p>
            </div>
          )}
          {!isLoading && categories.length > 0 && (
            <div className="space-y-1">
              {categories.map((category) => (
                <div
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                  key={category.id}
                >
                  <p className="font-medium text-sm">{category.name}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-xs">
                      {category.workflowCount}{" "}
                      {category.workflowCount === 1 ? "workflow" : "workflows"}
                    </span>
                    {category.workflowCount === 0 && (
                      <Button
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(category)}
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
        createFn={api.category.create}
        onCreated={handleCreated}
        onOpenChange={setShowCreateDialog}
        open={showCreateDialog}
        title="Category"
      />
    </>
  );
}
