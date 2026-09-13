/**
 * #2359: a `{{...}}` token inside an array-valued config field was never
 * rendered, because processTemplates excluded arrays with `!Array.isArray`,
 * so the array fell to the identity branch. `scanForLeftoverLiterals` does
 * walk arrays, so the scan that runs immediately after the render then
 * reported the token as unresolved: a correct reference, in the one container
 * the renderer skipped.
 *
 * Coverage:
 *   - the render half walks arrays the way the scan half does, so a config
 *     whose tokens all sit inside arrays renders and assertResolved passes
 *   - a token in an array, in an array of objects, and in an object inside an
 *     array
 *   - the three step inputs whose array shape is supported end to end:
 *     web3/batch-write-contract `calls`, web3/query-transactions
 *     `functionArgs`, tempo/batch-payout `payouts`
 *   - the recursion is bounded, and a token the renderer does not reach is
 *     still reported rather than dropped
 *   - web3/read-contract accepts `functionArgs` as an array, identically to
 *     the JSON string the workflow editor sends
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/utils", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/utils")>("@/lib/utils");
  return {
    ...actual,
    getErrorMessage: (e: unknown) =>
      e instanceof Error ? e.message : String(e),
  };
});

vi.mock("@/lib/logging", () => ({
  logUserError: vi.fn(),
  ErrorCategory: {
    VALIDATION: "validation",
    SYSTEM: "system",
    NETWORK: "network",
    EXECUTION: "execution",
    USER: "user",
  },
}));

const {
  mockGetChainIdFromNetwork,
  mockGetRpcProvider,
  mockReadContract,
  mockGetRpcPreferenceUserId,
} = vi.hoisted(() => ({
  mockGetChainIdFromNetwork: vi.fn(),
  mockGetRpcProvider: vi.fn(),
  mockReadContract: vi.fn(),
  mockGetRpcPreferenceUserId: vi.fn(),
}));

vi.mock("@/lib/rpc/network-utils", () => ({
  getChainIdFromNetwork: (...args: unknown[]) =>
    mockGetChainIdFromNetwork(...args),
}));

vi.mock("@/lib/rpc/provider-factory", () => ({
  getRpcProvider: (...args: unknown[]) => mockGetRpcProvider(...args),
}));

vi.mock("@/lib/web3/chain-adapter", () => ({
  getChainAdapter: () => ({
    readContract: mockReadContract,
    getAddressUrl: (address: string) =>
      `https://sepolia.etherscan.io/address/${address}`,
  }),
}));

vi.mock("@/lib/workflow/executor/helpers", () => ({
  getRpcPreferenceUserId: (...args: unknown[]) =>
    mockGetRpcPreferenceUserId(...args),
}));

import { processTemplates } from "@/lib/workflow/executor/executor.workflow";
import {
  assertResolved,
  createTracker,
} from "@/lib/workflow/executor/template-resolution";
import { readContractCore } from "@/plugins/web3/steps/read-contract-core";

const WHO = "0x4F256eD4420136dfD1e595044626F0dDb9Ac2503";
const AMOUNT = "25";

const outputs = {
  trigger: {
    label: "Trigger",
    data: { who: WHO, amount: AMOUNT, count: 3, real: true },
  },
};

const storedWho = "{{@trigger:Trigger.who}}";
const storedAmount = "{{@trigger:Trigger.amount}}";

beforeEach(() => {
  mockGetChainIdFromNetwork.mockReset().mockReturnValue(11_155_111);
  mockGetRpcProvider.mockReset().mockResolvedValue({});
  mockReadContract.mockReset().mockResolvedValue("12345");
  mockGetRpcPreferenceUserId.mockReset().mockResolvedValue("user-1");
});

describe("processTemplates: arrays are rendered like objects", () => {
  it("renders a token that sits in an array", () => {
    const out = processTemplates({ functionArgs: [storedWho] }, outputs);
    expect(out.functionArgs).toEqual([WHO]);
  });

  it("renders tokens that sit in an array of objects", () => {
    const out = processTemplates(
      {
        payouts: [
          { recipient: storedWho, amount: storedAmount },
          {
            recipient: "0x0000000000000000000000000000000000000001",
            amount: "5",
          },
        ],
      },
      outputs
    );
    expect(out.payouts).toEqual([
      { recipient: WHO, amount: AMOUNT },
      {
        recipient: "0x0000000000000000000000000000000000000001",
        amount: "5",
      },
    ]);
  });

  it("renders a token in an object inside an array", () => {
    const out = processTemplates(
      { calls: [{ args: [storedWho], meta: { note: storedAmount } }] },
      outputs
    );
    expect(out.calls).toEqual([{ args: [WHO], meta: { note: AMOUNT } }]);
  });

  it("renders arrays nested inside arrays", () => {
    const out = processTemplates(
      { grid: [[storedWho], [storedAmount]] },
      outputs
    );
    expect(out.grid).toEqual([[WHO], [AMOUNT]]);
  });

  it("leaves non-string array members untouched", () => {
    const out = processTemplates(
      { mixed: [1, true, null, { n: 2 }, storedWho] },
      outputs
    );
    expect(out.mixed).toEqual([1, true, null, { n: 2 }, WHO]);
  });

  it("still renders scalars and nested objects as before", () => {
    const out = processTemplates(
      { scalar: storedWho, nested: { deep: { value: storedAmount } } },
      outputs
    );
    expect(out.scalar).toBe(WHO);
    expect(out.nested).toEqual({ deep: { value: AMOUNT } });
  });

  it("does not mutate the config it was given", () => {
    const config = { payouts: [{ recipient: storedWho }] };
    processTemplates(config, outputs);
    expect(config.payouts[0]?.recipient).toBe(storedWho);
  });

  it("passes assertResolved when every token sits inside an array", () => {
    const tracker = createTracker();
    const rendered = processTemplates(
      { payouts: [{ recipient: storedWho, amount: storedAmount }] },
      outputs,
      tracker
    );
    expect(tracker.unresolved).toHaveLength(0);
    expect(() =>
      assertResolved(tracker, rendered, { nodeId: "n1" })
    ).not.toThrow();
  });

  it("still fails closed when a token inside an array does not resolve", () => {
    const tracker = createTracker();
    const rendered = processTemplates(
      { payouts: [{ recipient: "{{@trigger:Trigger.missing}}" }] },
      outputs,
      tracker
    );
    expect(() => assertResolved(tracker, rendered, { nodeId: "n1" })).toThrow();
  });

  it("renders arrays at the same depth as objects, so neither silently drops a token", () => {
    // A depth bound at or below the scan's reporting bound would leave a band
    // where a token survives unrendered and unreported, writing a literal
    // `{{...}}` into a config with no error. Objects have never been bounded
    // here, so arrays must not be either.
    for (const depth of [1, 5, 10, 14, 20]) {
      let inObject: unknown = storedWho;
      let inArray: unknown = storedWho;
      for (let i = 0; i < depth; i++) {
        inObject = { level: inObject };
        inArray = [inArray];
      }
      const renderedObject = processTemplates(
        { v: inObject } as Record<string, unknown>,
        outputs
      );
      const renderedArray = processTemplates(
        { v: inArray } as Record<string, unknown>,
        outputs
      );
      expect(JSON.stringify(renderedObject)).not.toContain("{{");
      expect(JSON.stringify(renderedArray)).not.toContain("{{");
    }
  });
});

describe("#2359: the three step inputs whose array shape is supported end to end", () => {
  it("web3/batch-write-contract `calls`: a token in a call's args resolves", () => {
    const out = processTemplates(
      {
        network: "sepolia",
        calls: [
          {
            contractAddress: "0x29f2D40B0605204364af54EC677bD022dA425d03",
            abi: "[]",
            abiFunction: "balanceOf",
            args: [storedWho],
          },
        ],
      },
      outputs
    );
    const calls = out.calls as Array<{ args: unknown[] }>;
    expect(calls[0]?.args).toEqual([WHO]);
  });

  it("web3/query-transactions `functionArgs`: a token in the array resolves", () => {
    const out = processTemplates(
      { network: "sepolia", functionArgs: [storedWho, ""] },
      outputs
    );
    expect(out.functionArgs).toEqual([WHO, ""]);
  });

  it("tempo/batch-payout `payouts`: a token where an address belongs resolves", () => {
    const out = processTemplates(
      {
        network: "sepolia",
        payouts: [{ recipient: storedWho, amount: storedAmount }],
      },
      outputs
    );
    expect(out.payouts).toEqual([{ recipient: WHO, amount: AMOUNT }]);
  });
});

describe("#2359: read-contract accepts functionArgs as an array", () => {
  const ABI = JSON.stringify([
    {
      type: "function",
      name: "balanceOf",
      stateMutability: "view",
      inputs: [{ name: "who", type: "address" }],
      outputs: [{ name: "", type: "uint256" }],
    },
  ]);

  const base = {
    contractAddress: "0x29f2D40B0605204364af54EC677bD022dA425d03",
    network: "sepolia",
    abi: ABI,
    abiFunction: "balanceOf",
  };

  it("parses the array shape identically to the JSON string shape", async () => {
    const asString = await readContractCore({
      ...base,
      functionArgs: JSON.stringify([WHO]),
    });
    const asArray = await readContractCore({ ...base, functionArgs: [WHO] });

    expect(asString.success).toBe(true);
    expect(asArray.success).toBe(true);
    expect(mockReadContract).toHaveBeenCalledTimes(2);
    expect(mockReadContract.mock.calls[0]?.[1].args).toEqual(
      mockReadContract.mock.calls[1]?.[1].args
    );
  });

  it("does not report a parse failure for the array shape", async () => {
    // The pre-fix failure was an uncaught TypeError from `functionArgs.trim()`
    // on an array, once the renderer stopped skipping arrays.
    const result = await readContractCore({ ...base, functionArgs: [WHO] });
    expect(result.success).toBe(true);
    expect(String(result.error ?? "")).not.toMatch(
      /Invalid function arguments JSON|trim is not a function/
    );
  });

  it("keeps rejecting a JSON string that is not an array", async () => {
    const result = await readContractCore({
      ...base,
      functionArgs: JSON.stringify({ who: WHO }),
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe("Function arguments must be a JSON array");
  });

  it("treats an empty array as no arguments, like the empty string", async () => {
    const noArgAbi = JSON.stringify([
      {
        type: "function",
        name: "totalSupply",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint256" }],
      },
    ]);
    const asArray = await readContractCore({
      ...base,
      abi: noArgAbi,
      abiFunction: "totalSupply",
      functionArgs: [],
    });
    const asString = await readContractCore({
      ...base,
      abi: noArgAbi,
      abiFunction: "totalSupply",
      functionArgs: "[]",
    });
    expect(asArray.success).toBe(true);
    expect(asString.success).toBe(true);
    expect(mockReadContract.mock.calls[0]?.[1].args).toEqual([]);
    expect(mockReadContract.mock.calls[1]?.[1].args).toEqual([]);
  });
});
