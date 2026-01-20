import { ethers } from "ethers";

// Contract addresses from deployment
export const CONTRACTS = {
  credits:
    process.env.NEXT_PUBLIC_CREDITS_CONTRACT_ADDRESS ||
    "0xfc0179B208DeB77216EE1909Ad41F2D3bC203273",
  tiers:
    process.env.NEXT_PUBLIC_TIERS_CONTRACT_ADDRESS ||
    "0x65EffaE281b3566635c1da5F77801Db0b8b50774",
};

// Chain configuration
export const CHAIN_CONFIG = {
  chainId: Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111", 10),
  rpcUrl: process.env.ETH_RPC_URL || "",
};

// Minimal ABIs for event parsing and reading
export const CREDITS_ABI = [
  "event CreditsDeposited(address indexed sender, bytes32 indexed orgId, address token, uint256 amountPaid, uint256 usdValue, uint256 creditsIssued)",
  "function getEthPrice() view returns (uint256)",
  "function calculateCredits(uint256 usdAmount) view returns (uint256)",
  "function usdToEth(uint256 usdAmount) view returns (uint256)",
] as const;

export const TIERS_ABI = [
  "event TierMinted(address indexed recipient, bytes32 indexed orgId, uint8 tier, bool isLifetime, uint256 tokenId, uint256 expiresAt)",
  "event TierRenewed(bytes32 indexed orgId, uint256 tokenId, uint256 newExpiresAt)",
  "function checkAccess(bytes32 orgId) view returns (uint8 tier, bool valid, uint256 expiresAt)",
  "function tierPricing(uint8 tier) view returns (uint256 annualPrice, uint256 lifetimePrice)",
] as const;

// Get provider instance
export function getProvider() {
  if (!CHAIN_CONFIG.rpcUrl) {
    throw new Error("ETH_RPC_URL not configured");
  }
  return new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
}

// Get contract instances
export function getCreditsContract() {
  return new ethers.Contract(CONTRACTS.credits, CREDITS_ABI, getProvider());
}

export function getTiersContract() {
  return new ethers.Contract(CONTRACTS.tiers, TIERS_ABI, getProvider());
}

// Hash organization ID for contract calls
export function hashOrgId(orgId: string): string {
  return ethers.keccak256(ethers.toUtf8Bytes(orgId));
}

// Token name mapping
export function getTokenName(tokenAddress: string): string {
  const addr = tokenAddress.toLowerCase();
  if (addr === ethers.ZeroAddress.toLowerCase()) {
    return "ETH";
  }
  if (addr === "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238") {
    return "USDC";
  }
  if (addr === "0x7169d38820dfd117c3fa1f22a697dba58d90ba06") {
    return "USDT";
  }
  return tokenAddress;
}
