import { NextResponse } from "next/server";
import postgres from "postgres";
import { auth } from "@/lib/auth";
import {
  buildDatabaseUrlFromConfig,
  getDatabaseErrorMessage,
  getPostgresConnectionOptions,
} from "@/lib/db/connection-utils";
import type {
  IntegrationConfig,
  IntegrationType,
} from "@/lib/types/integration";
import {
  getCredentialMapping,
  getIntegration as getPluginFromRegistry,
} from "@/plugins";

export type TestConnectionRequest = {
  type: IntegrationType;
  config: IntegrationConfig;
};

export type TestConnectionResult = {
  status: "success" | "error";
  message: string;
};

async function handleDatabaseTest(
  config: IntegrationConfig
): Promise<NextResponse<TestConnectionResult>> {
  const url = buildDatabaseUrlFromConfig(config);
  if (!url) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "Provide a connection string or connection details (host, username, password, database).",
      },
      { status: 200 }
    );
  }
  const sslMode =
    typeof config.sslMode === "string" ? config.sslMode : undefined;
  const result = await testDatabaseConnection(url, sslMode);
  return NextResponse.json(result);
}

async function handlePluginTest(
  type: IntegrationType,
  config: IntegrationConfig
): Promise<NextResponse<TestConnectionResult | { error: string }>> {
  const plugin = getPluginFromRegistry(type);

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

/**
 * POST /api/integrations/test
 * Test connection credentials without saving
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: TestConnectionRequest = await request.json();

    if (!(body.type && body.config)) {
      return NextResponse.json(
        { error: "Type and config are required" },
        { status: 400 }
      );
    }

    if (body.type === "database") {
      return handleDatabaseTest(body.config);
    }

    return handlePluginTest(body.type, body.config);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to test connection";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}

async function testDatabaseConnection(
  databaseUrl: string,
  sslMode?: string
): Promise<TestConnectionResult> {
  let connection: postgres.Sql | null = null;

  try {
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
