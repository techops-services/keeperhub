import { defineProtocol } from "@/keeperhub/lib/protocol-registry";

export default defineProtocol({
  name: "Sky",
  slug: "sky",
  description:
    "Sky Protocol (formerly MakerDAO) -- USDS savings, token management, and DAI/MKR migration",
  website: "https://sky.money",
  icon: "/protocols/sky.png",

  contracts: {
    sUsds: {
      label: "sUSDS (Savings USDS)",
      // Proxy contract
      addresses: {
        // Ethereum Mainnet
        "1": "0xa3931d71877C0E7a3148CB7Eb4463524FEc27fbD",
        // Base
        "8453": "0x5875eEE11Cf8398102FdAd704C9E96607675467a",
        // Arbitrum One
        "42161": "0xdDb46999F8891663a8F2828d25298f70416d7610",
      },
      // ABI omitted -- resolved automatically via abi-cache
    },
    usds: {
      label: "USDS Stablecoin",
      // Proxy contract
      addresses: {
        // Ethereum Mainnet
        "1": "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
        // Base
        "8453": "0x820C137fa70C8691f0e44Dc420a5e53c168921Dc",
        // Arbitrum One
        "42161": "0x6491c05A82219b8D1479057361ff1654749b876b",
      },
      // ABI omitted -- resolved automatically via abi-cache
    },
    dai: {
      label: "DAI Stablecoin (Legacy)",
      addresses: {
        // Ethereum Mainnet
        "1": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      },
      // ABI omitted -- resolved automatically via abi-cache
    },
    sky: {
      label: "SKY Governance Token",
      addresses: {
        // Ethereum Mainnet
        "1": "0x56072C95FAA701256059aa122697B133aDEd9279",
      },
      // ABI omitted -- resolved automatically via abi-cache
    },
    daiUsdsConverter: {
      label: "DAI-USDS Converter",
      addresses: {
        // Ethereum Mainnet
        "1": "0x3225737a9Bbb6473CB4a45b7244ACa2BeFdB276A",
      },
      // ABI omitted -- resolved automatically via abi-cache
    },
    mkrSkyConverter: {
      label: "MKR-SKY Converter",
      addresses: {
        // Ethereum Mainnet
        "1": "0xA1Ea1bA18E88C381C724a75F23a130420C403f9a",
      },
      // ABI omitted -- resolved automatically via abi-cache
    },
  },

  actions: [
    // Savings

    {
      slug: "deposit-ssr",
      label: "Deposit USDS to Savings",
      description: "Deposit USDS into the sUSDS savings vault (ERC-4626)",
      type: "write",
      contract: "sUsds",
      function: "deposit",
      inputs: [
        { name: "assets", type: "uint256", label: "USDS Amount (wei)" },
        { name: "receiver", type: "address", label: "Receiver Address" },
      ],
    },
    {
      slug: "withdraw-ssr",
      label: "Withdraw USDS from Savings",
      description: "Withdraw USDS from the sUSDS savings vault by asset amount",
      type: "write",
      contract: "sUsds",
      function: "withdraw",
      inputs: [
        { name: "assets", type: "uint256", label: "USDS Amount (wei)" },
        { name: "receiver", type: "address", label: "Receiver Address" },
        { name: "owner", type: "address", label: "Share Owner Address" },
      ],
    },
    {
      slug: "redeem-ssr",
      label: "Redeem sUSDS Shares",
      description: "Redeem sUSDS shares for USDS from the savings vault",
      type: "write",
      contract: "sUsds",
      function: "redeem",
      inputs: [
        { name: "shares", type: "uint256", label: "sUSDS Shares (wei)" },
        { name: "receiver", type: "address", label: "Receiver Address" },
        { name: "owner", type: "address", label: "Share Owner Address" },
      ],
    },
    {
      slug: "get-susds-balance",
      label: "Get sUSDS Balance",
      description: "Check the sUSDS balance of an address",
      type: "read",
      contract: "sUsds",
      function: "balanceOf",
      inputs: [{ name: "account", type: "address", label: "Wallet Address" }],
      outputs: [
        {
          name: "balance",
          type: "uint256",
          label: "sUSDS Balance (wei)",
          decimals: 18,
        },
      ],
    },
    {
      slug: "preview-deposit",
      label: "Preview Savings Deposit",
      description:
        "Preview how many sUSDS shares a given USDS deposit would yield",
      type: "read",
      contract: "sUsds",
      function: "previewDeposit",
      inputs: [{ name: "assets", type: "uint256", label: "USDS Amount (wei)" }],
      outputs: [
        {
          name: "shares",
          type: "uint256",
          label: "sUSDS Shares Received",
          decimals: 18,
        },
      ],
    },
    {
      slug: "get-susds-value",
      label: "Get USDS Value of sUSDS",
      description:
        "Convert sUSDS shares to their underlying USDS value at the current rate",
      type: "read",
      contract: "sUsds",
      function: "convertToAssets",
      inputs: [
        { name: "shares", type: "uint256", label: "sUSDS Shares (wei)" },
      ],
      outputs: [
        {
          name: "assets",
          type: "uint256",
          label: "USDS Value (wei)",
          decimals: 18,
        },
      ],
    },

    // Token Balances

    {
      slug: "get-usds-balance",
      label: "Get USDS Balance",
      description: "Check the USDS balance of an address",
      type: "read",
      contract: "usds",
      function: "balanceOf",
      inputs: [{ name: "account", type: "address", label: "Wallet Address" }],
      outputs: [
        {
          name: "balance",
          type: "uint256",
          label: "USDS Balance (wei)",
          decimals: 18,
        },
      ],
    },
    {
      slug: "get-dai-balance",
      label: "Get DAI Balance",
      description: "Check the DAI balance of an address",
      type: "read",
      contract: "dai",
      function: "balanceOf",
      inputs: [{ name: "account", type: "address", label: "Wallet Address" }],
      outputs: [
        {
          name: "balance",
          type: "uint256",
          label: "DAI Balance (wei)",
          decimals: 18,
        },
      ],
    },
    {
      slug: "get-sky-balance",
      label: "Get SKY Balance",
      description: "Check the SKY balance of an address",
      type: "read",
      contract: "sky",
      function: "balanceOf",
      inputs: [{ name: "account", type: "address", label: "Wallet Address" }],
      outputs: [
        {
          name: "balance",
          type: "uint256",
          label: "SKY Balance (wei)",
          decimals: 18,
        },
      ],
    },

    // Approvals

    {
      slug: "approve-usds",
      label: "Approve USDS Spending",
      description: "Approve a spender to transfer USDS on your behalf",
      type: "write",
      contract: "usds",
      function: "approve",
      inputs: [
        { name: "spender", type: "address", label: "Spender Address" },
        { name: "amount", type: "uint256", label: "Approval Amount (wei)" },
      ],
    },
    {
      slug: "approve-dai",
      label: "Approve DAI Spending",
      description: "Approve a spender to transfer DAI on your behalf",
      type: "write",
      contract: "dai",
      function: "approve",
      inputs: [
        { name: "spender", type: "address", label: "Spender Address" },
        { name: "amount", type: "uint256", label: "Approval Amount (wei)" },
      ],
    },

    // Converters

    {
      slug: "convert-dai-to-usds",
      label: "Convert DAI to USDS",
      description:
        "Convert DAI to USDS at a 1:1 rate via the official converter (Ethereum only)",
      type: "write",
      contract: "daiUsdsConverter",
      function: "daiToUsds",
      inputs: [
        { name: "usr", type: "address", label: "Recipient Address" },
        { name: "amount", type: "uint256", label: "DAI Amount (wei)" },
      ],
    },
    {
      slug: "convert-usds-to-dai",
      label: "Convert USDS to DAI",
      description:
        "Convert USDS back to DAI at a 1:1 rate via the official converter (Ethereum only)",
      type: "write",
      contract: "daiUsdsConverter",
      function: "usdsToDai",
      inputs: [
        { name: "usr", type: "address", label: "Recipient Address" },
        { name: "amount", type: "uint256", label: "USDS Amount (wei)" },
      ],
    },
    {
      slug: "convert-mkr-to-sky",
      label: "Convert MKR to SKY",
      description:
        "Convert MKR governance tokens to SKY via the official converter (Ethereum only)",
      type: "write",
      contract: "mkrSkyConverter",
      function: "mkrToSky",
      inputs: [
        { name: "usr", type: "address", label: "Recipient Address" },
        { name: "mkrAmt", type: "uint256", label: "MKR Amount (wei)" },
      ],
    },
  ],
});
