import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config();

/**
 * Regex pattern for parsing PostgreSQL connection strings
 */
const CONNECTION_STRING_REGEX = /^(postgres(?:ql)?:\/\/)([^:]+):([^@]+)@(.+)$/;

/**
 * Ensures that the database connection string has properly URL-encoded credentials.
 * Inline implementation for drizzle-kit config compatibility.
 */
function ensureEncodedConnectionString(connectionString: string): string {
  try {
    // Try to parse as-is first (it might already be valid)
    new URL(connectionString);
    return connectionString;
  } catch {
    // If parsing fails, it's likely due to special characters in the password
    const match = connectionString.match(CONNECTION_STRING_REGEX);

    if (!match) {
      // Can't parse the format, return as-is and let the caller handle the error
      return connectionString;
    }

    const [, protocol, username, password, hostAndDb] = match;

    // URL-encode the password component
    const encodedPassword = encodeURIComponent(password);

    // Reconstruct the connection string
    return `${protocol}${username}:${encodedPassword}@${hostAndDb}`;
  }
}

const rawDatabaseUrl =
  process.env.DATABASE_URL || "postgres://localhost:5432/workflow";
const databaseUrl = ensureEncodedConnectionString(rawDatabaseUrl);

export default {
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
} satisfies Config;
