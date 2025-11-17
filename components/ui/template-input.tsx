"use client";

import { ComponentProps, forwardRef, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { formatTemplateForDisplay } from "@/lib/utils/template";

export interface TemplateInputProps
  extends Omit<ComponentProps<"input">, "onChange"> {
  value?: string;
  onChange?: (value: string) => void;
}

/**
 * An input component that displays templates in a human-friendly way
 * while storing them with node IDs internally.
 * 
 * Converts {{@nodeId:DisplayName.field}} to {{DisplayName.field}} for display
 */
const TemplateInput = forwardRef<HTMLInputElement, TemplateInputProps>(
  ({ className, value = "", onChange, onFocus, onBlur, ...props }, ref) => {
    const [isEditing, setIsEditing] = useState(false);
    const [internalValue, setInternalValue] = useState(value);
    const localRef = useRef<HTMLInputElement>(null);
    const inputRef = (ref as React.RefObject<HTMLInputElement>) || localRef;

    // Update internal value when prop changes
    useEffect(() => {
      setInternalValue(value);
    }, [value]);

    // Format for display when not editing
    const displayValue = isEditing ? internalValue : formatTemplateForDisplay(internalValue);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsEditing(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsEditing(false);
      onBlur?.(e);
      // Call onChange with the current internal value when blur happens
      if (onChange && internalValue !== value) {
        onChange(internalValue);
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInternalValue(newValue);
      onChange?.(newValue);
    };

    return (
      <input
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        onBlur={handleBlur}
        onChange={handleChange}
        onFocus={handleFocus}
        ref={inputRef}
        value={displayValue}
        {...props}
      />
    );
  }
);

TemplateInput.displayName = "TemplateInput";

export { TemplateInput };

