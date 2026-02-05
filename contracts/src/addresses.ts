// Chainlink ETH/USD Price Feed addresses
export const CHAINLINK_ETH_USD = {
  mainnet: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
  sepolia: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
} as const;

// Stablecoin addresses
export const STABLECOINS = {
  mainnet: {
    usdc: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    usdt: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    usds: "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
  },
  sepolia: {
    usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Circle's official Sepolia USDC
    usdt: "0x9F3BDc4459f0436eA0fe925d9aE6963eF1b7bb17", // Our mock USDT
    usds: "0x39d38839AAC04327577c795b4aC1E1235700EfCF", // Our mock USDS
  },
} as const;
