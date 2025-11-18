"use client";

import type { NodeProps } from "@xyflow/react";
import { Code, Database, GitBranch, Zap } from "lucide-react";
import { memo } from "react";
import {
  Node,
  NodeDescription,
  NodeTitle,
} from "@/components/ai-elements/node";
import { IntegrationIcon } from "@/components/ui/integration-icon";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "@/lib/workflow-store";

// Helper to get integration name from action type
const getIntegrationFromActionType = (actionType: string): string => {
  const integrationMap: Record<string, string> = {
    "Send Email": "Resend",
    "Send Slack Message": "Slack",
    "Create Ticket": "Linear",
    "Find Issues": "Linear",
    "HTTP Request": "System",
    "Database Query": "System",
    "Generate Text": "AI Gateway",
    "Generate Image": "AI Gateway",
    Condition: "Condition",
  };
  return integrationMap[actionType] || "System";
};

// Helper to get provider logo for action type
const getProviderLogo = (actionType: string) => {
  switch (actionType) {
    case "Send Email":
      return <IntegrationIcon className="size-12" integration="resend" />;
    case "Send Slack Message":
      return <IntegrationIcon className="size-12" integration="slack" />;
    case "Create Ticket":
    case "Find Issues":
      return <IntegrationIcon className="size-12" integration="linear" />;
    case "HTTP Request":
      return <Zap className="size-12 text-amber-300" strokeWidth={1.5} />;
    case "Database Query":
      return <Database className="size-12 text-blue-300" strokeWidth={1.5} />;
    case "Generate Text":
    case "Generate Image":
      return <IntegrationIcon className="size-12" integration="vercel" />;
    case "Execute Code":
      return <Code className="size-12 text-green-300" strokeWidth={1.5} />;
    case "Condition":
      return <GitBranch className="size-12 text-pink-300" strokeWidth={1.5} />;
    default:
      return <Zap className="size-12 text-amber-300" strokeWidth={1.5} />;
  }
};

type ActionNodeProps = NodeProps & {
  data?: WorkflowNodeData;
};

export const ActionNode = memo(({ data, selected }: ActionNodeProps) => {
  if (!data) {
    return null;
  }

  const actionType = (data.config?.actionType as string) || "";

  // Handle empty action type (new node without selected action)
  if (!actionType) {
    return (
      <Node
        className={cn(
          "flex h-48 w-48 flex-col items-center justify-center shadow-none transition-all duration-150 ease-out",
          selected && "border-primary"
        )}
        handles={{ target: true, source: true }}
      >
        <div className="flex flex-col items-center justify-center gap-3 p-6">
          <Zap className="size-12 text-muted-foreground" strokeWidth={1.5} />
          <div className="flex flex-col items-center gap-1 text-center">
            <NodeTitle className="text-base">
              {data.label || "Action"}
            </NodeTitle>
            <NodeDescription className="text-xs">
              Select an action
            </NodeDescription>
          </div>
        </div>
      </Node>
    );
  }

  const displayTitle = data.label || actionType;
  const displayDescription =
    data.description || getIntegrationFromActionType(actionType);

  return (
    <Node
      className={cn(
        "flex h-48 w-48 flex-col items-center justify-center shadow-none transition-all duration-150 ease-out",
        selected && "border-primary"
      )}
      handles={{ target: true, source: true }}
    >
      <div className="flex flex-col items-center justify-center gap-3 p-6">
        {getProviderLogo(actionType)}
        <div className="flex flex-col items-center gap-1 text-center">
          <NodeTitle className="text-base">{displayTitle}</NodeTitle>
          {displayDescription && (
            <NodeDescription className="text-xs">
              {displayDescription}
            </NodeDescription>
          )}
        </div>
      </div>
    </Node>
  );
});

ActionNode.displayName = "ActionNode";
