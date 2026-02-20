import "server-only";

import { resolveAbi } from "@/keeperhub/lib/abi-cache";
import { getProtocol } from "@/keeperhub/lib/protocol-registry";
import {
  type WriteContractCoreInput,
  type WriteContractResult,
  writeContractCore,
} from "@/keeperhub/plugins/web3/steps/write-contract-core";
import type { StepInput } from "@/lib/steps/step-handler";

type ProtocolMeta = {
  protocolSlug: string;
  contractKey: string;
  functionName: string;
  actionType: "read" | "write";
};

type ProtocolWriteInput = StepInput & {
  network: string;
  _protocolMeta: string;
  [key: string]: unknown;
};

function buildFunctionArgs(
  input: ProtocolWriteInput,
  protocolSlug: string,
  contractKey: string,
  functionName: string
): string | undefined {
  const protocol = getProtocol(protocolSlug);
  if (!protocol) {
    return undefined;
  }

  const protocolAction = protocol.actions.find(
    (a) => a.function === functionName && a.contract === contractKey
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

export async function protocolWriteStep(
  input: ProtocolWriteInput
): Promise<WriteContractResult> {
  "use step";

  // 1. Parse _protocolMeta JSON
  let meta: ProtocolMeta;
  try {
    meta = JSON.parse(input._protocolMeta) as ProtocolMeta;
  } catch {
    return {
      success: false,
      error: "Invalid _protocolMeta: failed to parse JSON",
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
  const functionArgs = buildFunctionArgs(
    input,
    meta.protocolSlug,
    meta.contractKey,
    meta.functionName
  );

  // 6. Delegate to writeContractCore
  const coreInput: WriteContractCoreInput = {
    contractAddress,
    network: input.network,
    abi: resolvedAbi,
    abiFunction: meta.functionName,
    functionArgs,
    _context: input._context
      ? {
          executionId: input._context.executionId,
          triggerType: input._context.triggerType,
        }
      : undefined,
  };

  return await writeContractCore(coreInput);
}

export const _integrationType = "protocol";
