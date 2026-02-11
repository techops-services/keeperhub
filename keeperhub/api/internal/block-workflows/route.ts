// start custom keeperhub code //
import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { authenticateInternalService } from "@/keeperhub/lib/internal-service-auth";
import { db } from "@/lib/db";
import { type Chain, chains, workflows } from "@/lib/db/schema";
import type { WorkflowNode } from "@/lib/workflow-store";

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

    const blockTriggerFilter = sql`${workflows.nodes} @> '[{"data":{"type":"trigger","config":{"triggerType":"Block"}}}]'::jsonb`;

    const conditions = filterActive
      ? and(eq(workflows.enabled, true), blockTriggerFilter)
      : blockTriggerFilter;

    const matchedWorkflows = await db
      .select({
        id: workflows.id,
        name: workflows.name,
        userId: workflows.userId,
        organizationId: workflows.organizationId,
        enabled: workflows.enabled,
        nodes: workflows.nodes,
      })
      .from(workflows)
      .where(conditions);

    const blockWorkflows = matchedWorkflows.map((workflow) => {
      const nodes = workflow.nodes as WorkflowNode[];
      const triggerNode = nodes.find((node) => node.data?.type === "trigger");
      return {
        id: workflow.id,
        name: workflow.name,
        userId: workflow.userId,
        organizationId: workflow.organizationId,
        enabled: workflow.enabled,
        nodes: triggerNode ? [triggerNode] : [],
      };
    });

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
