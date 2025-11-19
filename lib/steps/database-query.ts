/**
 * Executable step function for Database Query action
 */
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";

export async function databaseQueryStep(input: {
  dbQuery?: string;
  query?: string;
  databaseUrl?: string;
}): Promise<{
  status: string;
  rows?: unknown;
  count?: number;
  error?: string;
}> {
  // Accept either dbQuery or query field name
  const queryString = input.dbQuery || input.query;

  if (!queryString || queryString.trim() === "") {
    return {
      status: "error",
      error: "SQL query is required",
    };
  }

  if (!input.databaseUrl || input.databaseUrl.trim() === "") {
    return {
      status: "error",
      error: "Database URL is required. Please configure it in Project Integrations.",
    };
  }

  try {
    // Create a connection to the custom database
    const client = postgres(input.databaseUrl, { max: 1 });
    const db = drizzle(client);

    // Execute the query
    const result = await db.execute(sql.raw(queryString));

    // Close the connection
    await client.end();

    return {
      status: "success",
      rows: result,
      count: Array.isArray(result) ? result.length : 0,
    };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}
