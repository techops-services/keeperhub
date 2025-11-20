import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workflows } from "@/lib/db/schema";
import { setEnvironmentVariable } from "@/lib/integrations/vercel";

export type UpdateProjectIntegrationsInput = {
  resendApiKey?: string | null;
  resendFromEmail?: string | null;
  linearApiKey?: string | null;
  slackApiKey?: string | null;
  aiGatewayApiKey?: string | null;
  databaseUrl?: string | null;
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await context.params;
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workflow = await db.query.workflows.findFirst({
      where: and(
        eq(workflows.id, workflowId),
        eq(workflows.userId, session.user.id)
      ),
    });

    if (!workflow) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 }
      );
    }

    // Get app-level Vercel credentials from env vars
    const vercelApiToken = process.env.VERCEL_API_TOKEN;
    const vercelTeamId = process.env.VERCEL_TEAM_ID;

    if (!vercelApiToken) {
      return NextResponse.json(
        { error: "Vercel API token not configured" },
        { status: 500 }
      );
    }

    const body: UpdateProjectIntegrationsInput = await request.json();

    // Update environment variables in Vercel
    const envUpdates: Array<{ key: string; value: string }> = [];

    const keyValuePairs: Array<{
      key: string;
      value: string | null | undefined;
    }> = [
      { key: "RESEND_API_KEY", value: body.resendApiKey },
      { key: "RESEND_FROM_EMAIL", value: body.resendFromEmail },
      { key: "LINEAR_API_KEY", value: body.linearApiKey },
      { key: "SLACK_API_KEY", value: body.slackApiKey },
      { key: "AI_GATEWAY_API_KEY", value: body.aiGatewayApiKey },
      { key: "DATABASE_URL", value: body.databaseUrl },
    ];

    for (const { key, value } of keyValuePairs) {
      if (value !== undefined && value) {
        envUpdates.push({ key, value });
      }
    }

    // Set environment variables in Vercel
    for (const { key, value } of envUpdates) {
      const result = await setEnvironmentVariable({
        projectId: workflow.vercelProjectId,
        apiToken: vercelApiToken,
        teamId: vercelTeamId || undefined,
        key,
        value,
        type: "encrypted", // Use "encrypted" for maximum security
      });

      if (result.status === "error") {
        return NextResponse.json(
          { error: `Failed to set ${key}: ${result.error}` },
          { status: 500 }
        );
      }
    }

    // Update the workflow's updatedAt timestamp
    await db
      .update(workflows)
      .set({ updatedAt: new Date() })
      .where(
        and(eq(workflows.id, workflowId), eq(workflows.userId, session.user.id))
      );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update project integrations:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update project integrations",
      },
      { status: 500 }
    );
  }
}
