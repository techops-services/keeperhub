"use client";

import { useEffect, useState } from "react";
import { getProjectIntegrations } from "@/app/actions/vercel-project/get-integrations";
import { getAll } from "@/app/actions/workflow/get-all";
import type { SavedWorkflow } from "@/app/actions/workflow/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type IntegrationType =
  | "resend"
  | "linear"
  | "slack"
  | "ai-gateway"
  | "database";

type ImportIntegrationsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWorkflowId: string | null;
  integrationType: IntegrationType;
  onImport: (integrations: {
    resendApiKey: string | null;
    resendFromEmail: string | null;
    linearApiKey: string | null;
    slackApiKey: string | null;
    aiGatewayApiKey: string | null;
    databaseUrl: string | null;
  }) => void;
};

const integrationLabels: Record<IntegrationType, string> = {
  resend: "Resend",
  linear: "Linear",
  slack: "Slack",
  "ai-gateway": "AI Gateway",
  database: "Database",
};

export function ImportIntegrationsDialog({
  open,
  onOpenChange,
  currentWorkflowId,
  integrationType,
  onImport,
}: ImportIntegrationsDialogProps) {
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");

  useEffect(() => {
    if (open) {
      const loadWorkflows = async () => {
        setLoading(true);
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
    }
  }, [open, currentWorkflowId]);

  const buildFilteredIntegrations = (
    integrations: Awaited<ReturnType<typeof getProjectIntegrations>>
  ) => ({
    resendApiKey:
      integrationType === "resend" ? integrations.resendApiKey : null,
    resendFromEmail:
      integrationType === "resend" ? integrations.resendFromEmail : null,
    linearApiKey:
      integrationType === "linear" ? integrations.linearApiKey : null,
    slackApiKey: integrationType === "slack" ? integrations.slackApiKey : null,
    aiGatewayApiKey:
      integrationType === "ai-gateway" ? integrations.aiGatewayApiKey : null,
    databaseUrl:
      integrationType === "database" ? integrations.databaseUrl : null,
  });

  const handleImport = async () => {
    if (!selectedWorkflowId) {
      return;
    }

    setImporting(true);
    try {
      const integrations = await getProjectIntegrations(selectedWorkflowId);
      const filteredIntegrations = buildFilteredIntegrations(integrations);

      onImport(filteredIntegrations);
      onOpenChange(false);
      setSelectedWorkflowId("");
    } catch (error) {
      console.error("Failed to import integrations:", error);
    } finally {
      setImporting(false);
    }
  };

  let placeholder = "Select a workflow";
  if (loading) {
    placeholder = "Loading workflows...";
  } else if (workflows.length === 0) {
    placeholder = "No other workflows found";
  }

  const integrationLabel = integrationLabels[integrationType];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import {integrationLabel} Integration</DialogTitle>
          <DialogDescription>
            Copy {integrationLabel} settings from another workflow to quickly
            configure this one.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="ml-1">Select Workflow</Label>
            <Select
              disabled={loading || importing || workflows.length === 0}
              onValueChange={setSelectedWorkflowId}
              value={selectedWorkflowId}
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
          </div>

          <div className="flex justify-end gap-2">
            <Button
              disabled={importing}
              onClick={() => onOpenChange(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedWorkflowId || importing}
              onClick={handleImport}
            >
              {importing ? "Importing..." : "Import"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
