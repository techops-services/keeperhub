"use client";

import { Eye, Loader2, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/overlays/overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import type { OverlayComponentProps } from "@/components/overlays/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WorkflowMiniMap } from "@/keeperhub/components/hub/workflow-mini-map";
import { useDebounce } from "@/keeperhub/lib/hooks/use-debounce";
import { api, type SavedWorkflow } from "@/lib/api-client";
import { authClient, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type FeaturedOverlayProps = OverlayComponentProps;

export function FeaturedOverlay({ overlayId }: FeaturedOverlayProps) {
  const router = useRouter();
  const { closeAll } = useOverlay();
  const { data: session } = useSession();
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const categories = useMemo(() => {
    const uniqueCategories = new Set<string>();
    for (const workflow of workflows) {
      if (workflow.category) {
        uniqueCategories.add(workflow.category);
      }
    }
    return Array.from(uniqueCategories).sort();
  }, [workflows]);

  const filteredWorkflows = useMemo(() => {
    let result = workflows;

    if (selectedCategory) {
      result = result.filter((w) => w.category === selectedCategory);
    }

    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.trim().toLowerCase();
      result = result.filter(
        (w) =>
          w.name.toLowerCase().includes(query) ||
          w.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [workflows, selectedCategory, debouncedSearchQuery]);

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const featured = await api.workflow.getFeatured();
        setWorkflows(featured);
      } catch (error) {
        console.error("Failed to fetch featured workflows:", error);
        toast.error("Failed to load templates");
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, []);

  const handleDuplicate = async (workflowId: string) => {
    if (duplicatingIds.has(workflowId)) {
      return;
    }

    setDuplicatingIds((prev) => new Set(prev).add(workflowId));

    try {
      if (!session?.user) {
        await authClient.signIn.anonymous();
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const duplicated = await api.workflow.duplicate(workflowId);
      toast.success("Template applied successfully");
      closeAll();
      router.push(`/workflows/${duplicated.id}`);
    } catch (error) {
      console.error("Failed to duplicate workflow:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to apply template"
      );
    } finally {
      setDuplicatingIds((prev) => {
        const next = new Set(prev);
        next.delete(workflowId);
        return next;
      });
    }
  };

  const handleView = (workflowId: string) => {
    closeAll();
    router.push(`/workflows/${workflowId}`);
  };

  return (
    <Overlay
      actions={[{ label: "Cancel", variant: "outline", onClick: closeAll }]}
      description="Start with a pre-built workflow template"
      overlayId={overlayId}
      title="Workflow Templates"
    >
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {!isLoading && workflows.length === 0 && (
        <div className="py-8 text-center">
          <p className="text-muted-foreground">No templates available yet.</p>
        </div>
      )}
      {!isLoading && workflows.length > 0 && (
        <div className="space-y-4">
          {/* Search and Filters */}
          <div>
            {/* Search input with category chip */}
            <div className="flex min-h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
              {selectedCategory && (
                <Badge className="shrink-0 gap-1 pr-1" variant="secondary">
                  {selectedCategory}
                  <button
                    aria-label="Remove category filter"
                    className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                    onClick={() => setSelectedCategory(null)}
                    type="button"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              )}
              <input
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  selectedCategory
                    ? "Filter within category..."
                    : "Search templates..."
                }
                type="text"
                value={searchQuery}
              />
              {searchQuery && (
                <button
                  aria-label="Clear search"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchQuery("")}
                  type="button"
                >
                  <X className="size-4" />
                </button>
              )}
              <Search className="size-4 text-muted-foreground" />
            </div>

            {/* Category pills */}
            {categories.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 font-medium text-xs transition-colors",
                    selectedCategory === null
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                  onClick={() => setSelectedCategory(null)}
                  type="button"
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 font-medium text-xs transition-colors",
                      selectedCategory === category
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    type="button"
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results */}
          {filteredWorkflows.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">
                No templates found matching your search.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {filteredWorkflows.map((workflow) => {
                const isDuplicating = duplicatingIds.has(workflow.id);

                return (
                  <Card
                    className="flex flex-col overflow-hidden"
                    key={workflow.id}
                  >
                    <div className="-mt-6 flex aspect-video w-full items-center justify-center overflow-hidden bg-slate-100 dark:bg-slate-900">
                      <WorkflowMiniMap
                        edges={workflow.edges}
                        height={140}
                        nodes={workflow.nodes}
                        width={260}
                      />
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-1 text-base">
                          {workflow.name}
                        </CardTitle>
                        {workflow.category && (
                          <Badge className="shrink-0" variant="secondary">
                            {workflow.category}
                          </Badge>
                        )}
                      </div>
                      {workflow.description && (
                        <CardDescription className="line-clamp-2 text-xs">
                          {workflow.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="flex-1" />
                    <CardFooter className="gap-2 pt-0">
                      <Button
                        className="flex-1"
                        disabled={isDuplicating}
                        onClick={() => handleDuplicate(workflow.id)}
                        size="sm"
                        variant="default"
                      >
                        {isDuplicating ? "Applying..." : "Use Template"}
                      </Button>
                      <Button
                        onClick={() => handleView(workflow.id)}
                        size="sm"
                        variant="outline"
                      >
                        <Eye className="size-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Overlay>
  );
}
