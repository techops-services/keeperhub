/**
 * Credential Fetcher
 *
 * SECURITY: Steps should fetch credentials at runtime using only an integration ID reference.
 * This ensures:
 * 1. Credentials are never passed as step parameters (not logged in observability)
 * 2. Credentials are reconstructed in secure, non-persisted contexts (in-memory only)
 * 3. Works for both production and test runs
 *
 * Pattern:
 * - Step input: { integrationId: "abc123", ...otherParams }  ← Safe to log
 * - Step fetches: credentials = await fetchCredentials(integrationId)  ← Not logged
 * - Step uses: apiClient.call(credentials.apiKey)  ← In memory only
 * - Step returns: { result: data }  ← Safe to log (no credentials)
 */
import "server-only";

import { getCredentialMapping, getIntegration } from "@/plugins";
import { buildDatabaseUrlFromConfig } from "./db/connection-utils";
import { getIntegrationById } from "./db/integrations";
import type { IntegrationConfig, IntegrationType } from "./types/integration";

// WorkflowCredentials is now a generic record since plugins define their own keys
export type WorkflowCredentials = Record<string, string | undefined>;

// System integrations that don't have plugins need hardcoded mapping
const SYSTEM_CREDENTIAL_MAPPERS: Record<
  string,
  (config: IntegrationConfig) => WorkflowCredentials
> = {
  database: (config) => {
    const creds: WorkflowCredentials = {};
    const url = buildDatabaseUrlFromConfig(config);
    if (url) {
      creds.DATABASE_URL = url;
    }
    if (
      config.sslMode &&
      typeof config.sslMode === "string" &&
      ["require", "prefer", "disable", "auto"].includes(config.sslMode)
    ) {
      creds.DATABASE_SSL_MODE = config.sslMode;
    }
    return creds;
  },
};

/**
 * Map integration config to WorkflowCredentials format
 * Uses plugin registry for plugin integrations, hardcoded mappers for system integrations
 */
function mapIntegrationConfig(
  integrationType: IntegrationType,
  config: IntegrationConfig
): WorkflowCredentials {
  // Check for system integrations first
  const systemMapper = SYSTEM_CREDENTIAL_MAPPERS[integrationType];
  if (systemMapper) {
    return systemMapper(config);
  }

  // Look up plugin from registry and auto-generate credential mapping
  const plugin = getIntegration(integrationType);
  if (plugin) {
    return getCredentialMapping(plugin, config);
  }

  // Fallback for unknown integrations
  return {};
}

/**
 * Fetch credentials for an integration by ID
 *
 * @param integrationId - The ID of the integration to fetch credentials for
 * @returns WorkflowCredentials object with the integration's credentials
 */
export async function fetchCredentials(
  integrationId: string
): Promise<WorkflowCredentials> {
  const integration = await getIntegrationById(integrationId);
  if (!integration) {
    return {};
  }
  return mapIntegrationConfig(integration.type, integration.config);
}

/**
 * Legacy function name for backward compatibility
 * Now fetches by integration ID instead of workflow ID
 */
export function fetchIntegrationCredentials(
  integrationId: string
): Promise<WorkflowCredentials> {
  return fetchCredentials(integrationId);
}
