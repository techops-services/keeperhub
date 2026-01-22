/**
 * RPC-based proxy contract detection
 *
 * Detects proxy contracts by checking storage slots for common proxy patterns:
 * - EIP-1967 (most common)
 * - EIP-1822 (UUPS)
 * - OpenZeppelin Transparent/Upgradeable
 * - Gnosis Safe
 * - EIP-1167 (minimal proxy/clone)
 */

import { ethers } from "ethers";
import { resolveRpcConfig } from "@/lib/rpc";

export type ProxyDetectionResult = {
  isProxy: boolean;
  implementationAddress?: string;
  proxyType?:
    | "eip1967"
    | "eip1822"
    | "openzeppelin"
    | "gnosis-safe"
    | "eip1167";
};

/**
 * EIP-1967 storage slot for implementation address
 * keccak256("eip1967.proxy.implementation") - 1
 */
const EIP1967_IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

/**
 * EIP-1967 storage slot for admin address
 * keccak256("eip1967.proxy.admin") - 1
 */
const EIP1967_ADMIN_SLOT =
  "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

/**
 * EIP-1822 storage slot for implementation address
 * keccak256("PROXIABLE") - 1
 */
const EIP1822_IMPLEMENTATION_SLOT =
  "0xc5f16f0fcc639fa48a6947836d9850f504798523bf8c9a3a87d5876cf622bcf7";

/**
 * EIP-1167 minimal proxy bytecode prefix
 * 0x363d3d373d3d3d363d73 + implementation address (20 bytes) + 0x5af43d82803e903d91602b57fd5bf3
 */
const EIP1167_PREFIX = "0x363d3d373d3d3d363d73";
const EIP1167_SUFFIX = "0x5af43d82803e903d91602b57fd5bf3";

/**
 * Check if a contract is an EIP-1967 proxy
 */
