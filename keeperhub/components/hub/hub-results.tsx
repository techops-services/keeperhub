"use client";

import { WorkflowTemplateGrid } from "@/keeperhub/components/hub/workflow-template-grid";
import type { SavedWorkflow } from "@/lib/api-client";

type HubResultsProps = {
  communityWorkflows: SavedWorkflow[];
  searchResults: SavedWorkflow[] | null;
  isSearchActive: boolean;
};

export function HubResults({
  communityWorkflows,
  searchResults,
  isSearchActive,
}: HubResultsProps) {
  const workflows = isSearchActive ? searchResults : communityWorkflows;

  if (!workflows || workflows.length === 0) {
    return (
      <section>
        <p className="text-muted-foreground">
          {isSearchActive
            ? "No workflows found matching your search."
            : "No public workflows available yet."}
        </p>
      </section>
    );
  }

  return (
    <section>
      <WorkflowTemplateGrid workflows={workflows} />
    </section>
  );
}
