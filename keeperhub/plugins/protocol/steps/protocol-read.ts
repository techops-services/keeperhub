import "server-only";
import "@/keeperhub/protocols";

import { resolveAbi } from "@/keeperhub/lib/abi-cache";
import { getProtocol } from "@/keeperhub/lib/protocol-registry";
import {
  type ReadContractCoreInput,
  type ReadContractResult,
  readContractCore,
} from "@/keeperhub/plugins/web3/steps/read-contract-core";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import {
  type ProtocolMeta,
  resolveProtocolMeta,
} from "./resolve-protocol-meta";

type ProtocolReadInput = StepInput & {
  network: string;
  _protocolMeta?: string;
  _actionType?: string;
  [key: string]: unknown;
};

function buildFunctionArgs(
  input: ProtocolReadInput,
  meta: ProtocolMeta
): string | undefined {
  const protocol = getProtocol(meta.protocolSlug);
  if (!protocol) {
    return undefined;
  }

  const protocolAction = protocol.actions.find(
    (a) => a.function === meta.functionName && a.contract === meta.contractKey
  );

  if (!protocolAction || protocolAction.inputs.length === 0) {
    return undefined;
  }

  const args = protocolAction.inputs.map((inp) => {
    const value = input[inp.name];
    return value !== undefined ? String(value) : "";
  });

  return JSON.stringify(args);
}

export async function protocolReadStep(
  input: ProtocolReadInput
): Promise<ReadContractResult> {
  "use step";

  // 1. Resolve protocol metadata from config or action type
  const meta = resolveProtocolMeta(input);
  if (!meta) {
    return {
      success: false,
      error:
        "Invalid _protocolMeta: failed to parse JSON and could not derive from action type",
    };
  }

  // 2. Look up protocol definition from runtime registry
  const protocol = getProtocol(meta.protocolSlug);
  if (!protocol) {
    return { success: false, error: `Unknown protocol: ${meta.protocolSlug}` };
  }

  // 3. Resolve contract for the selected network
  const contract = protocol.contracts[meta.contractKey];
  if (!contract) {
    return {
      success: false,
      error: `Unknown contract key "${meta.contractKey}" in protocol "${meta.protocolSlug}"`,
    };
  }

  const contractAddress = contract.addresses[input.network];
  if (!contractAddress) {
    return {
      success: false,
      error: `Protocol "${meta.protocolSlug}" contract "${meta.contractKey}" is not deployed on network "${input.network}"`,
    };
  }

  // 4. Resolve ABI (from definition or auto-fetch from explorer)
  let resolvedAbi: string;
  try {
    const abiResult = await resolveAbi({
      contractAddress,
      network: input.network,
      abi: contract.abi,
    });
    resolvedAbi = abiResult.abi;
  } catch (error) {
    return {
      success: false,
      error: `Failed to resolve ABI for contract "${meta.contractKey}" in protocol "${meta.protocolSlug}": ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  // 5. Build function arguments from named inputs ordered by action definition
  const functionArgs = buildFunctionArgs(input, meta);

  // 6. Delegate to readContractCore
  const coreInput: ReadContractCoreInput = {
    contractAddress,
    network: input.network,
    abi: resolvedAbi,
    abiFunction: meta.functionName,
    functionArgs,
    _context: input._context
      ? { executionId: input._context.executionId }
      : undefined,
  };

  return await withStepLogging(input, () => readContractCore(coreInput));
}

export const _integrationType = "protocol";
