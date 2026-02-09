// start custom keeperhub code //
import { NextResponse } from "next/server";
import { estimateWorkflowCost } from "@/keeperhub/lib/billing/cost-calculator";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nodes, edges } = body as {
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
    };

    if (!(nodes && Array.isArray(nodes))) {
      return NextResponse.json(
        { error: "Invalid request: nodes array required" },
        { status: 400 }
      );
    }

    const estimate = await estimateWorkflowCost(
      nodes,
      edges ?? [],
      undefined, // chainId auto-detected
      undefined // triggerType auto-detected
    );

    // Convert BigInt values to strings for JSON serialization
    return NextResponse.json({
      blocks: estimate.blocks,
      blockCost: estimate.blockCost,
      functionCalls: estimate.functionCalls,
      functionCost: estimate.functionCost,
      writeFunctions: estimate.writeFunctions,
      gasCostCredits: estimate.gasCostCredits,
      gasEstimateWei: estimate.gasEstimateWei.toString(),
      gasPriceWei: estimate.gasPriceWei.toString(),
      ethPriceUsd: estimate.ethPriceUsd,
      platformFeePercent: estimate.platformFeePercent,
      platformFee: estimate.platformFee,
      subtotal: estimate.subtotal,
      totalCredits: estimate.totalCredits,
      triggerType: estimate.triggerType,
      gasStrategy: estimate.gasStrategy,
      volatilityWarning: estimate.volatilityWarning,
    });
  } catch (error) {
    console.error("[API] Error estimating workflow cost:", error);
    return NextResponse.json(
      { error: "Failed to estimate cost" },
      { status: 500 }
    );
  }
}
// end keeperhub code //
