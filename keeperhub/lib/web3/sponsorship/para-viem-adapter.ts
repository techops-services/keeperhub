import "server-only";

import { Environment, Para as ParaServer } from "@getpara/server-sdk";
import {
  createParaAccount,
  createParaViemClient,
  getViemChain,
} from "@getpara/viem-v2-integration";
import type { Chain, LocalAccount, Transport, WalletClient } from "viem";
import { http } from "viem";
import { decryptUserShare } from "@/keeperhub/lib/encryption";
import { getOrganizationWallet } from "@/keeperhub/lib/para/wallet-helpers";

type ParaCoreCompat = Parameters<typeof createParaAccount>[0];

type ParaViemAccountResult = {
  account: LocalAccount;
  walletClient: WalletClient<Transport, Chain, LocalAccount>;
  chain: Chain;
  walletAddress: string;
};

/**
 * Create a viem-compatible Account and WalletClient from Para server SDK.
 *
 * This bridges Para's MPC signing to viem's account abstraction,
 * enabling Gelato Smart Wallet integration with EIP-7702 support.
 *
 * Follows the same wallet lookup pattern as initializeParaSigner() in wallet-helpers.ts.
 */
export async function createParaViemAccount(
  organizationId: string,
  chainId: number,
  rpcUrl: string
): Promise<ParaViemAccountResult> {
  const PARA_API_KEY = process.env.PARA_API_KEY;
  const PARA_ENV = process.env.PARA_ENVIRONMENT || "beta";

  if (!PARA_API_KEY) {
    throw new Error("PARA_API_KEY not configured");
  }

  // Get organization's wallet from database (same as wallet-helpers.ts)
  const wallet = await getOrganizationWallet(organizationId);

  // Initialize Para client
  const paraClient = new ParaServer(
    PARA_ENV === "prod" ? Environment.PROD : Environment.BETA,
    PARA_API_KEY
  );

  // Decrypt and set user's keyshare
  const decryptedShare = decryptUserShare(wallet.userShare);
  await paraClient.setUserShare(decryptedShare);

  // Resolve viem chain from chainId
  const chain = getViemChain(chainId.toString());

  // Cast Para to ParaCore-compatible type (TS #private fields prevent direct assignability)
  const paraCore = paraClient as unknown as ParaCoreCompat;

  // Create viem LocalAccount from Para (includes signAuthorization for EIP-7702)
  // Do NOT pass walletAddress - Para's findWalletByAddress() only searches
  // currentWalletIds (not populated by setUserShare). Without an address,
  // it uses findWalletId() which searches this.wallets (populated by setUserShare).
  const account = createParaAccount(paraCore);

  // Create viem WalletClient with Para account
  const walletClient = createParaViemClient(paraCore, {
    chain,
    transport: http(rpcUrl),
  });

  return {
    account,
    walletClient,
    chain,
    walletAddress: account.address,
  };
}
