import { NextResponse } from "next/server";
import postgres from "postgres";
import { auth } from "@/lib/auth";
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
      const result = await testDatabaseConnection(body.config.url);
      return NextResponse.json(result);
    }

    const plugin = getPluginFromRegistry(body.type);

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

    const credentials = getCredentialMapping(plugin, body.config);

    const testFn = await plugin.testConfig.getTestFunction();
    const testResult = await testFn(credentials);

    const result: TestConnectionResult = {
      status: testResult.success ? "success" : "error",
      message: testResult.success
        ? "Connection successful"
        : testResult.error || "Connection failed",
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to test connection:", error);
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to test connection",
      },
      { status: 500 }
    );
  }
}

async function testDatabaseConnection(
  databaseUrl?: string
): Promise<TestConnectionResult> {
  let connection: postgres.Sql | null = null;

  try {
    if (!databaseUrl) {
      return {
        status: "error",
        message: "Connection failed",
      };
    }

    connection = postgres(databaseUrl, {
      max: 1,
      idle_timeout: 5,
      connect_timeout: 5,
    });

    await connection`SELECT 1`;

    return {
      status: "success",
      message: "Connection successful",
    };
  } catch {
    return {
      status: "error",
      message: "Connection failed",
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}
