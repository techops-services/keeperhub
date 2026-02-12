import { NextResponse } from "next/server";
// start custom keeperhub code //
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { auth } from "@/lib/auth";
import {
  getIntegration as getIntegrationFromDb,
  mergeDatabaseConfig,
} from "@/lib/db/integrations";
import { handleDatabaseTest, handlePluginTest } from "@/lib/db/test-connection";
import type { IntegrationConfig } from "@/lib/types/integration";

// end keeperhub code //

export type { TestConnectionResult } from "@/lib/db/test-connection";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ integrationId: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // start custom keeperhub code //
    const orgContext = await getOrgContext();
    const organizationId = orgContext.organization?.id ?? null;
    // end keeperhub code //

    const { integrationId } = await params;

    if (!integrationId) {
      return NextResponse.json(
        { error: "integrationId is required" },
        { status: 400 }
      );
    }

    const integration = await getIntegrationFromDb(
      integrationId,
      session.user.id,
      // start custom keeperhub code //
      organizationId
      // end keeperhub code //
    );

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    // start custom keeperhub code //
    // Accept optional config overrides from the request body.
    // For database integrations, merge overrides with stored config so the
    // server can test with updated non-secret fields (e.g. host) without
    // the client needing to send the password.
    let body: { configOverrides?: IntegrationConfig } = {};
    const contentType = request.headers.get("content-type") ?? "";
    const hasBody = contentType.includes("application/json");
    if (hasBody) {
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON in request body" },
          { status: 400 }
        );
      }
    }

    const testConfig =
      integration.type === "database" && body.configOverrides
        ? mergeDatabaseConfig(integration.config, body.configOverrides)
        : integration.config;
    // end keeperhub code //

    if (integration.type === "database") {
      const result = await handleDatabaseTest(testConfig);
      return NextResponse.json(result);
    }

    const result = await handlePluginTest(integration.type, testConfig);
    if (
      result.message === "Invalid integration type" ||
      result.message === "Integration does not support testing"
    ) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to test connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
