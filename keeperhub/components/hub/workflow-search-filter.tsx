"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown, Search, X } from "lucide-react";
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
  protocols: string[];
  triggers: string[];
  searchQuery: string;
  selectedCategories: Set<string>;
  selectedProtocols: Set<string>;
  selectedTrigger: string | null;
  onSearchChange: (query: string) => void;
  onCategoriesChange: (categories: Set<string>) => void;
  onProtocolsChange: (protocols: Set<string>) => void;
  onTriggerChange: (trigger: string | null) => void;
};

function toggleInSet(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

export function WorkflowSearchFilter({
  categories,
  protocols,
  triggers,
  searchQuery,
  selectedCategories,
  selectedProtocols,
  selectedTrigger,
  size = "default",
  onSearchChange,
  onCategoriesChange,
  onProtocolsChange,
  onTriggerChange,
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

      {protocols.length > 0 && (
        <div>
          <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Protocol
          </p>
          <div className="flex flex-wrap gap-2">
            {protocols.map((protocol) => (
              <button
                className={cn(
                  pillVariants({ size }),
                  selectedProtocols.has(protocol)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                key={protocol}
                onClick={() =>
                  onProtocolsChange(toggleInSet(selectedProtocols, protocol))
                }
                type="button"
              >
                {protocol}
              </button>
            ))}
          </div>
        </div>
      )}

      {categories.length > 0 && (
        <div>
          <p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
            Category
          </p>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                className={cn(
                  pillVariants({ size }),
                  selectedCategories.has(category)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
                key={category}
                onClick={() =>
                  onCategoriesChange(toggleInSet(selectedCategories, category))
                }
                type="button"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

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
                "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
