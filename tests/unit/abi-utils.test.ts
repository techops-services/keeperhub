import { describe, expect, it } from "vitest";

import { computeSelector } from "@/keeperhub/lib/abi-utils";

describe("computeSelector", () => {
  it("returns correct 4-byte selector for transfer(address,uint256)", () => {
    expect(computeSelector("transfer", ["address", "uint256"])).toBe(
      "0xa9059cbb"
    );
  });

  it("returns correct 4-byte selector for approve(address,uint256)", () => {
    expect(computeSelector("approve", ["address", "uint256"])).toBe(
      "0x095ea7b3"
    );
  });

  it("returns correct 4-byte selector for balanceOf(address)", () => {
    expect(computeSelector("balanceOf", ["address"])).toBe("0x70a08231");
  });

  it("returns correct selector for no-arg function", () => {
    expect(computeSelector("totalSupply", [])).toBe("0x18160ddd");
  });

  it("returns a 10-character hex string (0x + 8 hex digits)", () => {
    const result = computeSelector("foo", ["uint256"]);
    expect(result).toMatch(/^0x[\da-f]{8}$/);
  });
});
