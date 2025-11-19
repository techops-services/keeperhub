"use client";

import { useEffect, useState } from "react";
import { getProjectIntegrations } from "@/app/actions/vercel-project/get-integrations";
import { getAll } from "@/app/actions/workflow/get-all";
import type { SavedWorkflow } from "@/app/actions/workflow/types";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CopyFromWorkflowSelectProps = {
  currentWorkflowId: string | null;
  onCopyIntegrations: (integrations: {
    resendApiKey: string | null;
    resendFromEmail: string | null;
    linearApiKey: string | null;
    slackApiKey: string | null;
    aiGatewayApiKey: string | null;
    databaseUrl: string | null;
  }) => void;
};

export function CopyFromWorkflowSelect({
  currentWorkflowId,
  onCopyIntegrations,
}: CopyFromWorkflowSelectProps) {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const allWorkflows = await getAll();
        const filteredWorkflows = allWorkflows.filter(
          (w) => w.id !== currentWorkflowId
        );
        setWorkflows(filteredWorkflows);
      } catch (error) {
        console.error("Failed to load workflows:", error);
      } finally {
        setLoading(false);
      }
    };

    loadWorkflows();
  }, [currentWorkflowId]);

  const handleWorkflowSelect = async (workflowId: string) => {
    if (!workflowId) {
      return;
    }

    setCopying(true);
    try {
      const integrations = await getProjectIntegrations(workflowId);
      onCopyIntegrations({
        resendApiKey: integrations.resendApiKey,
        resendFromEmail: integrations.resendFromEmail,
        linearApiKey: integrations.linearApiKey,
        slackApiKey: integrations.slackApiKey,
        aiGatewayApiKey: integrations.aiGatewayApiKey,
        databaseUrl: integrations.databaseUrl,
      });
    } catch (error) {
      console.error("Failed to copy integrations:", error);
    } finally {
      setCopying(false);
    }
  };

  if (workflows.length === 0 && !loading) {
    return null;
  }

  let placeholder = "Select a workflow to copy from";
  if (loading) {
    placeholder = "Loading workflows...";
  } else if (copying) {
    placeholder = "Copying...";
  }

  return (
    <div className="space-y-2">
      <Label className="ml-1">Copy from Other Workflow</Label>
      <Select
        disabled={loading || copying}
        onValueChange={handleWorkflowSelect}
      >
        <SelectTrigger className="bg-background">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {workflows.map((workflow) => (
            <SelectItem key={workflow.id} value={workflow.id}>
              {workflow.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-sm">
        Copy integration settings from another workflow to quickly configure
        this one.
      </p>
    </div>
  );
}
