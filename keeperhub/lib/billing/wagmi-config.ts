"use client";

import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;

// Log RPC URL configuration (only in development)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log(
    "Wagmi Config - Sepolia RPC URL:",
    sepoliaRpcUrl ? "✓ Set" : "✗ Not set"
  );
  console.log(
    "Wagmi Config - WalletConnect Project ID:",
    projectId ? "✓ Set" : "✗ Not set"
  );
}

export const wagmiConfig = createConfig({
  chains: [sepolia, mainnet],
  connectors: [
    injected(),
    walletConnect({
      projectId,
      showQrModal: true,
    }),
  ],
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl || undefined), // undefined will use default public RPC
    [mainnet.id]: http(),
  },
  ssr: true,
});

export { mainnet, sepolia } from "wagmi/chains";
