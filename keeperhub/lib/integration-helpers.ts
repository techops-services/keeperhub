/**
 * KeeperHub integration helpers
 * These helpers extend upstream functionality for KeeperHub-specific features
 */

import type { IntegrationType } from "@/lib/types/integration";
import { getIntegration } from "@/plugins";

/**
 * Check if an integration type requires credentials
 * Some integrations (like web3) don't require user credentials
 */
export function integrationRequiresCredentials(
  integrationType: IntegrationType | string | undefined
): boolean {
  if (!integrationType) {
    return false;
  }

  const plugin = getIntegration(integrationType as IntegrationType);
  return plugin?.requiresCredentials !== false;
}
