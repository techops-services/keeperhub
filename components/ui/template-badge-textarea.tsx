"use client";

import { useAtom } from "jotai";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { selectedNodeAtom } from "@/lib/workflow-store";
import { TemplateAutocomplete } from "./template-autocomplete";

export interface TemplateBadgeTextareaProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  rows?: number;
}

/**
 * A textarea component that renders template variables as styled badges
 * Converts {{@nodeId:DisplayName.field}} to badges showing "DisplayName.field"
 */
export function TemplateBadgeTextarea({
  value = "",
  onChange,
  placeholder,
  disabled,
  className,
  id,
  rows = 3,
}: TemplateBadgeTextareaProps) {
  const [isFocused, setIsFocused] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [internalValue, setInternalValue] = useState(value);
  const shouldUpdateDisplay = useRef(true);
  const [selectedNodeId] = useAtom(selectedNodeAtom);
  
  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
  const [autocompleteFilter, setAutocompleteFilter] = useState("");
  const [atSignPosition, setAtSignPosition] = useState<number | null>(null);

  // Update internal value when prop changes from outside
  useEffect(() => {
    if (value !== internalValue && !isFocused) {
      setInternalValue(value);
      shouldUpdateDisplay.current = true;
    }
  }, [value]);

  // Parse text and render with badges
  const updateDisplay = () => {
    if (!contentRef.current || !shouldUpdateDisplay.current) return;

    const container = contentRef.current;
    const text = internalValue || "";

    // Clear current content
    container.innerHTML = "";

    if (!text && !isFocused) {
      // Show placeholder
      container.innerHTML = `<span class="text-muted-foreground pointer-events-none">${placeholder || ""}</span>`;
      return;
    }

    // Match template patterns: {{@nodeId:DisplayName.field}} or {{@nodeId:DisplayName}}
    const pattern = /\{\{@([^:]+):([^}]+)\}\}/g;
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const [fullMatch, , displayPart] = match;
      const matchStart = match.index;

      // Add text before the template (preserving line breaks)
      if (matchStart > lastIndex) {
        const textBefore = text.slice(lastIndex, matchStart);
        addTextWithLineBreaks(container, textBefore);
      }

      // Create badge for template
      const badge = document.createElement("span");
      badge.className =
        "inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-600 dark:text-blue-400 font-mono text-xs border border-blue-500/20 mx-0.5";
      badge.contentEditable = "false";
      badge.setAttribute("data-template", fullMatch);
      badge.textContent = displayPart;
      container.appendChild(badge);

      lastIndex = pattern.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const textAfter = text.slice(lastIndex);
      addTextWithLineBreaks(container, textAfter);
    }

    // If empty and focused, ensure we can type
    if (container.innerHTML === "" && isFocused) {
      container.innerHTML = "<br>";
    }

    shouldUpdateDisplay.current = false;
  };

  // Helper to add text with line breaks preserved
  const addTextWithLineBreaks = (container: HTMLElement, text: string) => {
    const lines = text.split("\n");
    lines.forEach((line, index) => {
      if (line) {
        container.appendChild(document.createTextNode(line));
      }
      if (index < lines.length - 1) {
        container.appendChild(document.createElement("br"));
      }
    });
  };

  // Extract plain text from content
  const extractValue = (): string => {
    if (!contentRef.current) return "";

    let result = "";
    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null
    );

    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) {
        result += node.textContent;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const element = node as HTMLElement;
        const template = element.getAttribute("data-template");
        if (template) {
          result += template;
        } else if (element.tagName === "BR") {
          result += "\n";
        }
      }
    }

    return result;
  };

  const handleInput = () => {
    // Extract the value from DOM
    const newValue = extractValue();
    
    // Check if the value has changed
    if (newValue === internalValue) {
      // No change, ignore (this can happen with badge clicks, etc)
      return;
    }
    
    // Check if a template was just inserted (contains the template pattern)
    const hasTemplate = /\{\{@([^:]+):([^}]+)\}\}/g.test(newValue);
    const hadTemplate = /\{\{@([^:]+):([^}]+)\}\}/g.test(internalValue);
    
    if (hasTemplate && !hadTemplate) {
      // A template was just inserted for the first time, update display to show badge
      setInternalValue(newValue);
      onChange?.(newValue);
      shouldUpdateDisplay.current = true;
      setShowAutocomplete(false);
      
      // Call updateDisplay synchronously to render badges immediately
      requestAnimationFrame(() => updateDisplay());
      return;
    }
    
    if (hadTemplate) {
      // We already have badges - need to extract carefully and update
      setInternalValue(newValue);
      onChange?.(newValue);
      shouldUpdateDisplay.current = true;
      
      // Update display on next frame to avoid fighting with browser
      requestAnimationFrame(() => updateDisplay());
      return;
    }
    
    // Normal typing (no badges present)
    setInternalValue(newValue);
    onChange?.(newValue);
    
    // Check for @ sign to show autocomplete
    const lastAtSign = newValue.lastIndexOf("@");
    
    if (lastAtSign !== -1) {
      const filter = newValue.slice(lastAtSign + 1);
      
      if (!filter.includes(" ") && !filter.includes("\n")) {
        setAutocompleteFilter(filter);
        setAtSignPosition(lastAtSign);
        
        if (contentRef.current) {
          const textareaRect = contentRef.current.getBoundingClientRect();
          const position = {
            top: textareaRect.bottom + window.scrollY + 4,
            left: textareaRect.left + window.scrollX,
          };
          setAutocompletePosition(position);
        }
        setShowAutocomplete(true);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  };

  const handleAutocompleteSelect = (template: string) => {
    if (!contentRef.current || atSignPosition === null) return;
    
    // Get current text
    const currentText = extractValue();
    
    // Replace from @ position to end of filter with the template
    const beforeAt = currentText.slice(0, atSignPosition);
    const afterFilter = currentText.slice(atSignPosition + 1 + autocompleteFilter.length);
    const newText = beforeAt + template + afterFilter;
    
    console.log("[Textarea] Autocomplete select:", {
      currentText,
      atSignPosition,
      filter: autocompleteFilter,
      template,
      beforeAt,
      afterFilter,
      newText
    });
    
    setInternalValue(newText);
    onChange?.(newText);
    shouldUpdateDisplay.current = true;
    
    // Force immediate display update
    setTimeout(() => {
      updateDisplay();
    }, 0);
    
    setShowAutocomplete(false);
    setAtSignPosition(null);
    
    // Focus back on the textarea after a short delay to allow DOM to update
    setTimeout(() => {
      contentRef.current?.focus();
    }, 10);
  };

  const handleFocus = () => {
    setIsFocused(true);
    shouldUpdateDisplay.current = true;
  };

  const handleBlur = () => {
    // Delay to allow autocomplete click to register
    setTimeout(() => {
      setIsFocused(false);
      // Don't extract value on blur - it's already in sync from handleInput
      // Just trigger a display update to ensure everything renders correctly
      shouldUpdateDisplay.current = true;
      setShowAutocomplete(false);
    }, 200);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Enter key to insert line breaks
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertLineBreak");
    }
  };

  // Update display only when needed (not while typing)
  useEffect(() => {
    if (shouldUpdateDisplay.current) {
      updateDisplay();
    }
  }, [internalValue, isFocused]);

  // Calculate min height based on rows
  const minHeight = `${rows * 1.5}rem`;

  return (
    <>
      <div
        className={cn(
          "flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-within:outline-none focus-within:ring-1 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        style={{ minHeight }}
      >
        <div
          className="w-full outline-none whitespace-pre-wrap break-words"
          contentEditable={!disabled}
          id={id}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          ref={contentRef}
          role="textbox"
          suppressContentEditableWarning
        />
      </div>
      
      <TemplateAutocomplete
        currentNodeId={selectedNodeId || undefined}
        filter={autocompleteFilter}
        isOpen={showAutocomplete}
        onClose={() => setShowAutocomplete(false)}
        onSelect={handleAutocompleteSelect}
        position={autocompletePosition}
      />
    </>
  );
}

