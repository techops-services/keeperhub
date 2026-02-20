import "server-only";

import { authenticateApiKey } from "@/keeperhub/lib/api-key-auth";

export type ApiKeyContext = {
  organizationId: string;
  apiKeyId: string;
};

/**
 * Thin wrapper around authenticateApiKey for the direct execution API.
 * Returns the org context if the key is valid, null otherwise.
 */
export async function validateApiKey(
  request: Request
): Promise<ApiKeyContext | null> {
  const result = await authenticateApiKey(request);

  if (!result.authenticated) {
    return null;
  }

  if (!(result.organizationId && result.apiKeyId)) {
    return null;
  }

  return {
    organizationId: result.organizationId,
    apiKeyId: result.apiKeyId,
  };
}
