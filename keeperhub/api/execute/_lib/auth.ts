import "server-only";

import { createHash } from "node:crypto";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizationApiKeys } from "@/lib/db/schema";

export type ApiKeyContext = {
  organizationId: string;
  apiKeyId: string;
};

/**
 * Validate a Bearer token from the Authorization header against organizationApiKeys.
 * Returns the org context if the key is valid, null otherwise.
 *
 * Keys must:
 * - Start with "kh_" prefix
 * - Match a SHA-256 hash in the database
 * - Not be revoked (revokedAt is null)
 * - Not be expired (expiresAt is null or in the future)
 */
export async function validateApiKey(
  request: Request
): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer kh_")) {
    return null;
  }

  // Extract the key (remove "Bearer " prefix)
  const key = authHeader.slice(7);
  const keyHash = createHash("sha256").update(key).digest("hex");

  const now = new Date();

  const apiKey = await db.query.organizationApiKeys.findFirst({
    where: and(
      eq(organizationApiKeys.keyHash, keyHash),
      isNull(organizationApiKeys.revokedAt),
      or(
        isNull(organizationApiKeys.expiresAt),
        gt(organizationApiKeys.expiresAt, now)
      )
    ),
    columns: {
      id: true,
      organizationId: true,
    },
  });

  if (!apiKey) {
    return null;
  }

  // Fire-and-forget: update lastUsedAt for audit trail
  db.update(organizationApiKeys)
    .set({ lastUsedAt: now })
    .where(eq(organizationApiKeys.id, apiKey.id))
    .catch(() => {
      // Non-critical: lastUsedAt update failure should not block auth
    });

  return {
    organizationId: apiKey.organizationId,
    apiKeyId: apiKey.id,
  };
}
