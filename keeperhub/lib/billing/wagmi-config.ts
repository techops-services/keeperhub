"use client";

import { createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { getRpcUrlByChainId } from "@/lib/rpc/rpc-config";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";

// Get RPC URLs from CHAIN_RPC_CONFIG (available during SSR)
// Falls back to wagmi's public RPC on client-side if not available
function getSepoliaRpcUrl(): string | undefined {
  try {
    return getRpcUrlByChainId(11_155_111, "primary"); // Sepolia chain ID
  } catch {
    return; // Will use wagmi's public RPC as fallback
  }
}

function getMainnetRpcUrl(): string | undefined {
  try {
    return getRpcUrlByChainId(1, "primary"); // Mainnet chain ID
  } catch {
    return; // Will use wagmi's public RPC as fallback
  }
}

const sepoliaRpcUrl = getSepoliaRpcUrl();
const mainnetRpcUrl = getMainnetRpcUrl();

// Log RPC URL configuration (only in development)
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  console.log(
    "Wagmi Config - Sepolia RPC URL:",
    sepoliaRpcUrl ? "✓ Set" : "✗ Using public RPC"
  );
  console.log(
    "Wagmi Config - Mainnet RPC URL:",
    mainnetRpcUrl ? "✓ Set" : "✗ Using public RPC"
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
    [sepolia.id]: http(sepoliaRpcUrl || undefined), // undefined will use wagmi's public RPC
    [mainnet.id]: http(mainnetRpcUrl || undefined), // undefined will use wagmi's public RPC
  },
  ssr: true,
});

export { mainnet, sepolia } from "wagmi/chains";
