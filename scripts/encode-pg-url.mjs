#!/usr/bin/env node

/**
 * encode-pg-url.mjs
 *
 * Reads WORKFLOW_POSTGRES_URL (falling back to DATABASE_URL) from the
 * environment, percent-encodes the username and password so that special
 * characters (base64 +/= from CNPG, etc.) don't break URL parsing, and
 * prints the result to stdout.
 *
 * Used by Helm init containers before running workflow-postgres-setup and
 * drizzle-kit migrations. The same logic lives in instrumentation.ts for
 * runtime use — keep both in sync.
 *
 * Usage (shell):
 *   export WORKFLOW_POSTGRES_URL=$(node scripts/encode-pg-url.mjs)
 */

const url = process.env.WORKFLOW_POSTGRES_URL || process.env.DATABASE_URL || "";

if (!url) {
  process.exit(0);
}

// Fast path: if the URL already parses, credentials are already encoded.
try {
  new URL(url);
  process.stdout.write(url);
  process.exit(0);
} catch {
  // Fall through to manual encoding
}

// Manual encoding for URLs where new URL() fails due to special characters
// in the userinfo component (username:password).
//
// Standard format: scheme://user:password@host:port/database?params
//
// Assumptions:
// - The first ':' after '://' separates username from password
//   (PostgreSQL usernames cannot contain unescaped ':')
// - The last '@' separates credentials from the host
//   (handles passwords containing '@')
const schemeEnd = url.indexOf("://") + 3;
const atIdx = url.lastIndexOf("@");
const colonIdx = url.indexOf(":", schemeEnd);

if (schemeEnd > 3 && atIdx > colonIdx && colonIdx > schemeEnd) {
  const user = url.slice(schemeEnd, colonIdx);
  const pass = url.slice(colonIdx + 1, atIdx);
  process.stdout.write(
    `${url.slice(0, schemeEnd)}${encodeURIComponent(user)}:${encodeURIComponent(pass)}${url.slice(atIdx)}`
  );
} else {
  process.stdout.write(url);
}
