import { ethers } from "ethers";
import { parseAbi } from "viem";

// Contract addresses from deployment
export const CONTRACTS = {
  credits:
    process.env.NEXT_PUBLIC_CREDITS_CONTRACT_ADDRESS ||
    "0xfc0179B208DeB77216EE1909Ad41F2D3bC203273",
  tiers:
    process.env.NEXT_PUBLIC_TIERS_CONTRACT_ADDRESS ||
    "0x65EffaE281b3566635c1da5F77801Db0b8b50774",
};

// Stablecoin addresses by network
export const STABLECOINS = {
  mainnet: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    USDS: "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
  },
  sepolia: {
    USDC: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle's official
    USDT: "0x9F3BDc4459f0436eA0fe925d9aE6963eF1b7bb17", // Our mock USDT
    USDS: "0x39d38839AAC04327577c795b4aC1E1235700EfCF", // Our mock USDS
  },
} as const;

// Supported tokens with metadata
export const SUPPORTED_TOKENS = [
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    icon: "💵",
  },
  {
    symbol: "USDT",
    name: "Tether USD",
    decimals: 6,
    icon: "💲",
  },
  {
    symbol: "USDS",
    name: "Sky Dollar",
    decimals: 18,
    icon: "💰",
  },
] as const;

// Chain configuration
export const CHAIN_CONFIG = {
  chainId: Number.parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || "11155111", 10),
  rpcUrl: process.env.ETH_RPC_URL || "",
};

// Get stablecoin address for current network
export function getStablecoinAddress(symbol: "USDC" | "USDT" | "USDS"): `0x${string}` {
  const isMainnet = CHAIN_CONFIG.chainId === 1;
  const network = isMainnet ? "mainnet" : "sepolia";
  return STABLECOINS[network][symbol] as `0x${string}`;
}

// Convert USD amount to token amount based on token decimals
export function usdToTokenAmount(usdAmount: number, decimals: number): bigint {
  // USD amount is in dollars (e.g., 25 = $25)
  // Token amount needs to be in token's smallest unit
  // For 6 decimals (USDC/USDT): $25 = 25_000_000 (25 * 10^6)
  // For 18 decimals (USDS): $25 = 25_000_000_000_000_000_000 (25 * 10^18)
  return BigInt(Math.floor(usdAmount * Math.pow(10, decimals)));
}

// Minimal ABIs for event parsing and reading
export const CREDITS_ABI = parseAbi([
  "event CreditsDeposited(address indexed sender, bytes32 indexed orgId, address token, uint256 amountPaid, uint256 usdValue, uint256 creditsIssued)",
  "function getEthPrice() view returns (uint256)",
  "function calculateCredits(uint256 usdAmount) view returns (uint256)",
  "function usdToEth(uint256 usdAmount) view returns (uint256)",
  "function depositETH(bytes32 orgId) payable",
  "function depositStable(bytes32 orgId, address token, uint256 amount)",
]);

export const TIERS_ABI = parseAbi([
  "event TierMinted(address indexed recipient, bytes32 indexed orgId, uint8 tier, bool isLifetime, uint256 tokenId, uint256 expiresAt)",
  "event TierRenewed(bytes32 indexed orgId, uint256 tokenId, uint256 newExpiresAt)",
  "function checkAccess(bytes32 orgId) view returns (uint8 tier, bool valid, uint256 expiresAt)",
  "function tierPricing(uint8 tier) view returns (uint256 annualPrice, uint256 lifetimePrice)",
]);

// ERC20 ABI for token operations
export const ERC20_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
]);

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
  // USDC (Circle's official on Sepolia)
  if (addr === "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238") {
    return "USDC";
  }
  // USDT (our mock on Sepolia)
  if (addr === "0x9f3bdc4459f0436ea0fe925d9ae6963ef1b7bb17") {
    return "USDT";
  }
  // USDS (our mock on Sepolia)
  if (addr === "0x39d38839aac04327577c795b4ac1e1235700efcf") {
    return "USDS";
  }
  return tokenAddress;
}
