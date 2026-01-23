/**
 * Database connection utilities
 *
 * Handles URL encoding of database credentials with special characters
 */

/**
 * Regex pattern for parsing PostgreSQL connection strings
 * Format: postgres[ql]://username:password@host:port/database
 */
const CONNECTION_STRING_REGEX = /^(postgres(?:ql)?:\/\/)([^:]+):([^@]+)@(.+)$/;

/**
 * Ensures that the database connection string has properly URL-encoded credentials.
 *
 * Passwords with special characters like +, /, = need to be percent-encoded when
 * used in connection strings. This function parses the connection string and
 * re-encodes the password component if needed.
 *
 * @param connectionString - PostgreSQL connection string
 * @returns Connection string with properly encoded credentials
 *
 * @example
 * ```ts
 * const url = "postgresql://user:pass+word@host:5432/db";
 * const safe = ensureEncodedConnectionString(url);
 * // Returns: "postgresql://user:pass%2Bword@host:5432/db"
 * ```
 */
export function ensureEncodedConnectionString(
  connectionString: string
): string {
  try {
    // Try to parse as-is first (it might already be valid)
    new URL(connectionString);
    return connectionString;
  } catch {
    // If parsing fails, it's likely due to special characters in the password
    // Parse and re-encode the connection string manually
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

/**
 * Gets the database connection string from environment with proper encoding.
 *
 * @param fallback - Fallback connection string if DATABASE_URL is not set
 * @returns Properly encoded connection string
 */
export function getDatabaseUrl(
  fallback = "postgres://localhost:5432/workflow"
): string {
  const connectionString = process.env.DATABASE_URL || fallback;
  return ensureEncodedConnectionString(connectionString);
}
