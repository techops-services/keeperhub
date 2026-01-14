import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { type Chain, chains, workflows } from "@/lib/db/schema";
import type { WorkflowNode } from "@/lib/workflow-store";
import { WorkflowTriggerEnum } from "@/lib/workflow-store";

/**
 * Internal endpoint for workers to fetch active Event-type workflows
 * Returns only enabled workflows with Event trigger type
 * Requires X-Internal-Token header for authentication
 */
export async function GET(request: Request) {
  try {
    // Check for internal token authentication
    const internalToken = request.headers.get("X-Internal-Token");
    const expectedToken = process.env.INTERNAL_API_TOKEN;

    if (!expectedToken) {
      console.error("[Workflows Events] INTERNAL_API_TOKEN not configured");
      return NextResponse.json(
        { error: "Internal endpoint not configured" },
        { status: 500 }
      );
    }

    if (!internalToken || internalToken !== expectedToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const activeParam = searchParams.get("active");

    const filterActive = activeParam === "true";

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

    const eventWorkflows = allWorkflows
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

          // Check if trigger type is Event
          const triggerType = triggerNode.data?.config?.triggerType as
            | string
            | undefined;

          if (triggerType !== WorkflowTriggerEnum.EVENT) {
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
          // If parsing fails, exclude this workflow
          return null;
        }
      })
      .filter((workflow) => workflow !== null);

    const networks = await db
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
      })
      .from(chains);

    // Return a dictionary of chains by chainId to make it easier to lookup
    const networkMap: Record<number, Chain> = {};

    networks.forEach((network) => {
      networkMap[network.chainId] = network;
    });

    const response = {
      workflows: eventWorkflows,
      networks: networkMap,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get event workflows:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to get event workflows",
      },
      { status: 500 }
    );
  }
}
