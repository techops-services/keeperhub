/**
 * Executable step function for Database Query action
 *
 * SECURITY PATTERN - External Secret Store:
 * Step fetches credentials using workflow ID reference
 */
import "server-only";

import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  getDatabaseErrorMessage,
  getPostgresConnectionOptions,
  type PostgresSslOption,
} from "@/lib/db/connection-utils";
// start custom keeperhub code //
import { checkUrlForIPv6Only } from "@/keeperhub/lib/db/resolve-ipv4";
// end keeperhub code //
import { fetchCredentials } from "../credential-fetcher";
import { type StepInput, withStepLogging } from "./step-handler";

type DatabaseQueryResult =
  | { success: true; rows: unknown; count: number }
  | { success: false; error: string };

export type DatabaseQueryInput = StepInput & {
  integrationId?: string;
  dbQuery?: string;
  query?: string;
};

function validateInput(input: DatabaseQueryInput): string | null {
  const queryString = input.dbQuery || input.query;

  if (!queryString || queryString.trim() === "") {
    return "SQL query is required";
  }

  return null;
}

function createDatabaseClient(
  normalizedUrl: string,
  ssl: PostgresSslOption
): postgres.Sql {
  return postgres(normalizedUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 20,
    ssl: ssl as false | "require" | "prefer",
  });
}

async function executeQuery(
  client: postgres.Sql,
  queryString: string
): Promise<unknown> {
  const db = drizzle(client);
  return await db.execute(sql.raw(queryString));
}

async function cleanupClient(client: postgres.Sql | null): Promise<void> {
  if (client) {
    try {
      await client.end();
    } catch {
      // Ignore errors during cleanup
    }
  }
}

/**
 * Database query logic
 */
async function databaseQuery(
  input: DatabaseQueryInput
): Promise<DatabaseQueryResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  const databaseUrl = credentials.DATABASE_URL;

  if (!databaseUrl) {
    return {
      success: false,
      error:
        "DATABASE_URL is not configured. Please add it in Project Integrations.",
    };
  }

  const { normalizedUrl, ssl } = getPostgresConnectionOptions(
    databaseUrl,
    credentials.DATABASE_SSL_MODE
  );

  // start custom keeperhub code //
  const ipv6Error = await checkUrlForIPv6Only(normalizedUrl);
  if (ipv6Error) {
    return { success: false, error: ipv6Error };
  }
  // end keeperhub code //

  const queryString = (input.dbQuery || input.query) as string;
  let client: postgres.Sql | null = null;

  try {
    client = createDatabaseClient(normalizedUrl, ssl);
    const result = await executeQuery(client, queryString);
    return {
      success: true,
      rows: result,
      count: Array.isArray(result) ? result.length : 0,
    };
  } catch (error) {
    return {
      success: false,
      error: `Database query failed: ${getDatabaseErrorMessage(error)}`,
    };
  } finally {
    await cleanupClient(client);
  }
}

/**
 * Database Query Step
 * Executes a SQL query against a PostgreSQL database
 */
// biome-ignore lint/suspicious/useAwait: workflow "use step" requires async
export async function databaseQueryStep(
  input: DatabaseQueryInput
): Promise<DatabaseQueryResult> {
  "use step";
  return withStepLogging(input, () => databaseQuery(input));
}
databaseQueryStep.maxRetries = 0;
