import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/steps/step-handler", () => ({
  withStepLogging: (_input: unknown, fn: () => unknown) => fn(),
}));

vi.mock("@/keeperhub/lib/metrics/instrumentation/plugin", () => ({
  withPluginMetrics: (_opts: unknown, fn: () => unknown) => fn(),
}));

vi.mock("@/keeperhub/lib/logging", () => ({
  ErrorCategory: { VALIDATION: "VALIDATION" },
  // biome-ignore lint/suspicious/noEmptyBlockStatements: intentional no-op mock
  logUserError: () => {},
}));

import {
  type RunCodeCoreInput,
  type RunCodeInput,
  runCodeStep,
} from "@/keeperhub/plugins/code/steps/run-code";

type SuccessResult = {
  success: true;
  result: unknown;
  logs: Array<{ level: string; args: unknown[] }>;
};

type FailureResult = {
  success: false;
  error: string;
  logs: Array<{ level: string; args: unknown[] }>;
  line?: number;
};

type RunCodeResult = SuccessResult | FailureResult;

function makeInput(overrides: Partial<RunCodeCoreInput>): RunCodeInput {
  return {
    code: "",
    ...overrides,
  } as RunCodeInput;
}

async function run(
  overrides: Partial<RunCodeCoreInput>
): Promise<RunCodeResult> {
  return (await runCodeStep(makeInput(overrides))) as RunCodeResult;
}

async function expectSuccess(
  overrides: Partial<RunCodeCoreInput>
): Promise<SuccessResult> {
  const result = await run(overrides);
  // biome-ignore lint/suspicious/noMisplacedAssertion: helper called exclusively from inside test() blocks
  expect(result.success).toBe(true);
  return result as SuccessResult;
}

async function expectFailure(
  overrides: Partial<RunCodeCoreInput>
): Promise<FailureResult> {
  const result = await run(overrides);
  // biome-ignore lint/suspicious/noMisplacedAssertion: helper called exclusively from inside test() blocks
  expect(result.success).toBe(false);
  return result as FailureResult;
}

// --- Basic Execution ---------------------------------------------------------

describe("code/run-code - basic execution", () => {
  it("returns the result of a simple expression", async () => {
    const result = await expectSuccess({ code: "return 1 + 2" });
    expect(result.result).toBe(3);
  });

  it("returns undefined when code has no return", async () => {
    const result = await expectSuccess({ code: "const x = 1;" });
    expect(result.result).toBeUndefined();
  });

  it("returns objects", async () => {
    const result = await expectSuccess({
      code: 'return { name: "test", count: 42 }',
    });
    expect(result.result).toEqual({ name: "test", count: 42 });
  });

  it("returns arrays", async () => {
    const result = await expectSuccess({
      code: "return [1, 2, 3].map(x => x * 2)",
    });
    expect(result.result).toEqual([2, 4, 6]);
  });

  it("supports await at top level", async () => {
    const result = await expectSuccess({
      code: "const val = await Promise.resolve(99); return val;",
    });
    expect(result.result).toBe(99);
  });

  it("supports multiline code", async () => {
    const code = [
      "const items = [10, 20, 30];",
      "const total = items.reduce((s, v) => s + v, 0);",
      "return { total, count: items.length };",
    ].join("\n");
    const result = await expectSuccess({ code });
    expect(result.result).toEqual({ total: 60, count: 3 });
  });
});

// --- BigInt Support -----------------------------------------------------------

describe("code/run-code - BigInt support", () => {
  it("creates and returns BigInt values", async () => {
    const result = await expectSuccess({
      code: "return BigInt('9007199254740993')",
    });
    expect(result.result).toBe(BigInt("9007199254740993"));
  });

  it("performs BigInt arithmetic", async () => {
    const code = [
      "const a = BigInt('9007199254740993');",
      "const b = BigInt('9007199254740994');",
      "return a + b;",
    ].join("\n");
    const result = await expectSuccess({ code });
    expect(result.result).toBe(BigInt("18014398509481987"));
  });

  it("uses BigInt literals", async () => {
    const result = await expectSuccess({
      code: "return 123456789012345678901234567890n;",
    });
    expect(result.result).toBe(BigInt("123456789012345678901234567890"));
  });

  it("compares BigInt values", async () => {
    const code = [
      "const wei = BigInt('1000000000000000000');",
      "const threshold = BigInt('500000000000000000');",
      "return wei > threshold;",
    ].join("\n");
    const result = await expectSuccess({ code });
    expect(result.result).toBe(true);
  });

  it("converts BigInt to string for JSON-safe output", async () => {
    const code = [
      "const val = BigInt('9007199254740993');",
      "return { value: val.toString(), isLarge: true };",
    ].join("\n");
    const result = await expectSuccess({ code });
    expect(result.result).toEqual({
      value: "9007199254740993",
      isLarge: true,
    });
  });

  it("uses BigInt with template-resolved numeric values", async () => {
    const code = [
      "const amount = 1000000000000000000;",
      "const threshold = BigInt('500000000000000000');",
      "return BigInt(amount) > threshold;",
    ].join("\n");
    const result = await expectSuccess({ code });
    expect(result.result).toBe(true);
  });
});

