"use client";

import type { NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { memo } from "react";
import {
  Node,
  NodeContent,
  NodeDescription,
  NodeHeader,
  NodeTitle,
} from "@/components/ai-elements/node";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "@/lib/workflow-store";

type ConditionNodeProps = NodeProps & {
  data?: WorkflowNodeData;
};

export const ConditionNode = memo(({ data, selected }: ConditionNodeProps) => {
  if (!data) {
    return null;
  }

  const condition = (data.config?.condition as string) || "If true";
  const displayTitle = data.label || condition;
  const displayDescription = data.description || "Condition";
  const hasContent = !!condition;

  return (
    <Node
      className={cn(
        "shadow-none",
        selected &&
          "rounded-md ring ring-primary/50 transition-all duration-150 ease-out"
      )}
      handles={{ target: true, source: true }}
    >
      <NodeHeader>
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-md bg-pink-500/25">
            <GitBranch className="size-4.5 text-pink-400" />
          </span>
          <div className="flex flex-col gap-0.5">
            <NodeTitle>{displayTitle}</NodeTitle>
            {displayDescription && (
              <NodeDescription>{displayDescription}</NodeDescription>
            )}
          </div>
        </div>
      </NodeHeader>
      {hasContent && (
        <NodeContent>
          <div className="truncate text-muted-foreground text-xs">
            {condition}
          </div>
        </NodeContent>
      )}
    </Node>
  );
});

ConditionNode.displayName = "ConditionNode";
