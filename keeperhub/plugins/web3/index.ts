import type { IntegrationPlugin } from "@/plugins/registry";
import { registerIntegration } from "@/plugins/registry";
import { Web3Icon } from "./icon";

const web3Plugin: IntegrationPlugin = {
  type: "web3",
  label: "Web3",
  description: "Interact with blockchain networks using your Para wallet",

  icon: Web3Icon,

  // Web3 uses Para wallet - one wallet per user
  singleConnection: true,

  // No form fields - wallet creation is handled by the custom form handler
  formFields: [],

  testConfig: {
    getTestFunction: async () => {
      const { testWeb3 } = await import("./test");
      return testWeb3;
    },
  },

  actions: [
    {
      slug: "check-balance",
      label: "Get Native Balance",
      description: "Get native token balance (ETH, MATIC, etc.) of any address",
      category: "Web3",
      stepFunction: "checkBalanceStep",
      stepImportPath: "check-balance",
      outputFields: [
        {
          field: "success",
          description: "Whether the balance check succeeded",
        },
        {
          field: "balance",
          description: "Balance in ETH (human-readable)",
        },
        {
          field: "balanceWei",
          description: "Balance in Wei (smallest unit)",
        },
        {
          field: "address",
          description: "The address that was checked",
        },
        {
          field: "error",
          description: "Error message if the check failed",
        },
      ],
      configFields: [
        {
          key: "network",
          label: "Network",
          type: "chain-select",
          chainTypeFilter: "evm",
          placeholder: "Select network",
          required: true,
        },
        {
          key: "address",
          label: "Address",
          type: "template-input",
          placeholder: "0x... or {{NodeName.address}}",
          example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          required: true,
        },
      ],
    },
    {
      slug: "check-token-balance",
      label: "Get ERC20 Token Balance",
      description: "Get ERC20 token balance of any address",
      category: "Web3",
      stepFunction: "checkTokenBalanceStep",
      stepImportPath: "check-token-balance",
      outputFields: [
        {
          field: "success",
          description: "Whether the balance check succeeded",
        },
        {
          field: "balance",
          description: "Token balance object",
        },
        {
          field: "balance.balance",
          description: "The token balance amount (human-readable string)",
        },
        {
          field: "balance.balanceRaw",
          description: "The token balance in raw units (string)",
        },
        {
          field: "balance.symbol",
          description: "The token symbol (e.g., USDC)",
        },
        {
          field: "balance.decimals",
          description: "The token decimals",
        },
        {
          field: "balance.name",
          description: "The token name",
        },
        {
          field: "balance.tokenAddress",
          description: "The token contract address",
        },
        {
          field: "address",
          description: "The wallet address that was checked",
        },
        {
          field: "addressLink",
          description: "Explorer link to the wallet address",
        },
        {
          field: "error",
          description: "Error message if the check failed",
        },
      ],
      configFields: [
        {
          key: "network",
          label: "Network",
          type: "chain-select",
          chainTypeFilter: "evm",
          placeholder: "Select network",
          required: true,
        },
        {
          key: "address",
          label: "Address",
          type: "template-input",
          placeholder: "0x... or {{NodeName.address}}",
          example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          required: true,
        },
        {
          key: "tokenConfig",
          label: "Token",
          type: "token-select",
          networkField: "network",
          required: true,
        },
      ],
    },
    {
      slug: "transfer-funds",
      label: "Transfer Native Token",
      description:
        "Transfer native tokens (ETH, MATIC, etc.) from your wallet to a recipient address",
      category: "Web3",
      stepFunction: "transferFundsStep",
      stepImportPath: "transfer-funds",
      outputFields: [
        {
          field: "success",
          description: "Whether the transfer succeeded",
        },
        {
          field: "transactionHash",
          description: "The transaction hash of the successful transfer",
        },
        {
          field: "error",
          description: "Error message if the transfer failed",
        },
      ],
      configFields: [
        {
          key: "network",
          label: "Network",
          type: "chain-select",
          chainTypeFilter: "evm",
          placeholder: "Select network",
          required: true,
        },
        {
          key: "amount",
          label: "Amount (ETH)",
          type: "template-input",
          placeholder: "0.1 or {{NodeName.amount}}",
          example: "0.1",
          required: true,
        },
        {
          key: "recipientAddress",
          label: "Recipient Address",
          type: "template-input",
          placeholder: "0x... or {{NodeName.address}}",
          example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          required: true,
        },
      ],
    },
    {
      slug: "transfer-token",
      label: "Transfer ERC20 Token",
      description: "Transfer ERC20 tokens on your desired EVM chain",
      category: "Web3",
      stepFunction: "transferTokenStep",
      stepImportPath: "transfer-token",
      outputFields: [
        {
          field: "success",
          description: "Whether the transfer succeeded",
        },
        {
          field: "transactionHash",
          description: "The transaction hash of the successful transfer",
        },
        {
          field: "transactionLink",
          description: "Explorer link to view the transaction",
        },
        {
          field: "amount",
          description: "The amount transferred (human-readable)",
        },
        {
          field: "symbol",
          description: "The token symbol (e.g., USDC)",
        },
        {
          field: "recipient",
          description: "The recipient address",
        },
        {
          field: "error",
          description: "Error message if the transfer failed",
        },
      ],
      configFields: [
        {
          key: "network",
          label: "Network",
          type: "chain-select",
          chainTypeFilter: "evm",
          placeholder: "Select network",
          required: true,
        },
        {
          key: "tokenConfig",
          label: "Token",
          type: "token-select",
          networkField: "network",
          required: true,
        },
        {
          key: "amount",
          label: "Amount",
          type: "template-input",
          placeholder: "100.50 or {{NodeName.amount}}",
          example: "100.50",
          required: true,
        },
        {
          key: "recipientAddress",
          label: "Recipient Address",
          type: "template-input",
          placeholder: "0x... or {{NodeName.address}}",
          example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
          required: true,
        },
      ],
    },
    {
      slug: "read-contract",
      label: "Read Contract",
      description: "Read data from a smart contract (view/pure functions)",
      category: "Web3",
      stepFunction: "readContractStep",
      stepImportPath: "read-contract",
      outputFields: [
        {
          field: "success",
          description: "Whether the contract call succeeded",
        },
        {
          field: "result",
          description:
            "The contract function return value (structured based on ABI outputs)",
        },
        {
          field: "error",
          description: "Error message if the call failed",
        },
      ],
      configFields: [
        {
          key: "network",
          label: "Network",
          type: "chain-select",
          chainTypeFilter: "evm",
          placeholder: "Select network",
          required: true,
        },
        {
          key: "contractAddress",
          label: "Contract Address",
          type: "template-input",
          placeholder: "0x... or {{NodeName.contractAddress}}",
          example: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          required: true,
        },
        {
          key: "abi",
          label: "Contract ABI",
          type: "abi-with-auto-fetch",
          contractAddressField: "contractAddress",
          networkField: "network",
          rows: 6,
          required: true,
        },
        {
          key: "abiFunction",
          label: "Function",
          type: "abi-function-select",
          abiField: "abi",
          placeholder: "Select a function",
          required: true,
        },
        {
          key: "functionArgs",
          label: "Function Arguments",
          type: "abi-function-args",
          abiField: "abi",
          abiFunctionField: "abiFunction",
        },
      ],
    },
    {
      slug: "write-contract",
      label: "Write Contract",
      description: "Write data to a smart contract (state-changing functions)",
      category: "Web3",
      stepFunction: "writeContractStep",
      stepImportPath: "write-contract",
      outputFields: [
        {
          field: "success",
          description: "Whether the contract call succeeded",
        },
        {
          field: "transactionHash",
          description: "The transaction hash of the successful write",
        },
        {
          field: "result",
          description: "The contract function return value (if any)",
        },
        {
          field: "error",
          description: "Error message if the call failed",
        },
      ],
      configFields: [
        {
          key: "network",
          label: "Network",
          type: "chain-select",
          chainTypeFilter: "evm",
          placeholder: "Select network",
          required: true,
        },
        {
          key: "contractAddress",
          label: "Contract Address",
          type: "template-input",
          placeholder: "0x... or {{NodeName.contractAddress}}",
          example: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
          required: true,
        },
        {
          key: "abi",
          label: "Contract ABI",
          type: "abi-with-auto-fetch",
          contractAddressField: "contractAddress",
          networkField: "network",
          rows: 6,
          required: true,
        },
        {
          key: "abiFunction",
          label: "Function",
          type: "abi-function-select",
          abiField: "abi",
          functionFilter: "write",
          placeholder: "Select a function",
          required: true,
        },
        {
          key: "functionArgs",
          label: "Function Arguments",
          type: "abi-function-args",
          abiField: "abi",
          abiFunctionField: "abiFunction",
        },
      ],
    },
  ],
};

// Auto-register on import
registerIntegration(web3Plugin);

export default web3Plugin;
