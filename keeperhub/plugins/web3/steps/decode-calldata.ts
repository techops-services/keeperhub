import "server-only";

import { withPluginMetrics } from "@/keeperhub/lib/metrics/instrumentation/plugin";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import {
  type DecodeCalldataCoreInput,
  type DecodeCalldataResult,
  decodeCalldata,
} from "./decode-calldata-core";

export type { DecodedParameter, DecodeCalldataResult, DecodeCalldataCoreInput } from "./decode-calldata-core";

export type DecodeCalldataInput = StepInput & DecodeCalldataCoreInput;

/**
 * Decode Calldata Step
 * Decodes raw transaction calldata into human-readable function calls
 * with parameter names and values using ABI databases and signature registries.
 *
 * Security-critical: maxRetries = 0 (fail-safe, not fail-open)
 */
export async function decodeCalldataStep(
  input: DecodeCalldataInput
): Promise<DecodeCalldataResult> {
  "use step";

  return await withPluginMetrics(
    {
      pluginName: "web3",
      actionName: "decode-calldata",
      executionId: input._context?.executionId,
    },
    () => withStepLogging(input, () => decodeCalldata(input))
  );
}
decodeCalldataStep.maxRetries = 0;

export const _integrationType = "web3";
