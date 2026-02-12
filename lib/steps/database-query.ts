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
import { fetchCredentials } from "../credential-fetcher";
import { type StepInput, withStepLogging } from "./step-handler";

type DatabaseQueryResult =
  | { success: true; rows: unknown; count: number }
  | { success: false; error: string };

// start custom keeperhub code //
/** Primitive types accepted by postgres.js, plus objects/arrays that get JSON-stringified */
export type SqlParam =
  | null
  | undefined
  | string
  | number
  | boolean
  | Date
  | Uint8Array
  | Record<string, unknown>
  | readonly SqlParam[];
// end keeperhub code //

export type DatabaseQueryInput = StepInput & {
  integrationId?: string;
  dbQuery?: string;
  query?: string;
  // start custom keeperhub code //
  _dbParams?: SqlParam[];
  // end keeperhub code //
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

// start custom keeperhub code //
/** Serialize template-resolved values into types postgres.js can bind directly */
export function serializeSqlParams(
  params: SqlParam[]
): postgres.Serializable[] {
  return params.map((p): postgres.Serializable => {
    if (p === null || p === undefined) {
      return null;
    }
    if (p instanceof Date || p instanceof Uint8Array) {
      return p;
    }
    if (typeof p === "object") {
      return JSON.stringify(p);
    }
    return p;
  });
}
// end keeperhub code //

async function executeQuery(
  client: postgres.Sql,
  queryString: string,
  // start custom keeperhub code //
  params?: SqlParam[]
  // end keeperhub code //
): Promise<unknown> {
  // start custom keeperhub code //
  if (params && params.length > 0) {
    const serialized = serializeSqlParams(params);
    return await client.unsafe(
      queryString,
      serialized as postgres.ParameterOrJSON<never>[]
    );
  }
  // end keeperhub code //
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

  const queryString = (input.dbQuery || input.query) as string;
  let client: postgres.Sql | null = null;

  try {
    client = createDatabaseClient(normalizedUrl, ssl);
    // start custom keeperhub code //
    const result = await executeQuery(client, queryString, input._dbParams);
    // end keeperhub code //
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
