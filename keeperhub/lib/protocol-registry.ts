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
