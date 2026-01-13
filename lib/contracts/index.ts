/**
 * Contract ABIs and addresses for common protocols
 *
 * ABIs sourced from:
 * - ERC20: OpenZeppelin Contracts v5.0.0 (IERC20Metadata)
 * - Multicall3: https://github.com/mds1/multicall
 */

// Re-export ABIs
// biome-ignore lint/performance/noBarrelFile: intentional barrel for contract ABIs
export { default as ERC20_ABI } from "./abis/erc20.json";
export { default as MULTICALL3_ABI } from "./abis/multicall3.json";

// Well-known contract addresses
export const MULTICALL3_ADDRESS = "0xcA11bde05977b3631167028862bE2a173976CA11";
