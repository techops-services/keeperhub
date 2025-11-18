"use client";

import type { NodeProps } from "@xyflow/react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

type AddNodeData = {
  onClick?: () => void;
};

export function AddNode({ data }: NodeProps & { data?: AddNodeData }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 rounded-lg border-2 border-border border-dashed bg-background/50 p-8 backdrop-blur-sm">
      <div className="text-center">
        <h1 className="mb-2 font-bold text-3xl">Workflow Builder Template</h1>
        <p className="text-muted-foreground text-sm">
          Powered by{" "}
          <a
            className="underline hover:text-foreground"
            href="https://useworkflow.dev/"
            rel="noopener noreferrer"
            target="_blank"
          >
            Workflow
          </a>
          ,{" "}
          <a
            className="underline hover:text-foreground"
            href="https://ai-sdk.dev/"
            rel="noopener noreferrer"
            target="_blank"
          >
            AI SDK
          </a>
          ,{" "}
          <a
            className="underline hover:text-foreground"
            href="https://vercel.com/ai-gateway"
            rel="noopener noreferrer"
            target="_blank"
          >
            AI Gateway
          </a>{" "}
          and{" "}
          <a
            className="underline hover:text-foreground"
            href="https://ai-sdk.dev/elements"
            rel="noopener noreferrer"
            target="_blank"
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
