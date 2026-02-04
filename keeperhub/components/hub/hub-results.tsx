"use client";

import { WorkflowTemplateGrid } from "@/keeperhub/components/hub/workflow-template-grid";
import type { SavedWorkflow } from "@/lib/api-client";

type HubResultsProps = {
  combinedResults: SavedWorkflow[] | null;
  communityWorkflows: SavedWorkflow[];
  featuredWorkflows: SavedWorkflow[];
  hasTextSearch: boolean;
  isSearchActive: boolean;
  selectedCategory: string | null;
};

export function HubResults({
  combinedResults,
  communityWorkflows,
  featuredWorkflows,
  hasTextSearch,
  isSearchActive,
  selectedCategory,
}: HubResultsProps) {
  if (isSearchActive) {
    return (
      <section>
        <h1 className="mb-8 font-bold text-3xl">
          {hasTextSearch
            ? `Results (${combinedResults?.length ?? 0})`
            : `Featured ${selectedCategory} Templates`}
        </h1>
        {combinedResults && combinedResults.length > 0 ? (
          <WorkflowTemplateGrid isFeatured workflows={combinedResults} />
        ) : (
          <p className="text-muted-foreground">
            No workflows found matching your search.
          </p>
        )}
      </section>
    );
  }

  return (
    <>
      {featuredWorkflows.length > 0 && (
        <section className="mb-12">
          <h1 className="mb-8 font-bold text-3xl">Quick Start Templates</h1>
          <WorkflowTemplateGrid isFeatured workflows={featuredWorkflows} />
        </section>
      )}
      <section>
        <h2 className="mb-8 font-bold text-2xl">Community Workflows</h2>
        {communityWorkflows.length > 0 ? (
          <WorkflowTemplateGrid workflows={communityWorkflows} />
        ) : (
          <p className="text-muted-foreground">
            No public workflows available yet.
          </p>
        )}
      </section>
    </>
  );
}
