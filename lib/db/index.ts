import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  accounts,
  apiKeys,
  sessions,
  users,
  verifications,
  workflowExecutionLogs,
  workflowExecutions,
  workflowExecutionsRelations,
  workflows,
} from "./schema";

// Construct schema object for drizzle
const schema = {
  users,
  sessions,
  accounts,
  verifications,
  workflows,
  workflowExecutions,
  workflowExecutionLogs,
  workflowExecutionsRelations,
  apiKeys,
};

const connectionString =
  process.env.DATABASE_URL || "postgres://localhost:5432/workflow";

console.log("[Database] Initializing connection", {
  hasDatabaseUrl: !!process.env.DATABASE_URL,
  connectionStringPrefix: connectionString.substring(0, 20) + "...",
});

try {
  // For migrations
  export const migrationClient = postgres(connectionString, { max: 1 });
  console.log("[Database] Migration client created");

  // For queries
  const queryClient = postgres(connectionString);
  export const db = drizzle(queryClient, { schema });
  console.log("[Database] Query client created and drizzle initialized");
} catch (error) {
  console.error("[Database] Failed to initialize:", error);
  throw error;
}
