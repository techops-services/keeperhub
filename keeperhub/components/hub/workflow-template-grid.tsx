"use client";

import { Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
            className="flex flex-col overflow-hidden bg-sidebar"
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
  );
}
