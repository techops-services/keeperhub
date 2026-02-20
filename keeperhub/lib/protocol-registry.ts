import { ProtocolIcon } from "@/keeperhub/plugins/protocol/icon";
import type { IntegrationType } from "@/lib/types/integration";
import type {
  ActionConfigFieldBase,
  IntegrationPlugin,
  PluginAction,
} from "@/plugins/registry";

const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const HEX_ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

export type ProtocolContract = {
  label: string;
  addresses: Record<string, string>;
  abi?: string;
};

export type ProtocolActionInput = {
  name: string;
  type: string;
  label: string;
  default?: string;
  decimals?: boolean | number;
};

export type ProtocolActionOutput = {
  name: string;
  type: string;
  label: string;
  decimals?: number;
};

export type ProtocolAction = {
  slug: string;
  label: string;
  description: string;
  type: "read" | "write";
  contract: string;
  function: string;
  inputs: ProtocolActionInput[];
  outputs?: ProtocolActionOutput[];
};

export type ProtocolDefinition = {
  name: string;
  slug: string;
  description: string;
  website?: string;
  icon?: string;
  contracts: Record<string, ProtocolContract>;
  actions: ProtocolAction[];
};

function validateSlug(slug: string, context: string): void {
  if (!KEBAB_CASE_REGEX.test(slug)) {
    throw new Error(
      `Invalid slug "${slug}" in ${context}: must be kebab-case (lowercase letters, digits, hyphens; must start with a letter)`
    );
  }
}

function validateAddresses(contracts: Record<string, ProtocolContract>): void {
  for (const [contractKey, contract] of Object.entries(contracts)) {
    for (const [chain, address] of Object.entries(contract.addresses)) {
      if (!HEX_ADDRESS_REGEX.test(address)) {
        throw new Error(
          `Invalid address "${address}" for contract "${contractKey}" on chain "${chain}": must be a 42-character hex string starting with 0x`
        );
      }
    }
  }
}

function validateContractRefs(
  actions: ProtocolAction[],
  contracts: Record<string, ProtocolContract>
): void {
  for (const action of actions) {
    if (!(action.contract in contracts)) {
      throw new Error(
        `Action "${action.slug}" references unknown contract "${action.contract}". Available contracts: ${Object.keys(contracts).join(", ")}`
      );
    }
  }
}

export function defineProtocol(def: ProtocolDefinition): ProtocolDefinition {
  if (Object.keys(def.contracts).length === 0) {
    throw new Error(`Protocol "${def.slug}" must define at least one contract`);
  }

  if (def.actions.length === 0) {
    throw new Error(`Protocol "${def.slug}" must define at least one action`);
  }

  validateSlug(def.slug, `protocol "${def.name}"`);

  for (const action of def.actions) {
    validateSlug(action.slug, `action of protocol "${def.slug}"`);
  }

  validateAddresses(def.contracts);
  validateContractRefs(def.actions, def.contracts);

  return def;
}

// Runtime protocol registry
const protocolRegistry = new Map<string, ProtocolDefinition>();

export function registerProtocol(def: ProtocolDefinition): void {
  defineProtocol(def);
  protocolRegistry.set(def.slug, def);
}

export function getProtocol(slug: string): ProtocolDefinition | undefined {
  return protocolRegistry.get(slug);
}

export function getRegisteredProtocols(): ProtocolDefinition[] {
  return Array.from(protocolRegistry.values());
}

function buildConfigFieldsFromAction(
  def: ProtocolDefinition,
  action: ProtocolAction
): ActionConfigFieldBase[] {
  const fields: ActionConfigFieldBase[] = [
    {
      key: "network",
      label: "Network",
      type: "chain-select",
      chainTypeFilter: "evm",
      required: true,
    },
  ];

  for (const input of action.inputs) {
    fields.push({
      key: input.name,
      label: input.label,
      type: "template-input",
      placeholder: input.default ?? "",
      required: true,
    });
  }

  const metaValue = JSON.stringify({
    protocolSlug: def.slug,
    contractKey: action.contract,
    functionName: action.function,
    actionType: action.type,
  });

  fields.push({
    key: "_protocolMeta",
    label: "Protocol Metadata",
    type: "text",
    defaultValue: metaValue,
  });

  return fields;
}

function buildOutputFieldsFromAction(
  action: ProtocolAction
): Array<{ field: string; description: string }> {
  const outputs: Array<{ field: string; description: string }> = [];

  if (action.outputs) {
    for (const output of action.outputs) {
      outputs.push({ field: output.name, description: output.label });
    }
  }

  outputs.push({
    field: "success",
    description: "Whether the operation succeeded",
  });
  outputs.push({
    field: "error",
    description: "Error message if the operation failed",
  });

  if (action.type === "write") {
    outputs.push({ field: "transactionHash", description: "Transaction hash" });
    outputs.push({
      field: "transactionLink",
      description: "Explorer link to transaction",
    });
  }

  return outputs;
}

export function protocolActionToPluginAction(
  def: ProtocolDefinition,
  action: ProtocolAction
): PluginAction {
  return {
    slug: action.slug,
    label: `${def.name}: ${action.label}`,
    description: action.description,
    category: "Protocol",
    stepFunction:
      action.type === "read" ? "protocolReadStep" : "protocolWriteStep",
    stepImportPath: action.type === "read" ? "protocol-read" : "protocol-write",
    requiresCredentials: action.type === "write",
    configFields: buildConfigFieldsFromAction(def, action),
    outputFields: buildOutputFieldsFromAction(action),
  };
}

export function protocolToPlugin(def: ProtocolDefinition): IntegrationPlugin {
  return {
    type: def.slug as IntegrationType,
    label: def.name,
    description: def.description,
    icon: ProtocolIcon,
    requiresCredentials: false,
    singleConnection: true,
    formFields: [],
    actions: def.actions.map((action) =>
      protocolActionToPluginAction(def, action)
    ),
  };
}
