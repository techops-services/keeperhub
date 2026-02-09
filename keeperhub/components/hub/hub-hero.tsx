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

type HubHeroProps = {
  topWorkflow: SavedWorkflow | undefined;
};

export function HubHero({ topWorkflow }: HubHeroProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [isDuplicating, setIsDuplicating] = useState(false);

  const handleDuplicate = async (workflowId: string): Promise<void> => {
    if (isDuplicating) {
      return;
    }

    setIsDuplicating(true);

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
      setIsDuplicating(false);
    }
  };

  return (
    <div className="mb-16 grid items-center gap-12 pt-8 lg:grid-cols-2">
      <div>
        <h1 className="mb-4 font-bold text-5xl tracking-tight">
          KeeperHub Web3 Automation
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground">
          Browse ready-made workflow templates and community automations.
          Duplicate any template to get started in seconds.
        </p>
      </div>

      {topWorkflow && (
        <Card className="flex flex-col overflow-hidden bg-sidebar">
          <div className="relative -mt-6 flex w-full items-center justify-center overflow-hidden [aspect-ratio:32/9]">
            <WorkflowMiniMap
              edges={topWorkflow.edges}
              height={120}
              nodes={topWorkflow.nodes}
              width={480}
            />
            {topWorkflow.category && (
              <Badge
                className="absolute top-3 right-3 rounded-full bg-sidebar"
                variant="outline"
              >
                {topWorkflow.category}
              </Badge>
            )}
          </div>
          <CardHeader>
            {topWorkflow.protocol && (
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                {topWorkflow.protocol}
              </p>
            )}
            <CardTitle className="line-clamp-2">{topWorkflow.name}</CardTitle>
            {topWorkflow.description && (
              <CardDescription className="line-clamp-2">
                {topWorkflow.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="flex-1" />
          <CardFooter className="gap-2">
            <Button
              className="flex-1"
              disabled={isDuplicating}
              onClick={() => handleDuplicate(topWorkflow.id)}
              variant="default"
            >
              {isDuplicating ? "Duplicating..." : "Use Template"}
            </Button>
            <Button
              onClick={() => router.push(`/workflows/${topWorkflow.id}`)}
              variant="outline"
            >
              <Eye className="size-4" />
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
