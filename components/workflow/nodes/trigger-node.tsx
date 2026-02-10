"use client";

import type { NodeProps } from "@xyflow/react";
import { Box, Boxes, Check, Clock, Play, Webhook, XCircle } from "lucide-react";
import { type ElementType, memo } from "react";
import {
  Node,
  NodeDescription,
  NodeTitle,
} from "@/components/ai-elements/node";
import { cn } from "@/lib/utils";
import type {
  WorkflowNodeData,
  WorkflowTriggerType,
} from "@/lib/workflow-store";
import { WorkflowTriggerEnum } from "@/lib/workflow-store";

type TriggerNodeProps = NodeProps & {
  data?: WorkflowNodeData;
};

export const TriggerNode = memo(({ data, selected }: TriggerNodeProps) => {
  if (!data) {
    return null;
  }

  const triggerType = (data.config?.triggerType as string) || "Manual";
  const displayTitle = data.label || triggerType;
  const displayDescription = data.description || "Trigger";
  const status = data.status;

  // Select icon based on trigger type
  const triggerIcons: Record<WorkflowTriggerType, ElementType> = {
    [WorkflowTriggerEnum.MANUAL]: Play,
    [WorkflowTriggerEnum.SCHEDULE]: Clock,
    [WorkflowTriggerEnum.WEBHOOK]: Webhook,
    [WorkflowTriggerEnum.EVENT]: Boxes, // keeperhub custom field //
    [WorkflowTriggerEnum.BLOCK]: Box, // keeperhub custom field //
  };

  const TriggerIcon = triggerIcons[triggerType as WorkflowTriggerType] || Play;

  return (
    <Node
      className={cn(
        "flex h-48 w-48 flex-col items-center justify-center shadow-none transition-all duration-150 ease-out",
        selected && "border-primary"
      )}
      handles={{ target: false, source: true }}
      status={status}
    >
      {/* Status indicator badge in top right */}
      {status && status !== "idle" && status !== "running" && (
        <div
          className={cn(
            "absolute top-2 right-2 rounded-full p-1",
            status === "success" && "bg-green-500/50",
            status === "error" && "bg-red-500/50"
          )}
        >
          {status === "success" && (
            <Check className="size-3.5 text-white" strokeWidth={2.5} />
          )}
          {status === "error" && (
            <XCircle className="size-3.5 text-white" strokeWidth={2.5} />
          )}
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-3 p-6">
        <TriggerIcon className="size-12 text-blue-500" strokeWidth={1.5} />
        <div className="flex flex-col items-center gap-1 text-center">
          <NodeTitle className="text-base">{displayTitle}</NodeTitle>
          {displayDescription && (
            <NodeDescription className="line-clamp-2 text-xs">
              {displayDescription}
            </NodeDescription>
          )}
        </div>
      </div>
    </Node>
  );
});

TriggerNode.displayName = "TriggerNode";
