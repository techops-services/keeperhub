import { ethers } from "ethers";

/**
 * Compute the 4-byte function selector from a name and its input types.
 * Returns a hex string like "0xcdffacc6".
 */
export function computeSelector(name: string, inputTypes: string[]): string {
  const signature = `${name}(${inputTypes.join(",")})`;
  return ethers.id(signature).slice(0, 10);
}
