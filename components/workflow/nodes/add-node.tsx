"use client";

import type { NodeProps } from "@xyflow/react";
import { LayoutTemplate, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
// start custom keeperhub code //
import { useOverlay } from "@/components/overlays/overlay-provider";
import { FeaturedOverlay } from "@/keeperhub/components/overlays/featured-overlay";
// end keeperhub code //
import { getAppName, getCustomLogo } from "@/lib/extension-registry";

type AddNodeData = {
  onClick?: () => void;
};

export function AddNode({ data }: NodeProps & { data?: AddNodeData }) {
  const CustomLogo = getCustomLogo();
  const appName = getAppName();
  // start custom keeperhub code //
  const { open } = useOverlay();

  const handleOpenFeatured = () => {
    open(FeaturedOverlay, {}, { size: "full" });
  };
  // end keeperhub code //

  return (
    <div className="flex flex-col items-center justify-center gap-8 rounded-lg border border-border border-dashed bg-background/50 p-8 backdrop-blur-sm">
      <div className="text-center">
        <h1 className="mb-2 flex items-center justify-center gap-2 font-bold text-3xl">
          {CustomLogo && <CustomLogo className="size-10" />} {appName}
        </h1>
        <p className="text-muted-foreground">
          Blockchain automation
          {/* ,{" "}
          <a
            className="underline underline-offset-2 transition duration-200 ease-out hover:text-foreground"
            href="https://ai-sdk.dev/"
            rel="noopener noreferrer"
            target="_blank"
          >
            AI SDK
          </a>
          ,{" "}
          <a
            className="underline underline-offset-2 transition duration-200 ease-out hover:text-foreground"
            href="https://vercel.com/ai-gateway"
            rel="noopener noreferrer"
            target="_blank"
          >
            AI Gateway
          </a>{" "}
          and{" "}
          <a
            className="underline underline-offset-2 transition duration-200 ease-out hover:text-foreground"
            href="https://ai-sdk.dev/elements"
            rel="noopener noreferrer"
            target="_blank"
          >
            AI Elements
          </a> */}
        </p>
      </div>
      {/* start custom keeperhub code */}
      <div className="flex gap-3">
        <Button className="gap-2 shadow-lg" onClick={data.onClick} size="default">
          <Plus className="size-4" />
          Start building
        </Button>
        <Button
          className="gap-2 shadow-lg"
          onClick={handleOpenFeatured}
          size="default"
          variant="outline"
        >
          <LayoutTemplate className="size-4" />
          Explore Workflows
        </Button>
      </div>
      {/* end keeperhub code */}
    </div>
  );
}
