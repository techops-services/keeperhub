"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const searchWrapperVariants = cva(
  "flex w-full max-w-xl items-center gap-2 rounded-md border border-input bg-transparent shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
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

const smallIconSizeMap = {
  sm: "size-2.5",
  default: "size-3",
  lg: "size-3",
  xl: "size-4",
} as const;

const pillVariants = cva(
  "inline-flex items-center rounded-full border font-medium transition-colors",
  {
    variants: {
      size: {
        sm: "px-2 py-0.5 text-xs",
        default: "px-3 py-1 text-xs",
        lg: "px-4 py-1.5 text-sm",
        xl: "px-5 py-2 text-base",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
);

type WorkflowSearchFilterProps = VariantProps<typeof searchWrapperVariants> & {
  categories: string[];
  searchQuery: string;
  selectedCategory: string | null;
  onSearchChange: (query: string) => void;
  onCategoryChange: (category: string | null) => void;
};

export function WorkflowSearchFilter({
  categories,
  searchQuery,
  selectedCategory,
  size = "default",
  onSearchChange,
  onCategoryChange,
}: WorkflowSearchFilterProps) {
  const sizeKey = size ?? "default";
  const iconSize = iconSizeMap[sizeKey];
  const smallIconSize = smallIconSizeMap[sizeKey];

  return (
    <div className="mb-16 flex flex-col items-center pt-8">
      <h1 className="mb-12 max-w-2xl text-center font-bold text-5xl">
        Explore KeeperHub Web3 Automation Ecosystem
      </h1>
      <div className="w-full max-w-xl">
        {/* Search input with category chip */}
        <div className={searchWrapperVariants({ size })}>
          {selectedCategory && (
            <Badge className="shrink-0 gap-1 border-0 bg-muted/50 pr-1" variant="outline">
              {selectedCategory}
              <button
                aria-label="Remove category filter"
                className="ml-1 rounded-full p-0.5 opacity-70 hover:opacity-100"
                onClick={() => onCategoryChange(null)}
                type="button"
              >
                <X className={smallIconSize} />
              </button>
            </Badge>
          )}
          <input
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={
              selectedCategory
                ? "Filter within category..."
                : "Search workflows..."
            }
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

        {/* Category pills */}
        {categories.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className={cn(
                pillVariants({ size }),
                selectedCategory === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              onClick={() => onCategoryChange(null)}
              type="button"
            >
              All
            </button>
            {categories.map((category) => (
              <button
                className={cn(
                  pillVariants({ size }),
                  selectedCategory === category
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                key={category}
                onClick={() => onCategoryChange(category)}
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
