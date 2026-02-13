"use client";

import { ReactFlowProvider } from "@xyflow/react";
import type { ReactNode } from "react";
import { PersistentCanvas } from "@/components/workflow/persistent-canvas";
import { WorkflowToolbar } from "@/components/workflow/workflow-toolbar";
// start custom keeperhub code //
import { NavigationSidebar } from "@/keeperhub/components/navigation-sidebar";
// end keeperhub code //

export function LayoutContent({ children }: { children: ReactNode }) {
  return (
    <ReactFlowProvider>
      <WorkflowToolbar persistent />
      <PersistentCanvas />
      <div className="pointer-events-none relative z-10">{children}</div>
      {/* start custom keeperhub code */}
      <NavigationSidebar />
      {/* end keeperhub code */}
    </ReactFlowProvider>
  );
}