async function checkEip1967Proxy(
  provider: ethers.Provider,
  contractAddress: string
): Promise<string | null> {
  try {
    const implementation = await provider.getStorage(
      contractAddress,
      EIP1967_IMPLEMENTATION_SLOT
    );

    // Storage values are 32 bytes (64 hex chars + 0x = 66 chars)
    // Addresses are 20 bytes (40 hex chars)
    // Extract the last 40 hex characters (after removing 0x prefix)
    const hexValue = implementation.startsWith("0x")
      ? implementation.slice(2)
      : implementation;

    if (hexValue.length < 40) {
      return null;
    }

    const address = ethers.getAddress(`0x${hexValue.slice(-40)}`);

    // Check if it's a valid non-zero address
    if (address && address !== ethers.ZeroAddress) {
      console.log(`[Proxy Detection] EIP-1967 proxy detected: ${address}`);
      return address;
    }
  } catch (error) {
    console.log(
      "[Proxy Detection] EIP-1967 check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
  return null;
}

/**
 * Check if a contract is an EIP-1822 (UUPS) proxy
 */
async function checkEip1822Proxy(
  provider: ethers.Provider,
  contractAddress: string
): Promise<string | null> {
  try {
    const implementation = await provider.getStorage(
      contractAddress,
      EIP1822_IMPLEMENTATION_SLOT
    );

    // Storage values are 32 bytes (64 hex chars + 0x = 66 chars)
    // Addresses are 20 bytes (40 hex chars)
    const hexValue = implementation.startsWith("0x")
      ? implementation.slice(2)
      : implementation;

    if (hexValue.length < 40) {
      return null;
    }

    const address = ethers.getAddress(`0x${hexValue.slice(-40)}`);

    // Check if it's a valid non-zero address
    if (address && address !== ethers.ZeroAddress) {
      console.log(`[Proxy Detection] EIP-1822 proxy detected: ${address}`);
      return address;
    }
  } catch (error) {
    console.log(
      "[Proxy Detection] EIP-1822 check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
  return null;
}

/**
 * Check if a contract is an OpenZeppelin proxy
 * OpenZeppelin uses the same storage slot as EIP-1967
 */
async function checkOpenZeppelinProxy(
  provider: ethers.Provider,
  contractAddress: string
): Promise<string | null> {
  // OpenZeppelin uses EIP-1967 storage slots, so we check the same slot
  // but also verify there's an admin slot (OpenZeppelin specific)
  try {
    const implementation = await checkEip1967Proxy(provider, contractAddress);
    if (implementation) {
      // Check for admin slot (OpenZeppelin TransparentProxy pattern)
      const admin = await provider.getStorage(
        contractAddress,
        EIP1967_ADMIN_SLOT
      );
      const adminHex = admin.startsWith("0x") ? admin.slice(2) : admin;
      const adminAddress =
        adminHex.length >= 40
          ? ethers.getAddress(`0x${adminHex.slice(-40)}`)
          : ethers.ZeroAddress;

      if (adminAddress && adminAddress !== ethers.ZeroAddress) {
        console.log(
          `[Proxy Detection] OpenZeppelin proxy detected: ${implementation}`
        );
        return implementation;
      }
    }
  } catch (error) {
    console.log(
      "[Proxy Detection] OpenZeppelin check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
  return null;
}

/**
 * Check if a contract is a Gnosis Safe proxy
 * Gnosis Safe proxies use delegatecall to a master copy
 */
async function checkGnosisSafeProxy(
  provider: ethers.Provider,
  contractAddress: string
): Promise<string | null> {
  try {
    // Gnosis Safe proxies store the master copy address at storage slot 0
    const masterCopy = await provider.getStorage(contractAddress, "0x0");
    const masterHex = masterCopy.startsWith("0x")
      ? masterCopy.slice(2)
      : masterCopy;
    if (masterHex.length < 40) {
      return null;
    }
    const address = ethers.getAddress(`0x${masterHex.slice(-40)}`);

    if (address && address !== ethers.ZeroAddress) {
      // Verify it's actually a Safe by checking if the master copy has Safe-like bytecode
      const code = await provider.getCode(address);
      if (code && code.length > 2) {
        // Safe contracts typically have substantial bytecode
        // This is a heuristic check
        console.log(`[Proxy Detection] Gnosis Safe proxy detected: ${address}`);
        return address;
      }
    }
  } catch (error) {
    console.log(
      "[Proxy Detection] Gnosis Safe check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
  return null;
}

/**
 * Check if a contract is an EIP-1167 minimal proxy (clone)
 */
async function checkEip1167Proxy(
  provider: ethers.Provider,
  contractAddress: string
): Promise<string | null> {
  try {
    const code = await provider.getCode(contractAddress);

    // EIP-1167 minimal proxy has a specific bytecode pattern
    if (code.startsWith(EIP1167_PREFIX) && code.includes(EIP1167_SUFFIX)) {
      // Extract implementation address from bytecode
      // Pattern: 0x363d3d373d3d3d363d73 + implementation (20 bytes) + 0x5af43d82803e903d91602b57fd5bf3
      const implementationHex = code.slice(
        EIP1167_PREFIX.length,
        EIP1167_PREFIX.length + 40
      );
      const address = ethers.getAddress(`0x${implementationHex}`);

      if (address && address !== ethers.ZeroAddress) {
        console.log(
          `[Proxy Detection] EIP-1167 minimal proxy detected: ${address}`
        );
        return address;
      }
    }
  } catch (error) {
    console.log(
      "[Proxy Detection] EIP-1167 check failed:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
  return null;
}

/**
 * Detect proxy contract via RPC calls
 * Checks multiple proxy standards in order of likelihood
 *
 * @param contractAddress - The contract address to check
 * @param chainId - The chain ID
 * @returns Proxy detection result with implementation address if found
 */
export async function detectProxyViaRpc(
  contractAddress: string,
  chainId: number
): Promise<ProxyDetectionResult> {
  console.log(
    `[Proxy Detection] Starting RPC-based proxy detection for ${contractAddress} on chain ${chainId}`
  );

  // Get RPC config
  const rpcConfig = await resolveRpcConfig(chainId);
  if (!rpcConfig) {
    console.warn(
      `[Proxy Detection] No RPC config found for chain ${chainId}, skipping detection`
    );
    return { isProxy: false };
  }

  const provider = new ethers.JsonRpcProvider(rpcConfig.primaryRpcUrl);

  // Check proxy patterns in order of likelihood
  // 1. EIP-1967 (most common)
  const eip1967Impl = await checkEip1967Proxy(provider, contractAddress);
  if (eip1967Impl) {
    return {
      isProxy: true,
      implementationAddress: eip1967Impl,
      proxyType: "eip1967",
    };
  }

  // 2. OpenZeppelin (uses EIP-1967 slots but with admin)
  const ozImpl = await checkOpenZeppelinProxy(provider, contractAddress);
  if (ozImpl) {
    return {
      isProxy: true,
      implementationAddress: ozImpl,
      proxyType: "openzeppelin",
    };
  }

  // 3. EIP-1822 (UUPS)
  const eip1822Impl = await checkEip1822Proxy(provider, contractAddress);
  if (eip1822Impl) {
    return {
      isProxy: true,
      implementationAddress: eip1822Impl,
      proxyType: "eip1822",
    };
  }

  // 4. EIP-1167 (minimal proxy/clone)
  const eip1167Impl = await checkEip1167Proxy(provider, contractAddress);
  if (eip1167Impl) {
    return {
      isProxy: true,
      implementationAddress: eip1167Impl,
      proxyType: "eip1167",
    };
  }

  // 5. Gnosis Safe (less common, more expensive check)
  const gnosisImpl = await checkGnosisSafeProxy(provider, contractAddress);
  if (gnosisImpl) {
    return {
      isProxy: true,
      implementationAddress: gnosisImpl,
      proxyType: "gnosis-safe",
    };
  }

  console.log(
    `[Proxy Detection] No proxy pattern detected for ${contractAddress}`
  );
  return { isProxy: false };
}
