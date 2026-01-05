import { desc, eq } from "drizzle-orm";
import { WorkflowTemplateGrid } from "@/keeperhub/components/hub/workflow-template-grid";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";

export default async function HubPage() {
  const publicWorkflows = await db
    .select()
    .from(workflows)
    .where(eq(workflows.visibility, "public"))
    .orderBy(desc(workflows.updatedAt));

  const mappedWorkflows = publicWorkflows.map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    description: workflow.description ?? undefined,
    nodes: workflow.nodes,
    edges: workflow.edges,
    visibility: workflow.visibility,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
  }));

  return (
    <div className="container mx-auto px-4 py-4 pt-28">
      <h1 className="mb-8 font-bold text-3xl">Public Workflows</h1>
      <WorkflowTemplateGrid workflows={mappedWorkflows} />
    </div>
  );
}
