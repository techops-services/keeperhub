"use client";

import { useEffect, useState } from "react";
import { WorkflowTemplateGrid } from "@/keeperhub/components/hub/workflow-template-grid";
import { api, type SavedWorkflow } from "@/lib/api-client";

export default function HubPage() {
  // start custom KeeperHub code
  const [featuredWorkflows, setFeaturedWorkflows] = useState<SavedWorkflow[]>(
    []
  );
  const [communityWorkflows, setCommunityWorkflows] = useState<SavedWorkflow[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWorkflows = async () => {
      try {
        const [featured, community] = await Promise.all([
          api.workflow.getFeatured(),
          api.workflow.getPublic(),
        ]);
        setFeaturedWorkflows(featured);
        setCommunityWorkflows(community);
      } catch (error) {
        console.error("Failed to fetch workflows:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchWorkflows();
  }, []);
  // end custom KeeperHub code

  return (
    <div className="pointer-events-auto fixed inset-0 overflow-y-auto bg-background [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="container mx-auto px-4 py-4 pt-28 pb-12">
        {/* start custom KeeperHub code */}
        {isLoading ? (
          <p className="text-muted-foreground">Loading workflows...</p>
        ) : (
          <>
            {featuredWorkflows.length > 0 && (
              <section className="mb-12">
                <h1 className="mb-8 font-bold text-3xl">
                  Quick Start Templates
                </h1>
                <WorkflowTemplateGrid
                  isFeatured
                  workflows={featuredWorkflows}
                />
              </section>
            )}
            <section>
              <h2 className="mb-8 font-bold text-2xl">Community Workflows</h2>
              <WorkflowTemplateGrid workflows={communityWorkflows} />
            </section>
          </>
        )}
        {/* end custom KeeperHub code */}
      </div>
    </div>
  );
}
