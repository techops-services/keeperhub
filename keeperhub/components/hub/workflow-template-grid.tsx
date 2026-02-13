"use client";

import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api, type SavedWorkflow } from "@/lib/api-client";
import { authClient, useSession } from "@/lib/auth-client";
import { WorkflowMiniMap } from "./workflow-mini-map";
import { WorkflowNodeIcons } from "./workflow-node-icons";

type WorkflowTemplateGridProps = {
  workflows: SavedWorkflow[];
};

export function WorkflowTemplateGrid({ workflows }: WorkflowTemplateGridProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [duplicatingIds, setDuplicatingIds] = useState<Set<string>>(new Set());

  const handleDuplicate = async (workflowId: string) => {
    if (duplicatingIds.has(workflowId)) {
      return;
    }

    setDuplicatingIds((prev) => new Set(prev).add(workflowId));

    try {
      // Auto-sign in as anonymous if user has no session
      if (!session?.user) {
        await authClient.signIn.anonymous();
        // Wait for session to be established
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
    return (
      <div className="">
        <p className="text-muted-foreground">No workflows available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {workflows.map((workflow) => {
        const isDuplicating = duplicatingIds.has(workflow.id);

        return (
          <Card
            className="flex flex-col gap-0 overflow-hidden border-none bg-sidebar py-0 transition-colors hover:brightness-125"
            key={workflow.id}
          >
            <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden px-8">
              <WorkflowMiniMap
                edges={workflow.edges}
                height={160}
                nodes={workflow.nodes}
                width={280}
              />
              {workflow.publicTags && workflow.publicTags.length > 0 && (
                <div className="absolute top-3 right-3 flex flex-wrap justify-end gap-1">
                  {workflow.publicTags.slice(0, 2).map((tag) => (
                    <span
                      className="rounded-full bg-[#09fd671a] px-3 py-1 font-medium text-[#09fd67] text-[10px]"
                      key={tag.slug}
                    >
                      {tag.name}
                    </span>
                  ))}
                  {workflow.publicTags.length > 2 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default rounded-full bg-[#09fd671a] px-2 py-1 font-medium text-[#09fd67] text-[10px]">
                          +{workflow.publicTags.length - 2}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        className="flex flex-col gap-1"
                        side="bottom"
                      >
                        {workflow.publicTags.map((tag) => (
                          <span key={tag.slug}>{tag.name}</span>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              )}
            </div>
            <CardHeader className="pb-4">
              <CardTitle className="line-clamp-2">{workflow.name}</CardTitle>
              {workflow.description && (
                <CardDescription className="line-clamp-2">
                  {workflow.description}
                </CardDescription>
              )}
              <WorkflowNodeIcons nodes={workflow.nodes} />
            </CardHeader>
            <div className="flex-1" />
            <CardFooter className="gap-2 pb-4">
              <Button
                className="flex-1"
                disabled={isDuplicating}
                onClick={() => handleDuplicate(workflow.id)}
                variant="default"
              >
                {isDuplicating ? "Duplicating..." : "Use Template"}
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => router.push(`/workflows/${workflow.id}`)}
                    variant="outline"
                  >
                    <Eye className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">View Template</TooltipContent>
              </Tooltip>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
