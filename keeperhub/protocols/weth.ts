import { defineProtocol } from "@/keeperhub/lib/protocol-registry";

export default defineProtocol({
  name: "WETH",
  slug: "weth",
  description:
    "Wrapped Ether -- wrap ETH to WETH (ERC-20) and unwrap back to ETH",
  website: "https://weth.io",

  contracts: {
    weth: {
      label: "WETH Contract",
      addresses: {
        // Ethereum Mainnet
        "1": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        // Base
        "8453": "0x4200000000000000000000000000000000000006",
        // Arbitrum One
        "42161": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        // Optimism
        "10": "0x4200000000000000000000000000000000000006",
      },
      // ABI omitted -- resolved automatically via abi-cache
    },
  },

  actions: [
    {
      slug: "wrap",
      label: "Wrap ETH",
      description:
        "Wrap native ETH into WETH (ERC-20). Send ETH value with the transaction.",
      type: "write",
      contract: "weth",
      function: "deposit",
      inputs: [],
    },
    {
      slug: "unwrap",
      label: "Unwrap WETH",
      description: "Unwrap WETH back to native ETH",
      type: "write",
      contract: "weth",
      function: "withdraw",
      inputs: [{ name: "wad", type: "uint256", label: "Amount (wei)" }],
    },
    {
      slug: "balance-of",
      label: "Get Balance",
      description: "Check WETH balance of an address",
      type: "read",
      contract: "weth",
      function: "balanceOf",
      inputs: [{ name: "account", type: "address", label: "Wallet Address" }],
      outputs: [
        {
          name: "balance",
          type: "uint256",
          label: "WETH Balance (wei)",
          decimals: 18,
        },
      ],
    },
  ],
});
