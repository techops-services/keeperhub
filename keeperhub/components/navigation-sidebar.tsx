"use client";

import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Globe,
  List,
  Plus,
} from "lucide-react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const COLLAPSED_WIDTH = 60;
const EXPANDED_WIDTH = 200;
const SNAP_THRESHOLD = (COLLAPSED_WIDTH + EXPANDED_WIDTH) / 2;

const NAV_ITEMS = [
  { id: "new", icon: Plus, label: "New Workflow", href: "/" },
  { id: "workflows", icon: List, label: "All Workflows", href: "/workflows" },
  { id: "hub", icon: Globe, label: "Hub", href: "/hub" },
  { id: "analytics", icon: BarChart3, label: "Analytics", href: null },
] as const;

export function NavigationSidebar(): React.ReactNode {
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const [expanded, setExpanded] = useState(false);
  const [dragWidth, setDragWidth] = useState<number | null>(null);
  const isDragging = useRef(false);

  const workflowId =
    typeof params.workflowId === "string" ? params.workflowId : undefined;
  const isHubPage = pathname === "/hub";
  const isWorkflowsPage = pathname === "/workflows";

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      setDragWidth(expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH);

      const handleMouseMove = (moveEvent: MouseEvent): void => {
        if (!isDragging.current) {
          return;
        }
        const newWidth = Math.min(
          EXPANDED_WIDTH,
          Math.max(COLLAPSED_WIDTH, moveEvent.clientX)
        );
        setDragWidth(newWidth);
      };

      const handleMouseUp = (upEvent: MouseEvent): void => {
        isDragging.current = false;
        const finalX = Math.min(
          EXPANDED_WIDTH,
          Math.max(COLLAPSED_WIDTH, upEvent.clientX)
        );
        setExpanded(finalX >= SNAP_THRESHOLD);
        setDragWidth(null);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [expanded]
  );

  if (isMobile) {
    return null;
  }

  function isActive(id: string): boolean {
    if (id === "new") {
      return !(workflowId || isHubPage || isWorkflowsPage);
    }
    if (id === "workflows") {
      return isWorkflowsPage;
    }
    if (id === "hub") {
      return isHubPage;
    }
    return false;
  }

  const currentWidth =
    dragWidth ?? (expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH);
  const showLabels = currentWidth >= SNAP_THRESHOLD;

  return (
    <div
      className={cn(
        "pointer-events-auto fixed top-[60px] bottom-0 left-0 z-40 flex flex-col bg-background",
        dragWidth === null && "transition-[width] duration-200 ease-out"
      )}
      style={{ width: currentWidth }}
    >
      <nav className="flex flex-1 flex-col gap-1 overflow-hidden px-2.5 pt-3">
        {NAV_ITEMS.map((item) => {
          const disabled = item.href === null;
          const active = isActive(item.id);

          const button = (
            <button
              className={cn(
                "flex h-9 w-full items-center rounded-md transition-colors",
                showLabels ? "gap-3 px-2" : "justify-center",
                disabled
                  ? "cursor-default text-muted-foreground"
                  : "hover:bg-muted",
                active && !disabled && "bg-muted"
              )}
              key={item.id}
              onClick={disabled ? undefined : () => router.push(item.href)}
              type="button"
            >
              <item.icon className="size-4 shrink-0" />
              {showLabels && (
                <span className="truncate text-sm">{item.label}</span>
              )}
            </button>
          );

          if (showLabels && !disabled) {
            return button;
          }

          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right">
                {disabled ? "Coming Soon" : item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* Resize handle */}
      {/* biome-ignore lint/a11y/useSemanticElements: custom resize handle */}
      <div
        aria-orientation="vertical"
        aria-valuenow={currentWidth}
        className="group absolute inset-y-0 right-0 z-10 w-3 cursor-col-resize"
        onMouseDown={handleResizeStart}
        role="separator"
        tabIndex={0}
      >
        <div className="absolute inset-y-0 right-0 w-px bg-border transition-colors group-hover:w-1 group-hover:bg-blue-500 group-active:w-1 group-active:bg-blue-600" />
        {dragWidth === null && (
          <button
            className="absolute top-1/2 right-0 flex size-6 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background opacity-0 shadow-sm transition-opacity hover:bg-muted group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            type="button"
          >
            {expanded ? (
              <ChevronLeft className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
