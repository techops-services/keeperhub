"use client";

import { useEffect, useState } from "react";
import { WorkflowTemplateGrid } from "@/keeperhub/components/hub/workflow-template-grid";
import { api, type SavedWorkflow } from "@/lib/api-client";

export default function HubPage() {
  // start custom KeeperHub code
  const [workflows, setWorkflows] = useState<SavedWorkflow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPublicWorkflows = async () => {
      try {
        const publicWorkflows = await api.workflow.getPublic();
        setWorkflows(publicWorkflows);
      } catch (error) {
        console.error("Failed to fetch public workflows:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublicWorkflows();
  }, []);
  // end custom KeeperHub code

  return (
    <div className="pointer-events-auto">
      <div className="container mx-auto px-4 py-4 pt-28">
        <h1 className="mb-8 font-bold text-3xl">Public Workflows</h1>
        {/* start custom KeeperHub code */}
        {isLoading ? (
          <p className="text-muted-foreground">Loading workflows...</p>
        ) : (
          <WorkflowTemplateGrid workflows={workflows} />
        )}
        {/* end custom KeeperHub code */}
      </div>
    </div>
  );
}
