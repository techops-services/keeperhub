import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Mock step-handler to avoid database/logging dependencies
vi.mock("@/lib/steps/step-handler", () => ({
  withStepLogging: (_input: unknown, fn: () => unknown) => fn(),
}));

import { type ForEachInput, forEachStep } from "../for-each";

function makeInput(overrides: Partial<ForEachInput> = {}): ForEachInput {
  return {
    arrayLength: 5,
    maxIterations: 100,
    ...overrides,
  };
}

describe("forEachStep", () => {
  it("returns success with input values echoed back", async () => {
    const result = await forEachStep(makeInput());
    expect(result).toEqual({
      success: true,
      arrayLength: 5,
      maxIterations: 100,
    });
  });

  it("reflects custom maxIterations and arrayLength", async () => {
    const result = await forEachStep(
      makeInput({ arrayLength: 20, maxIterations: 50 })
    );
    expect(result.maxIterations).toBe(50);
    expect(result.arrayLength).toBe(20);
  });

  it("has maxRetries set to 0", () => {
    expect(forEachStep.maxRetries).toBe(0);
  });
});
