"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const FLYOUT_WIDTH = 280;
export const STRIP_WIDTH = 32;

type FlyoutPanelProps = {
  state: "open" | "collapsed" | "closed";
  leftOffset: number;
  title: string;
  collapsedLabel?: string;
  onCollapse: () => void;
  onExpand: () => void;
  children: React.ReactNode;
};

export function FlyoutPanel({
  state,
  leftOffset,
  title,
  collapsedLabel,
  onCollapse,
  onExpand,
  children,
}: FlyoutPanelProps): React.ReactNode {
  if (state === "closed") {
    return null;
  }

  if (state === "collapsed") {
    return (
      <button
        className="pointer-events-auto fixed top-[60px] bottom-0 z-30 flex items-center justify-center border-r bg-background transition-[left] duration-200 ease-out hover:bg-muted"
        data-flyout
        onClick={onExpand}
        style={{ left: leftOffset, width: STRIP_WIDTH }}
        type="button"
      >
        <div className="flex flex-col items-center gap-1">
          <ChevronRight className="size-3.5 text-muted-foreground" />
          <span
            className="max-h-[120px] overflow-hidden text-muted-foreground text-xs"
            style={{ writingMode: "vertical-lr" }}
          >
            {collapsedLabel ?? title}
          </span>
        </div>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-auto fixed top-[60px] bottom-0 z-30 border-r bg-background shadow-lg transition-[left] duration-200 ease-out",
        "animate-[flyout-in_150ms_ease-out_forwards]"
      )}
      data-flyout
      role="menu"
      style={{ left: leftOffset, width: FLYOUT_WIDTH }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-medium text-sm">{title}</span>
          <button
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={onCollapse}
            title="Collapse"
            type="button"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">{children}</div>
      </div>
    </div>
  );
}
