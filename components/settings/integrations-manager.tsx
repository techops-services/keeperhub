"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { IntegrationIcon } from "@/components/ui/integration-icon";
import { Spinner } from "@/components/ui/spinner";
import {
  api,
  type Integration,
  type IntegrationWithConfig,
} from "@/lib/api-client";
import { getIntegrationLabels } from "@/plugins";
import { IntegrationFormDialog } from "./integration-form-dialog";

// System integrations that don't have plugins
const SYSTEM_INTEGRATION_LABELS: Record<string, string> = {
  database: "Database",
};

type IntegrationsManagerProps = {
  showCreateDialog: boolean;
  onCreateDialogClose?: () => void;
  onIntegrationChange?: () => void;
  filter?: string;
};

export function IntegrationsManager({
  showCreateDialog: externalShowCreateDialog,
  onCreateDialogClose,
  onIntegrationChange,
  filter = "",
}: IntegrationsManagerProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingIntegration, setEditingIntegration] =
    useState<IntegrationWithConfig | null>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Sync external dialog state
  useEffect(() => {
    setShowCreateDialog(externalShowCreateDialog);
  }, [externalShowCreateDialog]);

  const loadIntegrations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.integration.getAll();
      setIntegrations(data);
    } catch (error) {
      console.error("Failed to load integrations:", error);
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  // Get integrations with their labels, sorted by label then name
  const integrationsWithLabels = useMemo(() => {
    const labels = getIntegrationLabels() as Record<string, string>;
    const filterLower = filter.toLowerCase();

    return integrations
      .map((integration) => ({
        ...integration,
        label:
          labels[integration.type] ||
          SYSTEM_INTEGRATION_LABELS[integration.type] ||
          integration.type,
      }))
      .filter((integration) => {
        if (!filter) return true;
        return (
          integration.label.toLowerCase().includes(filterLower) ||
          integration.name.toLowerCase().includes(filterLower) ||
          integration.type.toLowerCase().includes(filterLower)
        );
      })
      .sort((a, b) => {
        const labelCompare = a.label.localeCompare(b.label);
        if (labelCompare !== 0) {
          return labelCompare;
        }
        return a.name.localeCompare(b.name);
      });
  }, [integrations, filter]);

  const handleDelete = async (id: string) => {
    try {
      await api.integration.delete(id);
      toast.success("Integration deleted");
      await loadIntegrations();
      onIntegrationChange?.();
    } catch (error) {
      console.error("Failed to delete integration:", error);
      toast.error("Failed to delete integration");
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (id: string) => {
    try {
      setTestingId(id);
      const result = await api.integration.testConnection(id);

      if (result.status === "success") {
        toast.success(result.message || "Connection successful");
      } else {
        toast.error(result.message || "Connection test failed");
      }
    } catch (error) {
      console.error("Connection test failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Connection test failed"
      );
    } finally {
      setTestingId(null);
    }
  };

  const handleDialogClose = () => {
    setShowCreateDialog(false);
    setEditingIntegration(null);
    onCreateDialogClose?.();
  };

  const handleDialogSuccess = async () => {
    await loadIntegrations();
    onIntegrationChange?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner />
      </div>
    );
  }

  const renderIntegrationsList = () => {
    if (integrations.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-muted-foreground text-sm">
            No connections configured yet
          </p>
        </div>
      );
    }

    if (integrationsWithLabels.length === 0) {
      return (
        <div className="py-8 text-center">
          <p className="text-muted-foreground text-sm">
            No connections match your filter
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {integrationsWithLabels.map((integration) => (
          <div
            className="flex items-center justify-between rounded-md px-2 py-1.5"
            key={integration.id}
          >
            <div className="flex items-center gap-2">
              <IntegrationIcon
                className="size-4"
                integration={
                  integration.type === "ai-gateway"
                    ? "vercel"
                    : integration.type
                }
              />
              <span className="font-medium text-sm">{integration.label}</span>
              <span className="text-muted-foreground text-sm">
                {integration.name}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                className="h-7 px-2"
                disabled={testingId === integration.id}
                onClick={() => handleTest(integration.id)}
                size="sm"
                variant="outline"
              >
                {testingId === integration.id ? (
                  <Spinner className="size-3" />
                ) : (
                  <span className="text-xs">Test</span>
                )}
              </Button>
              <Button
                className="size-7"
                onClick={async () => {
                  const fullIntegration = await api.integration.get(
                    integration.id
                  );
                  setEditingIntegration(fullIntegration);
                }}
                size="icon"
                variant="outline"
              >
                <Pencil className="size-3" />
              </Button>
              <Button
                className="size-7"
                onClick={() => setDeletingId(integration.id)}
                size="icon"
                variant="outline"
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {renderIntegrationsList()}

      {(showCreateDialog || editingIntegration) && (
        <IntegrationFormDialog
          integration={editingIntegration}
          mode={editingIntegration ? "edit" : "create"}
          onClose={handleDialogClose}
          onSuccess={handleDialogSuccess}
          open
        />
      )}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeletingId(null);
          }
        }}
        open={deletingId !== null}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this connection? Workflows using
              it will fail until a new one is configured.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingId) {
                  handleDelete(deletingId);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
