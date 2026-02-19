const CHAIN_NAMES: Record<string, string> = {
  "1": "Ethereum",
  "10": "Optimism",
  "8453": "Base",
  "42161": "Arbitrum",
  "11155111": "Sepolia",
  "84532": "Base Sepolia",
  "42429": "Tempo Testnet",
  "42420": "Tempo",
  "101": "Solana",
  "103": "Solana Devnet",
};

export function getChainName(chainId: string): string {
  return CHAIN_NAMES[chainId] ?? `Chain ${chainId}`;
}
