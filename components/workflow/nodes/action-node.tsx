"use client";

import type { NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";
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

// Helper to parse template variables and render them as badges
const parseTemplateContent = (text: string) => {
  if (!text) return null;

  // Match template patterns: {{@nodeId:DisplayName.field}} or {{@nodeId:DisplayName}}
  const pattern = /\{\{@([^:]+):([^}]+)\}\}/g;
  const parts: Array<{ type: "text" | "badge"; content: string }> = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    const [fullMatch, , displayPart] = match;
    const matchStart = match.index;

    // Add text before the template
    if (matchStart > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, matchStart),
      });
    }

    // Add badge for template
    parts.push({
      type: "badge",
      content: displayPart,
    });

    lastIndex = pattern.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex),
    });
  }

  // If no templates found, return plain text
  if (parts.length === 0) {
    return (
      <span className="truncate text-muted-foreground text-xs">{text}</span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1 text-muted-foreground text-xs">
      {parts.map((part, index) => {
        if (part.type === "badge") {
          return (
            <span
              className="inline-flex items-center gap-1 rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 font-mono text-blue-600 text-xs dark:text-blue-400"
              key={index}
            >
              {part.content}
            </span>
          );
        }
        return (
          <span className="truncate" key={index}>
            {part.content}
          </span>
        );
      })}
    </div>
  );
};

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
  };
  return integrationMap[actionType] || "System";
};

type ActionNodeProps = NodeProps & {
  data?: WorkflowNodeData;
};

export const ActionNode = memo(({ data, selected }: ActionNodeProps) => {
  if (!data) {
    return null;
  }

  const actionType = (data.config?.actionType as string) || "HTTP Request";
  const displayTitle = data.label || actionType;
  const displayDescription =
    data.description || getIntegrationFromActionType(actionType);

  // Determine what content to show based on action type
  const getContentField = () => {
    const config = data.config || {};

    switch (actionType) {
      case "HTTP Request":
        return config.endpoint ? `URL: ${config.endpoint}` : null;
      case "Database Query":
        return config.dbQuery ? `Query: ${config.dbQuery}` : null;
      case "Send Email":
        return config.emailTo ? `To: ${config.emailTo}` : null;
      case "Send Slack Message":
        return config.slackChannel ? `Channel: ${config.slackChannel}` : null;
      case "Create Ticket":
        return config.ticketTitle ? `Title: ${config.ticketTitle}` : null;
      case "Find Issues":
        return config.linearAssigneeId
          ? `Assignee: ${config.linearAssigneeId}`
          : null;
      case "Generate Text":
      case "Generate Image":
        return config.aiPrompt
          ? `Prompt: ${config.aiPrompt}`
          : config.imagePrompt
            ? `Prompt: ${config.imagePrompt}`
            : null;
      case "Execute Code":
        return config.code ? `Code: ${config.code}` : null;
      default:
        return null;
    }
  };

  const contentField = getContentField();
  const hasContent = !!contentField;

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
          <span className="flex size-9 items-center justify-center rounded-md bg-amber-600/25">
            <Zap className="size-4 text-amber-300" />
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
        <NodeContent>{parseTemplateContent(contentField)}</NodeContent>
      )}
    </Node>
  );
});

ActionNode.displayName = "ActionNode";
