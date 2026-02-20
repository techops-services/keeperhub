import type { IntegrationPlugin } from "@/plugins/registry";
import { registerIntegration } from "@/plugins/registry";
import { SafeIcon } from "./icon";

const safePlugin: IntegrationPlugin = {
  type: "safe",
  label: "Safe",
  description: "Monitor and verify pending Safe multisig transactions",

  icon: SafeIcon,

  requiresCredentials: true,

  formFields: [
    {
      id: "apiKey",
      label: "API Key",
      type: "password",
      placeholder: "Your Safe Transaction Service API key",
      configKey: "apiKey",
      envVar: "apiKey",
      helpText:
        "JWT API key from the Safe developer portal. Required for accessing the Transaction Service.",
      helpLink: {
        text: "Get an API key",
        url: "https://developer.safe.global/",
      },
    },
  ],

  testConfig: {
    getTestFunction: async () => {
      const { testSafe } = await import("./test");
      return testSafe;
    },
  },

  actions: [
    {
      slug: "get-pending-transactions",
      label: "Get Pending Transactions",
      description:
        "Fetch pending multisig transactions from a Safe that have not been executed yet. Optionally filter for transactions a specific signer has not confirmed.",
      category: "Safe",
      stepFunction: "getPendingTransactionsStep",
      stepImportPath: "get-pending-transactions",
      requiresCredentials: true,
      outputFields: [
        {
          field: "success",
          description: "Whether the request succeeded",
        },
        {
          field: "transactions",
          description:
            "Array of pending transactions with safeTxHash, to, value, data, operation, nonce, confirmations, confirmationsRequired, dataDecoded, and submissionDate",
        },
        {
          field: "count",
          description: "Number of pending transactions returned",
        },
        { field: "error", description: "Error message if failed" },
      ],
      configFields: [
        {
          key: "safeAddress",
          label: "Safe Address",
          type: "template-input",
          placeholder: "0x... or {{NodeName.address}}",
          example: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          required: true,
        },
        {
          key: "network",
          label: "Network",
          type: "chain-select",
          chainTypeFilter: "evm",
          placeholder: "Select network",
          required: true,
        },
        {
          key: "signerAddress",
          label: "Signer Address",
          type: "template-input",
          placeholder:
            "0x... filter for txs this address has not signed (optional)",
          example: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
          required: false,
        },
      ],
    },
  ],
};

registerIntegration(safePlugin);

export default safePlugin;
