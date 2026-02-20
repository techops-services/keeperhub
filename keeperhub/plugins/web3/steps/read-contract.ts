import "server-only";

import { eq } from "drizzle-orm";
import { withPluginMetrics } from "@/keeperhub/lib/metrics/instrumentation/plugin";
import { db } from "@/lib/db";
import { explorerConfigs } from "@/lib/db/schema";
import { getAddressUrl } from "@/lib/explorer";
import { getChainIdFromNetwork } from "@/lib/rpc";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import {
  type ReadContractCoreInput,
  type ReadContractResult,
  readContractCore,
} from "./read-contract-core";

export type ReadContractInput = StepInput & ReadContractCoreInput;

/**
 * Read Contract Step
 * Reads data from a smart contract using view/pure functions
 */
export async function readContractStep(
  input: ReadContractInput
): Promise<ReadContractResult> {
  "use step";

  // Enrich input with contract address explorer link for the execution log
  let enrichedInput: ReadContractInput & { contractAddressLink?: string } =
    input;
  try {
    const chainId = getChainIdFromNetwork(input.network);
    const explorerConfig = await db.query.explorerConfigs.findFirst({
      where: eq(explorerConfigs.chainId, chainId),
    });
    if (explorerConfig) {
      const contractAddressLink = getAddressUrl(
        explorerConfig,
        input.contractAddress
      );
      if (contractAddressLink) {
        enrichedInput = { ...input, contractAddressLink };
      }
    }
  } catch {
    // Non-critical: if lookup fails, input logs without the link
  }

  return withPluginMetrics(
    {
      pluginName: "web3",
      actionName: "read-contract",
      executionId: input._context?.executionId,
    },
    () => withStepLogging(enrichedInput, () => readContractCore(input))
  );
}

export const _integrationType = "web3";
