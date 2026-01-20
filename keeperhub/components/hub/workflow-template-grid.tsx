"use client";

import Image from "next/image";
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

type WorkflowTemplateGridProps = {
  workflows: SavedWorkflow[];
  isFeatured?: boolean;
};

export function WorkflowTemplateGrid({
  workflows,
  isFeatured = false,
}: WorkflowTemplateGridProps) {
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
        <p className="text-muted-foreground">
          {isFeatured
            ? "No featured workflows available yet."
            : "No public workflows available yet."}
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
      }}
    >
      {workflows.map((workflow) => {
        const isDuplicating = duplicatingIds.has(workflow.id);
        const nodeCount = Array.isArray(workflow.nodes)
          ? workflow.nodes.length
          : 0;

        return (
          <Card className="flex flex-col overflow-hidden" key={workflow.id}>
            {isFeatured && workflow.displayImage && (
              <div className="relative -mt-6 aspect-video w-full overflow-hidden">
                <Image
                  alt={workflow.name}
                  className="object-cover"
                  fill
                  src={workflow.displayImage}
                  unoptimized
                />
              </div>
            )}
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="line-clamp-2">{workflow.name}</CardTitle>
                {isFeatured && workflow.category && (
                  <Badge variant="secondary">{workflow.category}</Badge>
                )}
              </div>
              {workflow.description && (
                <CardDescription className="line-clamp-2">
                  {workflow.description}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent className="flex-1">
              <div className="text-muted-foreground text-sm">
                {nodeCount} {nodeCount === 1 ? "node" : "nodes"}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                disabled={isDuplicating}
                onClick={() => handleDuplicate(workflow.id)}
                variant="default"
              >
                {isDuplicating ? "Duplicating..." : "Use Template"}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
