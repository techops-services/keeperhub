import { describe, expect, it } from "vitest";
import {
  getProtocol,
  registerProtocol,
} from "@/keeperhub/lib/protocol-registry";
import skyDef from "@/keeperhub/protocols/sky";

const KEBAB_CASE_REGEX = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const HEX_ADDRESS_REGEX = /^0x[\dA-Fa-f]{40}$/;

describe("Sky Protocol Definition", () => {
  it("imports without throwing", () => {
    expect(skyDef).toBeDefined();
    expect(skyDef.name).toBe("Sky");
    expect(skyDef.slug).toBe("sky");
  });

  it("protocol slug is valid kebab-case", () => {
    expect(skyDef.slug).toMatch(KEBAB_CASE_REGEX);
  });

  it("all action slugs are valid kebab-case", () => {
    for (const action of skyDef.actions) {
      expect(action.slug).toMatch(KEBAB_CASE_REGEX);
    }
  });

  it("all contract addresses are valid 42-character hex strings", () => {
    for (const [contractKey, contract] of Object.entries(skyDef.contracts)) {
      for (const [chain, address] of Object.entries(contract.addresses)) {
        expect(address, `${contractKey} on chain ${chain}`).toMatch(
          HEX_ADDRESS_REGEX
        );
        expect(address, `${contractKey} on chain ${chain} length`).toHaveLength(
          42
        );
      }
    }
  });

  it("every action references an existing contract", () => {
    const contractKeys = new Set(Object.keys(skyDef.contracts));
    for (const action of skyDef.actions) {
      expect(
        contractKeys.has(action.contract),
        `action "${action.slug}" references unknown contract "${action.contract}"`
      ).toBe(true);
    }
  });

  it("has no duplicate action slugs", () => {
    const slugs = skyDef.actions.map((a) => a.slug);
    const uniqueSlugs = new Set(slugs);
    expect(slugs.length).toBe(uniqueSlugs.size);
  });

  it("all read actions define outputs", () => {
    const readActions = skyDef.actions.filter((a) => a.type === "read");
    for (const action of readActions) {
      expect(
        action.outputs,
        `read action "${action.slug}" must have outputs`
      ).toBeDefined();
      expect(
        action.outputs?.length,
        `read action "${action.slug}" must have at least one output`
      ).toBeGreaterThan(0);
    }
  });

  it("each action's contract has at least one chain address", () => {
    for (const action of skyDef.actions) {
      const contract = skyDef.contracts[action.contract];
      expect(contract).toBeDefined();
      expect(
        Object.keys(contract.addresses).length,
        `contract "${action.contract}" for action "${action.slug}" must have at least one chain`
      ).toBeGreaterThan(0);
    }
  });

  it("has exactly 14 actions", () => {
    expect(skyDef.actions).toHaveLength(14);
  });

  it("registers in the protocol registry and is retrievable", () => {
    registerProtocol(skyDef);
    const retrieved = getProtocol("sky");
    expect(retrieved).toBeDefined();
    expect(retrieved?.slug).toBe("sky");
    expect(retrieved?.name).toBe("Sky");
  });

  it("has 6 read actions and 8 write actions", () => {
    const readActions = skyDef.actions.filter((a) => a.type === "read");
    const writeActions = skyDef.actions.filter((a) => a.type === "write");
    expect(readActions).toHaveLength(6);
    expect(writeActions).toHaveLength(8);
  });

  it("has 6 contracts", () => {
    expect(Object.keys(skyDef.contracts)).toHaveLength(6);
  });

  it("sUsds contract is available on 3 chains", () => {
    expect(Object.keys(skyDef.contracts.sUsds.addresses)).toHaveLength(3);
    expect(skyDef.contracts.sUsds.addresses["1"]).toBeDefined();
    expect(skyDef.contracts.sUsds.addresses["8453"]).toBeDefined();
    expect(skyDef.contracts.sUsds.addresses["42161"]).toBeDefined();
  });

  it("converter contracts are Ethereum-only", () => {
    const converterKeys = ["daiUsdsConverter", "mkrSkyConverter"] as const;
    for (const key of converterKeys) {
      const chains = Object.keys(skyDef.contracts[key].addresses);
      expect(chains).toEqual(["1"]);
    }
  });
});
