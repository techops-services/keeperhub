import postgres from "postgres";
import {
  buildDatabaseUrlFromConfig,
  type DatabaseConnectionConfig,
  getDatabaseErrorMessage,
  getPostgresConnectionOptions,
} from "@/lib/db/connection-utils";
// start custom keeperhub code //
import { checkUrlForIPv6Only } from "@/keeperhub/lib/db/resolve-ipv4";
// end keeperhub code //
import type { IntegrationType } from "@/lib/types/integration";
import {
  getCredentialMapping,
  getIntegration as getPluginFromRegistry,
} from "@/plugins";

export type TestConnectionResult = {
  status: "success" | "error";
  message: string;
};

export async function testDatabaseConnection(
  databaseUrl: string,
  sslMode?: string
): Promise<TestConnectionResult> {
  let connection: postgres.Sql | null = null;

  try {
    const { normalizedUrl, ssl } = getPostgresConnectionOptions(
      databaseUrl,
      sslMode
    );

    // start custom keeperhub code //
    const ipv6Error = await checkUrlForIPv6Only(normalizedUrl);
    if (ipv6Error) {
      return { status: "error", message: ipv6Error };
    }
    // end keeperhub code //

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

export async function handleDatabaseTest(
  config: Record<string, unknown>
): Promise<TestConnectionResult> {
  const url = buildDatabaseUrlFromConfig(config as DatabaseConnectionConfig);
  if (!url) {
    return {
      status: "error",
      message:
        "Provide a connection string or connection details (host, username, password, database).",
    };
  }
  const sslMode =
    typeof config.sslMode === "string" ? config.sslMode : undefined;
  return await testDatabaseConnection(url, sslMode);
}

export async function handlePluginTest(
  type: IntegrationType | string,
  config: Record<string, unknown>
): Promise<TestConnectionResult> {
  const plugin = getPluginFromRegistry(type as IntegrationType);
  if (!plugin) {
    return { status: "error", message: "Invalid integration type" };
  }
  if (!plugin.testConfig) {
    return { status: "error", message: "Integration does not support testing" };
  }
  const credentials = getCredentialMapping(plugin, config);
  const testFn = await plugin.testConfig.getTestFunction();
  const testResult = await testFn(credentials);
  return {
    status: testResult.success ? "success" : "error",
    message: testResult.success
      ? "Connection successful"
      : testResult.error || "Connection failed",
  };
}
