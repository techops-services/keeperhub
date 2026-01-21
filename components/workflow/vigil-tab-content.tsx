// start custom keeperhub code //
"use client";

import { useAtomValue } from "jotai";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api-client";
import type { VigilAnalysis as VigilAnalysisType } from "@/lib/vigil-schema";
import { currentWorkflowIdAtom } from "@/lib/workflow-store";
import { VigilAnalysis } from "./vigil-analysis";

type Execution = {
  id: string;
  workflowId: string;
  status: "pending" | "running" | "success" | "error" | "cancelled";
  startedAt: Date;
  completedAt: Date | null;
  duration: string | null;
  error: string | null;
  vigilAnalysis?: VigilAnalysisType | null;
};

export type VigilTabContentProps = {
  onRefreshRef?: React.RefObject<(() => Promise<void>) | null>;
};

export function VigilTabContent({ onRefreshRef }: VigilTabContentProps = {}) {
  const workflowId = useAtomValue(currentWorkflowIdAtom);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<Set<string>>(new Set());

  const loadExecutions = useCallback(async () => {
    if (!workflowId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await api.workflow.getExecutions(workflowId);
      setExecutions(data as Execution[]);
    } catch (error) {
      console.error("Failed to load executions:", error);
      toast.error("Failed to load executions");
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  // Expose loadExecutions via ref for parent component
  useEffect(() => {
    if (onRefreshRef) {
      onRefreshRef.current = loadExecutions;
    }
  }, [loadExecutions, onRefreshRef]);

  useEffect(() => {
    loadExecutions();
  }, [loadExecutions]);

  const handleAnalyze = useCallback(
    async (executionId: string) => {
      try {
        setAnalyzing((prev) => new Set(prev).add(executionId));
        const response = await fetch(
          `/api/workflows/executions/${executionId}/analyze`,
          {
            method: "POST",
          }
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Analysis failed");
        }

        const { analysis } = await response.json();
        setExecutions((prev) =>
          prev.map((exec) =>
            exec.id === executionId
              ? { ...exec, vigilAnalysis: analysis }
              : exec
          )
        );
        toast.success("Analysis completed");
        // Reload executions from server to ensure consistency
        await loadExecutions();
      } catch (error) {
        console.error("Failed to analyze execution:", error);
        toast.error(
          error instanceof Error ? error.message : "Failed to analyze execution"
        );
      } finally {
        setAnalyzing((prev) => {
          const next = new Set(prev);
          next.delete(executionId);
          return next;
        });
      }
    },
    [loadExecutions]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!workflowId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-muted-foreground text-sm">
          No workflow selected
        </div>
      </div>
    );
  }

  const failedExecutions = executions.filter((exec) => exec.status === "error");

  if (failedExecutions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center text-muted-foreground text-sm">
          No failed executions to analyze
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {failedExecutions.map((execution) => (
        <div
          className="rounded-lg border bg-card p-4 shadow-sm"
          key={execution.id}
        >
          <div className="mb-3 flex items-start justify-between">
            <div className="flex-1">
              <div className="font-medium text-sm">
                Execution {execution.id.slice(0, 8)}
              </div>
              <div className="mt-1 text-muted-foreground text-xs">
                {new Date(execution.startedAt).toLocaleString()}
                {execution.completedAt &&
                  ` - ${new Date(execution.completedAt).toLocaleString()}`}
              </div>
              {execution.error && (
                <div className="mt-2 flex items-start gap-2 text-muted-foreground text-xs">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  <span className="flex-1 break-words">{execution.error}</span>
                </div>
              )}
            </div>
            {(!execution.vigilAnalysis ||
              execution.vigilAnalysis.status !== "success") && (
              <Button
                disabled={analyzing.has(execution.id)}
                onClick={() => handleAnalyze(execution.id)}
                size="sm"
                variant={execution.vigilAnalysis ? "outline" : "default"}
              >
                {analyzing.has(execution.id) ? (
                  <>
                    <Loader2 className="mr-2 size-3 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    {execution.vigilAnalysis && (
                      <RefreshCw className="mr-2 size-3" />
                    )}
                    {execution.vigilAnalysis ? "Retry" : "Analyze"}
                  </>
                )}
              </Button>
            )}
          </div>
          {execution.vigilAnalysis && (
            <div className="mt-4 border-t pt-4">
              <VigilAnalysis analysis={execution.vigilAnalysis} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
// end keeperhub code //
