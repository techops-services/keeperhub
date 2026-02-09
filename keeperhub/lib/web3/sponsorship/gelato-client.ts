import "server-only";

import {
  createGelatoSmartAccountClient,
  toGelatoSmartAccount,
} from "@gelatocloud/gasless";
import type { Chain, LocalAccount, Transport, WalletClient } from "viem";

/**
 * Create a Gelato Smart Account client with EIP-7702 gas sponsorship.
 *
 * Uses the new @gelatocloud/gasless SDK which connects to api.gelato.cloud/rpc.
 * The smart account preserves the original wallet address (EIP-7702 delegation).
 *
 * @param account - Para viem LocalAccount (owner/signer)
 * @param walletClient - viem WalletClient from Para (used for reads + signing)
 * @param apiKey - Gelato API key from app.gelato.cloud
 * @returns Gelato Smart Account client ready for sendTransactionSync()
 */
export async function createSponsoredClient(
  account: LocalAccount,
  walletClient: WalletClient<Transport, Chain, LocalAccount>,
  apiKey: string
) {
  const smartAccount = toGelatoSmartAccount({
    client: walletClient,
    owner: account,
  });

  // Always use the production Gelato endpoint. The SDK defaults to
  // api.t.gelato.cloud for testnet chains, but Gelato Cloud API keys
  // are configured for api.gelato.cloud regardless of chain type.
  return await createGelatoSmartAccountClient({
    account: smartAccount,
    apiKey,
    baseUrl: "https://api.gelato.cloud",
  });
}
