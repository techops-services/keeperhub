import { describe, expect, it } from "vitest";
import { testCode } from "@/keeperhub/plugins/code/test";

describe("code/test - VM sanity check", () => {
  it("succeeds when VM is functional", async () => {
    const result = await testCode({});
    expect(result).toEqual({ success: true });
  });

  it("accepts arbitrary credentials object", async () => {
    const result = await testCode({ key: "value", other: "thing" });
    expect(result).toEqual({ success: true });
  });
});
