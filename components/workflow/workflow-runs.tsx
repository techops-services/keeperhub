'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useAtom } from 'jotai';
import { currentWorkflowIdAtom } from '@/lib/workflow-store';
import { getRelativeTime } from '@/lib/utils/time';

interface ExecutionLog {
  id: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'pending' | 'running' | 'success' | 'error';
  startedAt: Date;
  completedAt: Date | null;
  duration: string | null;
  error: string | null;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'cancelled';
  startedAt: Date;
  completedAt: Date | null;
  duration: string | null;
  error: string | null;
}

interface WorkflowRunsProps {
  isActive?: boolean;
}

export function WorkflowRuns({ isActive = false }: WorkflowRunsProps) {
  const [currentWorkflowId] = useAtom(currentWorkflowIdAtom);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [logs, setLogs] = useState<Record<string, ExecutionLog[]>>({});
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentWorkflowId) {
      setLoading(false);
      return;
    }

    const loadExecutions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/workflows/${currentWorkflowId}/executions`);
        if (response.ok) {
          const data = await response.json();
          setExecutions(Array.isArray(data) ? data : []);
        } else {
          setExecutions([]);
        }
      } catch (error) {
        console.error('Failed to load executions:', error);
        setExecutions([]);
      } finally {
        setLoading(false);
      }
    };

    loadExecutions();
  }, [currentWorkflowId]);

  // Poll for new executions when tab is active
  useEffect(() => {
    if (!isActive || !currentWorkflowId) return;

    const loadExecutions = async () => {
      try {
        const response = await fetch(`/api/workflows/${currentWorkflowId}/executions`);
        if (response.ok) {
          const data = await response.json();
          setExecutions(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error('Failed to poll executions:', error);
      }
    };

    const interval = setInterval(loadExecutions, 5000);
    return () => clearInterval(interval);
  }, [isActive, currentWorkflowId]);

  const loadExecutionLogs = async (executionId: string) => {
    if (logs[executionId]) return; // Already loaded

    try {
      const response = await fetch(`/api/workflows/executions/${executionId}/logs`);
      if (response.ok) {
        const data = await response.json();
        setLogs((prev) => ({ ...prev, [executionId]: Array.isArray(data) ? data : [] }));
      } else {
        setLogs((prev) => ({ ...prev, [executionId]: [] }));
      }
    } catch (error) {
      console.error('Failed to load execution logs:', error);
      setLogs((prev) => ({ ...prev, [executionId]: [] }));
    }
  };

  const toggleRun = async (executionId: string) => {
    const newExpanded = new Set(expandedRuns);
    if (newExpanded.has(executionId)) {
      newExpanded.delete(executionId);
    } else {
      newExpanded.add(executionId);
      await loadExecutionLogs(executionId);
    }
    setExpandedRuns(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-3 w-3 text-green-600" />;
      case 'error':
        return <XCircle className="h-3 w-3 text-red-600" />;
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin text-blue-600" />;
      default:
        return <Clock className="text-muted-foreground h-3 w-3" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground text-xs">Loading runs...</div>
      </div>
    );
  }

  if (executions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground text-xs">No runs yet</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {executions.map((execution) => {
        const isExpanded = expandedRuns.has(execution.id);
        const executionLogs = logs[execution.id] || [];

        return (
          <div key={execution.id} className="border-muted rounded-lg border">
            <div
              className="hover:bg-muted/50 flex w-full cursor-pointer items-center gap-2 p-2 transition-colors"
              onClick={() => toggleRun(execution.id)}
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              {getStatusIcon(execution.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">
                    {getRelativeTime(execution.startedAt)}
                  </span>
                  {execution.duration && (
                    <span className="text-muted-foreground text-xs">
                      {parseInt(execution.duration) < 1000
                        ? `${execution.duration}ms`
                        : `${(parseInt(execution.duration) / 1000).toFixed(2)}s`}
                    </span>
                  )}
                </div>
                {execution.error && (
                  <div className="truncate text-xs text-red-600">{execution.error}</div>
                )}
              </div>
            </div>

            {isExpanded && (
              <div className="border-muted border-t">
                {executionLogs.length === 0 ? (
                  <div className="text-muted-foreground px-2 py-2 text-xs">No steps recorded</div>
                ) : (
                  <div className="space-y-1 p-2">
                    {executionLogs.map((log) => (
                      <div key={log.id} className="hover:bg-muted/30 rounded px-2 py-1.5">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(log.status)}
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium">
                                {log.nodeName || log.nodeType}
                              </span>
                              {log.duration && (
                                <span className="text-muted-foreground text-xs">
                                  {parseInt(log.duration) < 1000
                                    ? `${log.duration}ms`
                                    : `${(parseInt(log.duration) / 1000).toFixed(2)}s`}
                                </span>
                              )}
                            </div>
                            <div className="text-muted-foreground text-xs">{log.nodeType}</div>
                            {log.error && (
                              <div className="mt-1 text-xs text-red-600">{log.error}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
