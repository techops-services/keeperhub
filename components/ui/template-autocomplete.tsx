"use client";

import { useAtom } from "jotai";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { edgesAtom, nodesAtom, type WorkflowNode } from "@/lib/workflow-store";

type TemplateAutocompleteProps = {
  isOpen: boolean;
  position: { top: number; left: number };
  onSelect: (template: string) => void;
  onClose: () => void;
  currentNodeId?: string;
  filter?: string;
};

// Helper to get a display name for a node
const getNodeDisplayName = (node: WorkflowNode): string => {
  if (node.data.label) {
    return node.data.label;
  }

  if (node.data.type === "action") {
    const actionType = node.data.config?.actionType as string | undefined;
    return actionType || "HTTP Request";
  }

  if (node.data.type === "trigger") {
    const triggerType = node.data.config?.triggerType as string | undefined;
    return triggerType || "Manual";
  }

  if (node.data.type === "condition") {
    return "Condition";
  }

  if (node.data.type === "transform") {
    return "Transform";
  }

  return "Node";
};

// Get common fields based on node action type
const getCommonFields = (node: WorkflowNode) => {
  const actionType = node.data.config?.actionType;

  if (actionType === "Find Issues") {
    return [
      { field: "issues", description: "Array of issues found" },
      { field: "count", description: "Number of issues" },
    ];
  }
  if (actionType === "Send Email") {
    return [
      { field: "id", description: "Email ID" },
      { field: "status", description: "Send status" },
    ];
  }
  if (actionType === "Create Ticket") {
    return [
      { field: "id", description: "Ticket ID" },
      { field: "url", description: "Ticket URL" },
      { field: "number", description: "Ticket number" },
    ];
  }
  if (actionType === "HTTP Request") {
    return [
      { field: "data", description: "Response data" },
      { field: "status", description: "HTTP status code" },
    ];
  }
  if (actionType === "Generate Text") {
    return [
      { field: "text", description: "Generated text" },
      { field: "model", description: "Model used" },
    ];
  }
  if (actionType === "Generate Image") {
    return [
      { field: "base64", description: "Base64 image data" },
      { field: "model", description: "Model used" },
    ];
  }
  if (node.data.type === "trigger") {
    return [
      { field: "triggered", description: "Trigger status" },
      { field: "timestamp", description: "Trigger timestamp" },
      { field: "input", description: "Input data" },
    ];
  }

  return [{ field: "data", description: "Output data" }];
};

export function TemplateAutocomplete({
  isOpen,
  position,
  onSelect,
  onClose,
  currentNodeId,
  filter = "",
}: TemplateAutocompleteProps) {
  const [nodes] = useAtom(nodesAtom);
  const [edges] = useAtom(edgesAtom);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Ensure we're mounted before trying to use portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Find all nodes that come before the current node
  const getUpstreamNodes = () => {
    if (!currentNodeId) {
      return [];
    }

    const visited = new Set<string>();
    const upstream: string[] = [];

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) {
        return;
      }
      visited.add(nodeId);

      const incomingEdges = edges.filter((edge) => edge.target === nodeId);
      for (const edge of incomingEdges) {
        upstream.push(edge.source);
        traverse(edge.source);
      }
    };

    traverse(currentNodeId);

    return nodes.filter((node) => upstream.includes(node.id));
  };

  const upstreamNodes = getUpstreamNodes();

  // Build list of all available options (nodes + their fields)
  const options: Array<{
    type: "node" | "field";
    nodeId: string;
    nodeName: string;
    field?: string;
    description?: string;
    template: string;
  }> = [];

  for (const node of upstreamNodes) {
    const nodeName = getNodeDisplayName(node);
    const fields = getCommonFields(node);

    // Add node itself
    options.push({
      type: "node",
      nodeId: node.id,
      nodeName,
      template: `{{@${node.id}:${nodeName}}}`,
    });

    // Add fields
    for (const field of fields) {
      options.push({
        type: "field",
        nodeId: node.id,
        nodeName,
        field: field.field,
        description: field.description,
        template: `{{@${node.id}:${nodeName}.${field.field}}}`,
      });
    }
  }

  // Filter options based on search term
  const filteredOptions = filter
    ? options.filter(
        (opt) =>
          opt.nodeName.toLowerCase().includes(filter.toLowerCase()) ||
          (opt.field && opt.field.toLowerCase().includes(filter.toLowerCase()))
      )
    : options;

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredOptions[selectedIndex]) {
            onSelect(filteredOptions[selectedIndex].template);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredOptions, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (menuRef.current) {
      const selectedElement = menuRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen || filteredOptions.length === 0 || !mounted) {
    return null;
  }

  // Ensure position is within viewport
  const adjustedPosition = {
    top: Math.min(position.top, window.innerHeight - 300), // Keep 300px from bottom
    left: Math.min(position.left, window.innerWidth - 320), // Keep menu (320px wide) within viewport
  };

  const menuContent = (
    <div
      className="fixed z-[9999] w-80 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
      ref={menuRef}
      style={{
        top: `${adjustedPosition.top}px`,
        left: `${adjustedPosition.left}px`,
      }}
    >
      <div className="max-h-60 overflow-y-auto">
        {filteredOptions.map((option, index) => (
          <div
            className={cn(
              "flex cursor-pointer items-center justify-between rounded px-2 py-1.5 text-sm transition-colors",
              index === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
            key={`${option.nodeId}-${option.field || "root"}`}
            onClick={() => onSelect(option.template)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="flex-1">
              <div className="font-medium">
                {option.type === "node" ? (
                  option.nodeName
                ) : (
                  <>
                    <span className="text-muted-foreground">
                      {option.nodeName}.
                    </span>
                    {option.field}
                  </>
                )}
              </div>
              {option.description && (
                <div className="text-muted-foreground text-xs">
                  {option.description}
                </div>
              )}
            </div>
            {index === selectedIndex && <Check className="h-4 w-4" />}
          </div>
        ))}
      </div>
    </div>
  );

  // Use portal to render at document root to avoid clipping issues
  return createPortal(menuContent, document.body);
}

