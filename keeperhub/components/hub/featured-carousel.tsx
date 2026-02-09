"use client";

import { ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { api, type SavedWorkflow } from "@/lib/api-client";
import { authClient, useSession } from "@/lib/auth-client";
import { WorkflowMiniMap } from "./workflow-mini-map";

type FeaturedCarouselProps = {
  workflows: SavedWorkflow[];
};

export function FeaturedCarousel({ workflows }: FeaturedCarouselProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const arrowVisibility = useMemo((): string => {
    const count = workflows.length;
    if (count > 4) {
      return "hidden sm:flex";
    }
    if (count > 3) {
      return "hidden sm:flex lg:hidden";
    }
    if (count > 2) {
      return "hidden sm:flex md:hidden";
    }
    return "hidden";
  }, [workflows.length]);

  const scroll = useCallback((direction: "left" | "right") => {
    const container = scrollRef.current;
    if (!container) {
      return;
    }
    const cardWidth = 320;
    const gap = 16;
    const scrollAmount = cardWidth + gap;
    container.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

  const handleDuplicate = async (workflowId: string): Promise<void> => {
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
      toast.success("Workflow duplicated successfully");
      router.push(`/workflows/${duplicated.id}`);
    } catch (error) {
      console.error("Failed to duplicate workflow:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to duplicate workflow"
      );
    } finally {
      setDuplicatingIds((prev) => {
        const next = new Set(prev);
        next.delete(workflowId);
        return next;
      });
    }
  };

  if (workflows.length === 0) {
    return null;
  }

  return (
    <section className="mb-16">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-bold text-3xl">Featured</h2>
        <div className={`gap-2 ${arrowVisibility}`}>
          <Button
            aria-label="Scroll left"
            onClick={() => scroll("left")}
            size="icon"
            variant="outline"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            aria-label="Scroll right"
            onClick={() => scroll("right")}
            size="icon"
            variant="outline"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div
        className="flex gap-4 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        ref={scrollRef}
      >
        {workflows.map((workflow) => {
          const isDuplicating = duplicatingIds.has(workflow.id);

          return (
            <Card
              className="flex w-[320px] shrink-0 flex-col overflow-hidden bg-sidebar"
              key={workflow.id}
            >
              <div className="relative -mt-6 flex aspect-video w-full items-center justify-center overflow-hidden">
                <WorkflowMiniMap
                  edges={workflow.edges}
                  height={160}
                  nodes={workflow.nodes}
                  width={280}
                />
                {workflow.category && (
                  <Badge
                    className="absolute top-3 right-3 rounded-full bg-sidebar"
                    variant="outline"
                  >
                    {workflow.category}
                  </Badge>
                )}
              </div>
              <CardHeader>
                {workflow.protocol && (
                  <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    {workflow.protocol}
                  </p>
                )}
                <CardTitle className="line-clamp-2">{workflow.name}</CardTitle>
                {workflow.description && (
                  <CardDescription className="line-clamp-2">
                    {workflow.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="flex-1" />
              <CardFooter className="gap-2">
                <Button
                  className="flex-1"
                  disabled={isDuplicating}
                  onClick={() => handleDuplicate(workflow.id)}
                  variant="default"
                >
                  {isDuplicating ? "Duplicating..." : "Use Template"}
                </Button>
                <Button
                  onClick={() => router.push(`/workflows/${workflow.id}`)}
                  variant="outline"
                >
                  <Eye className="size-4" />
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
