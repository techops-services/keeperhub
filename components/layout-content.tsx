"use client";

import { ReactFlowProvider } from "@xyflow/react";
import type { ReactNode } from "react";
import { PersistentCanvas } from "@/components/workflow/persistent-canvas";
import { WorkflowToolbar } from "@/components/workflow/workflow-toolbar";
import { PersistentHeader } from "@/keeperhub/components/persistent-header";

export function LayoutContent({ children }: { children: ReactNode }) {
  return (
    <ReactFlowProvider>
      <WorkflowToolbar persistent />
      <PersistentHeader />
      <PersistentCanvas />
      <div className="pointer-events-none relative z-10">{children}</div>
    </ReactFlowProvider>
  );
}
