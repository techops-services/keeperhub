import { getProtocol } from "@/keeperhub/lib/protocol-registry";

export type ProtocolMeta = {
  protocolSlug: string;
  contractKey: string;
  functionName: string;
  actionType: "read" | "write";
};

/**
 * Resolve protocol metadata from _protocolMeta JSON string or _actionType fallback.
 *
 * Primary path: parse the _protocolMeta JSON string injected as a hidden config field.
 * Fallback: derive metadata from the _actionType string (e.g. "sky/get-usds-balance")
 * by looking up the protocol registry at runtime.
 */
export function resolveProtocolMeta(input: {
  _protocolMeta?: string;
  _actionType?: string;
}): ProtocolMeta | undefined {
  if (typeof input._protocolMeta === "string" && input._protocolMeta !== "") {
    try {
      return JSON.parse(input._protocolMeta) as ProtocolMeta;
    } catch {
      // fall through to _actionType derivation
    }
  }

  if (typeof input._actionType !== "string") {
    return undefined;
  }

  const slashIdx = input._actionType.indexOf("/");
  if (slashIdx <= 0) {
    return undefined;
  }

  const protocolSlug = input._actionType.substring(0, slashIdx);
  const actionSlug = input._actionType.substring(slashIdx + 1);
  const protocol = getProtocol(protocolSlug);
  if (!protocol) {
    return undefined;
  }

  const action = protocol.actions.find((a) => a.slug === actionSlug);
  if (!action) {
    return undefined;
  }

  return {
    protocolSlug,
    contractKey: action.contract,
    functionName: action.function,
    actionType: action.type,
  };
}
