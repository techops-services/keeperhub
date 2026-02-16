"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown, Search, X } from "lucide-react";
import type { PublicTag } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const searchWrapperVariants = cva(
  "flex w-full items-center gap-2 rounded-md border border-input bg-transparent shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
  {
    variants: {
      size: {
        sm: "min-h-8 px-2.5 py-1 text-xs",
        default: "min-h-10 px-3 py-1 text-sm",
        lg: "min-h-12 px-4 py-2 text-base",
        xl: "min-h-14 px-5 py-3 text-lg",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

const iconSizeMap = {
  sm: "size-3",
  default: "size-4",
  lg: "size-5",
  xl: "size-6",
} as const;

type WorkflowSearchFilterProps = VariantProps<typeof searchWrapperVariants> & {
  triggers: string[];
  searchQuery: string;
  selectedTrigger: string | null;
  publicTags?: PublicTag[];
  selectedTagSlugs?: string[];
  onSearchChange: (query: string) => void;
  onTriggerChange: (trigger: string | null) => void;
  onTagToggle?: (slug: string) => void;
};

export function WorkflowSearchFilter({
  triggers,
  searchQuery,
  selectedTrigger,
  publicTags = [],
  selectedTagSlugs = [],
  size = "default",
  onSearchChange,
  onTriggerChange,
  onTagToggle,
}: WorkflowSearchFilterProps) {
  const sizeKey = size ?? "default";
  const iconSize = iconSizeMap[sizeKey];

  return (
    <div className="flex flex-col gap-4">
      <div className={searchWrapperVariants({ size })}>
        <input
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search workflows..."
          type="text"
          value={searchQuery}
        />
        {searchQuery && (
          <button
            aria-label="Clear search"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onSearchChange("")}
            type="button"
          >
            <X className={iconSize} />
          </button>
        )}
        <Search className={cn(iconSize, "text-muted-foreground")} />
      </div>

      {triggers.length > 0 && (
        <div>
          <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Trigger
          </p>
          <div className="relative">
            <select
              className={cn(
                "w-full appearance-none rounded-md border border-input bg-transparent pr-8 shadow-xs transition-colors focus:border-ring focus:outline-none focus:ring-[3px] focus:ring-ring/50",
                sizeKey === "sm" && "min-h-8 px-2.5 py-1 text-xs",
                sizeKey === "default" && "min-h-10 px-3 py-1 text-sm",
                sizeKey === "lg" && "min-h-12 px-4 py-2 text-base",
                sizeKey === "xl" && "min-h-14 px-5 py-3 text-lg",
                selectedTrigger ? "text-foreground" : "text-muted-foreground"
              )}
              onChange={(e) => onTriggerChange(e.target.value || null)}
              value={selectedTrigger ?? ""}
            >
              <option value="">All triggers</option>
              {triggers.map((trigger) => (
                <option key={trigger} value={trigger}>
                  {trigger}
                </option>
              ))}
            </select>
            <ChevronDown
              className={cn(
                iconSize,
                "-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-muted-foreground"
              )}
            />
          </div>
        </div>
      )}

      {publicTags.length > 0 && onTagToggle && (
        <div>
          <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Tags
          </p>
          <div className="flex flex-wrap gap-1.5">
            {publicTags.map((tag) => {
              const isSelected = selectedTagSlugs.includes(tag.slug);
              return (
                <button
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs transition-colors",
                    "border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted text-foreground/70 hover:bg-muted/80"
                  )}
                  key={tag.slug}
                  onClick={() => onTagToggle(tag.slug)}
                  type="button"
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
