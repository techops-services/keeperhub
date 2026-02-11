// start custom keeperhub code //
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authenticateInternalService } from "@/keeperhub/lib/internal-service-auth";
import { db } from "@/lib/db";
import { type Chain, chains, workflows } from "@/lib/db/schema";
import type { WorkflowNode } from "@/lib/workflow-store";
import { WorkflowTriggerEnum } from "@/lib/workflow-store";

export async function GET(request: Request): Promise<NextResponse> {
  const auth = authenticateInternalService(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const filterActive = searchParams.get("active") === "true";

    const query = db
      .select({
        id: workflows.id,
        name: workflows.name,
        userId: workflows.userId,
        organizationId: workflows.organizationId,
        enabled: workflows.enabled,
        nodes: workflows.nodes,
      })
      .from(workflows);

    const allWorkflows = filterActive
      ? await query.where(eq(workflows.enabled, true))
      : await query;

    const blockWorkflows = allWorkflows
      .map((workflow) => {
        try {
          const nodes = workflow.nodes as WorkflowNode[];
          if (!Array.isArray(nodes)) {
            return null;
          }

          const triggerNode = nodes.find(
            (node) => node.data?.type === "trigger"
          );

          if (!triggerNode) {
            return null;
          }

          const triggerType = triggerNode.data?.config?.triggerType as
            | string
            | undefined;

          if (triggerType !== WorkflowTriggerEnum.BLOCK) {
            return null;
          }

          return {
            id: workflow.id,
            name: workflow.name,
            userId: workflow.userId,
            organizationId: workflow.organizationId,
            enabled: workflow.enabled,
            nodes: [triggerNode],
          };
        } catch {
          return null;
        }
      })
      .filter((workflow) => workflow !== null);

    const allChains = await db
      .select({
        id: chains.id,
        chainId: chains.chainId,
        name: chains.name,
        symbol: chains.symbol,
        chainType: chains.chainType,
        defaultPrimaryRpc: chains.defaultPrimaryRpc,
        defaultFallbackRpc: chains.defaultFallbackRpc,
        defaultPrimaryWss: chains.defaultPrimaryWss,
        defaultFallbackWss: chains.defaultFallbackWss,
        isTestnet: chains.isTestnet,
        isEnabled: chains.isEnabled,
        createdAt: chains.createdAt,
        updatedAt: chains.updatedAt,
        gasConfig: chains.gasConfig,
      })
      .from(chains)
      .where(eq(chains.isEnabled, true));

    const networkMap: Record<number, Chain> = {};
    for (const network of allChains) {
      networkMap[network.chainId] = network;
    }

    return NextResponse.json({
      workflows: blockWorkflows,
      networks: networkMap,
    });
  } catch (error) {
    console.error("Failed to get block trigger workflows:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get block trigger workflows",
      },
      { status: 500 }
    );
  }
}
// end keeperhub code //