// --- Console Capture ---------------------------------------------------------

describe("code/run-code - console capture", () => {
  it("captures console.log", async () => {
    const result = await expectSuccess({
      code: 'console.log("hello"); return true;',
    });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toEqual({ level: "log", args: ["hello"] });
  });

  it("captures console.warn and console.error", async () => {
    const code = [
      'console.warn("warning");',
      'console.error("error");',
      "return true;",
    ].join("\n");
    const result = await expectSuccess({ code });
    expect(result.logs).toHaveLength(2);
    expect(result.logs[0].level).toBe("warn");
    expect(result.logs[1].level).toBe("error");
  });

  it("captures multiple arguments", async () => {
    const result = await expectSuccess({
      code: 'console.log("count:", 42, true); return true;',
    });
    expect(result.logs[0].args).toEqual(["count:", 42, true]);
  });
});

// --- Sandbox Globals ---------------------------------------------------------

describe("code/run-code - sandbox globals", () => {
  it("has access to JSON", async () => {
    const result = await expectSuccess({
      code: "return JSON.parse('{\"a\":1}');",
    });
    expect(result.result).toEqual({ a: 1 });
  });

  it("has access to Math", async () => {
    const result = await expectSuccess({ code: "return Math.max(1, 5, 3)" });
    expect(result.result).toBe(5);
  });

  it("has access to Date", async () => {
    const result = await expectSuccess({
      code: "return typeof new Date().getTime()",
    });
    expect(result.result).toBe("number");
  });

  it("has access to Map and Set", async () => {
    const code = [
      "const m = new Map();",
      "m.set('a', 1);",
      "const s = new Set([1, 2, 3]);",
      "return { mapSize: m.size, setSize: s.size };",
    ].join("\n");
    const result = await expectSuccess({ code });
    expect(result.result).toEqual({ mapSize: 1, setSize: 3 });
  });

  it("has access to RegExp", async () => {
    const result = await expectSuccess({
      code: 'return /^hello/.test("hello world");',
    });
    expect(result.result).toBe(true);
  });

  it("has access to parseInt and parseFloat", async () => {
    const result = await expectSuccess({
      code: 'return { int: parseInt("42"), float: parseFloat("3.14") };',
    });
    expect(result.result).toEqual({ int: 42, float: 3.14 });
  });

  it("has access to encoding functions", async () => {
    const result = await expectSuccess({
      code: 'return encodeURIComponent("hello world");',
    });
    expect(result.result).toBe("hello%20world");
  });

  it("does not have access to require", async () => {
    const result = await expectFailure({ code: 'require("fs")' });
    expect(result.error).toContain("require is not defined");
  });

  it("does not have access to process", async () => {
    const result = await expectFailure({ code: "return process.env" });
    expect(result.error).toContain("process is not defined");
  });
});

// --- Error Handling ----------------------------------------------------------

describe("code/run-code - error handling", () => {
  it("fails with empty code", async () => {
    const result = await expectFailure({ code: "" });
    expect(result.error).toBe("No code provided");
  });

  it("fails with whitespace-only code", async () => {
    const result = await expectFailure({ code: "   " });
    expect(result.error).toBe("No code provided");
  });

  it("reports syntax errors", async () => {
    const result = await expectFailure({ code: "return {;" });
    expect(result.error).toContain("Code execution failed");
  });

  it("reports runtime errors", async () => {
    const code = [
      "const x = 1;",
      "const y = 2;",
      "throw new Error('oops');",
    ].join("\n");
    const result = await expectFailure({ code });
    expect(result.error).toContain("oops");
  });

  it("detects unresolved stored-format templates", async () => {
    const result = await expectFailure({
      code: "return {{@node1:Label.field}};",
    });
    expect(result.error).toContain("Unresolved template variables");
  });

  it("detects unresolved display-format templates", async () => {
    const result = await expectFailure({
      code: "return {{Label.field}};",
    });
    expect(result.error).toContain("Unresolved template variables");
  });

  it("preserves console logs even on error", async () => {
    const code = [
      'console.log("before error");',
      "throw new Error('fail');",
    ].join("\n");
    const result = await expectFailure({ code });
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0].args).toEqual(["before error"]);
  });
});

// --- Timeout -----------------------------------------------------------------

describe("code/run-code - timeout", () => {
  it("uses custom timeout", async () => {
    const result = await expectSuccess({
      code: "return true;",
      timeout: 5,
    });
    expect(result.result).toBe(true);
  });

  it("clamps timeout to max 120 seconds", async () => {
    const result = await expectSuccess({
      code: "return true;",
      timeout: 999,
    });
    expect(result.result).toBe(true);
  });

  it("clamps timeout to min 1 second", async () => {
    const result = await expectSuccess({
      code: "return true;",
      timeout: 0,
    });
    expect(result.result).toBe(true);
  });
});
