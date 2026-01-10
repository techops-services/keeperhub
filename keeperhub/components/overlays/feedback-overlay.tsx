"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Overlay } from "@/components/overlays/overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type FeedbackOverlayProps = {
  overlayId: string;
};

type FeedbackCategory = "bug" | "feature" | "question" | "feedback";

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "bug" },
  { value: "feature", label: "feature" },
  { value: "question", label: "question" },
  { value: "feedback", label: "feedback" },
];

export function FeedbackOverlay({ overlayId }: FeedbackOverlayProps) {
  const { closeAll } = useOverlay();
  const [message, setMessage] = useState("");
  const [categories, setCategories] = useState<FeedbackCategory[]>([]);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleCategory = (category: FeedbackCategory) => {
    setCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error("Please enter your feedback");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("message", message.trim());
      formData.append("categories", JSON.stringify(categories));
      if (screenshot) {
        formData.append("screenshot", screenshot);
      }

      const response = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit feedback");
      }

      await response.json();
      setSubmitted(true);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit feedback"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        return;
      }
      setScreenshot(file);
    }
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          setScreenshot(file);
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  // Success state
  if (submitted) {
    return (
      <Overlay
        actions={[{ label: "Done", onClick: closeAll }]}
        overlayId={overlayId}
        title="Thank you!"
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <CheckCircle2 className="size-12 text-green-500 mb-4" />
          <p className="text-muted-foreground mb-4">
            Your issue has been created and will help us improve
          </p>
          <a
            className="text-primary underline text-sm"
            href="https://github.com/techops-services/keeperhub/issues?q=is%3Aopen+is%3Aissue+label%3Auser-feedback"
            rel="noopener noreferrer"
            target="_blank"
          >
            View all open issues
          </a>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay
      actions={[
        { label: "Close", variant: "outline", onClick: closeAll },
        {
          label: submitting ? "Submitting..." : "Submit",
          onClick: handleSubmit,
          disabled: submitting || !message.trim(),
        },
      ]}
      overlayId={overlayId}
      title="Submit a new issue"
    >
      <Label className="-mt-2 mb-4 block text-sm font-medium">
        The issue will be visible in our public GitHub repository
      </Label>

      {submitting ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Message textarea */}
          <div className="space-y-2">
            <Textarea
              id="feedback-message"
              placeholder="Let us know what's on your mind..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Category pill buttons */}
          <div className="flex flex-wrap gap-2">
            {CATEGORY_OPTIONS.map((option) => {
              const isSelected = categories.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleCategory(option.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                    "border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    isSelected
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-foreground/70 border-border hover:bg-muted/80"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {/* Screenshot */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Screenshot (optional)</Label>
            {screenshot ? (
              <div className="relative rounded-md border bg-muted/50 p-2">
                <img
                  src={URL.createObjectURL(screenshot)}
                  alt="Screenshot preview"
                  className="max-h-32 rounded object-contain"
                />
                <button
                  type="button"
                  onClick={() => setScreenshot(null)}
                  className="absolute top-1 right-1 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
                >
                  <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <p className="mt-1 text-xs text-muted-foreground truncate">
                  {screenshot.name || "Pasted image"}
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-border bg-muted/30 p-4 text-center">
                <p className="text-sm text-foreground">
                  Paste screenshot with <kbd className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">⌘V</kbd>
                </p>
                <label
                  htmlFor="screenshot"
                  className="mt-2 inline-block text-xs text-muted-foreground hover:text-foreground cursor-pointer underline"
                >
                  or upload file
                </label>
                <input
                  id="screenshot"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </Overlay>
  );
}
