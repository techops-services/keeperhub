"use client";

import type { NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AddNode({ data }: NodeProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-lg border-2 border-dashed border-border bg-background/50 p-8 backdrop-blur-sm">
      <div className="text-center">
        <h1 className="mb-2 font-bold text-3xl">Workflow Builder Template</h1>
        <p className="text-muted-foreground text-sm">
          Powered by{" "}
          <a
            href="https://useworkflow.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Workflow
          </a>
          ,{" "}
          <a
            href="https://ai-sdk.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            AI SDK
          </a>
          ,{" "}
          <a
            href="https://vercel.com/ai-gateway"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            AI Gateway
          </a>{" "}
          and{" "}
          <a
            href="https://ai-sdk.dev/elements"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            AI Elements
          </a>
        </p>
      </div>
      <Button
        className="h-14 gap-2 text-lg shadow-lg"
        onClick={data.onClick}
        size="lg"
      >
        <Plus className="h-5 w-5" />
        Add Node
      </Button>
    </div>
  );
}
