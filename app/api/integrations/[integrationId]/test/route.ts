import { NextResponse } from "next/server";
import postgres from "postgres";
// start custom keeperhub code //
import { getOrgContext } from "@/keeperhub/lib/middleware/org-context";
import { auth } from "@/lib/auth";
import {
  buildDatabaseUrlFromConfig,
  getDatabaseErrorMessage,
  getPostgresConnectionOptions,
} from "@/lib/db/connection-utils";
import { getIntegration as getIntegrationFromDb } from "@/lib/db/integrations";
import type { IntegrationType } from "@/lib/types/integration";
import {
  getCredentialMapping,
  getIntegration as getPluginFromRegistry,
} from "@/plugins";
// end keeperhub code //

export type TestConnectionResult = {
  status: "success" | "error";
  message: string;
};

async function handleDatabaseTest(
  config: Record<string, unknown>
): Promise<NextResponse> {
  const url = buildDatabaseUrlFromConfig(
    config as Parameters<typeof buildDatabaseUrlFromConfig>[0]
  );
  if (!url) {
    return NextResponse.json({
      status: "error",
      message:
        "Provide a connection string or connection details (host, username, password, database).",
    });
  }
  const sslMode =
    typeof config.sslMode === "string" ? config.sslMode : undefined;
  const result = await testDatabaseConnection(url, sslMode);
  return NextResponse.json(result);
}

async function handlePluginTest(
  integrationType: string,
  config: Record<string, unknown>
): Promise<NextResponse> {
  const plugin = getPluginFromRegistry(integrationType as IntegrationType);
  if (!plugin) {
    return NextResponse.json(
      { error: "Invalid integration type" },
      { status: 400 }
    );
  }
  if (!plugin.testConfig) {
    return NextResponse.json(
      { error: "Integration does not support testing" },
      { status: 400 }
    );
  }
  const credentials = getCredentialMapping(plugin, config);
  const testFn = await plugin.testConfig.getTestFunction();
  const testResult = await testFn(credentials);
  const result: TestConnectionResult = {
    status: testResult.success ? "success" : "error",
    message: testResult.success
      ? "Connection successful"
      : testResult.error || "Connection failed",
  };
  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // start custom keeperhub code //
    const orgContext = await getOrgContext();
    const organizationId = orgContext.organization?.id || null;
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

    if (integration.type === "database") {
      return handleDatabaseTest(integration.config);
    }

    return handlePluginTest(integration.type, integration.config);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to test connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function testDatabaseConnection(
  databaseUrl?: string,
  sslMode?: string
): Promise<TestConnectionResult> {
  let connection: postgres.Sql | null = null;

  try {
    if (!databaseUrl) {
      return {
        status: "error",
        message: "Connection failed",
      };
    }

    const { normalizedUrl, ssl } = getPostgresConnectionOptions(
      databaseUrl,
      sslMode
    );

    connection = postgres(normalizedUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 5,
      ssl,
    });

    await connection`SELECT 1`;

    return {
      status: "success",
      message: "Connection successful",
    };
  } catch (error) {
    return {
      status: "error",
      message: getDatabaseErrorMessage(error),
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
