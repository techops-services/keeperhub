import "server-only";

import type { Hex } from "viem";
import { getGelatoApiKey } from "./config";
import { createSponsoredClient } from "./gelato-client";
import { createParaViemAccount } from "./para-viem-adapter";

type SponsoredCall = {
  to: Hex;
  data?: Hex;
  value?: bigint;
};

type SponsoredTxRequest = {
  organizationId: string;
  chainId: number;
  rpcUrl: string;
  calls: SponsoredCall[];
};

type SponsoredTxSuccess = {
  success: true;
  txHash: string;
  sponsoredBy: "gelato";
};

type SponsoredTxFailure = {
  success: false;
  error: string;
};

export type SponsoredTxResult = SponsoredTxSuccess | SponsoredTxFailure;

/**
 * Send a gas-sponsored transaction via Gelato's EIP-7702 infrastructure.
 *
 * This is the core abstraction for sponsored transactions. It:
 * 1. Creates a viem Account from Para's MPC signer
 * 2. Creates a Gelato Smart Account client with sponsorship
 * 3. Submits the transaction via Gelato's relayer (KeeperHub pays gas)
 * 4. Waits for on-chain confirmation
 *
 * Gelato handles nonce management for sponsored transactions.
 * The caller does NOT need to acquire a nonce session.
 *
 * On failure, returns { success: false, error } - the caller should
 * surface this error directly. There is NO fallback to client-pays-gas.
 */
export async function sendSponsoredTransaction(
  request: SponsoredTxRequest
): Promise<SponsoredTxResult> {
  const { organizationId, chainId, rpcUrl, calls } = request;

  try {
    const apiKey = getGelatoApiKey();

    // Step 1: Create viem account from Para MPC signer
    const { account, walletClient, walletAddress } =
      await createParaViemAccount(organizationId, chainId, rpcUrl);

    console.log(
      `[Sponsorship] Sending sponsored tx: wallet=${walletAddress}, chain=${chainId}, calls=${calls.length}`
    );

    // Step 2: Create Gelato Smart Account client
    const gelatoClient = await createSponsoredClient(
      account,
      walletClient,
      apiKey
    );

    console.log("[Sponsorship] Gelato client created, submitting transaction");

    // Step 3: Submit sponsored transaction (async to avoid HTTP timeout)
    const taskId = await gelatoClient.sendTransaction({
      calls: calls.map((call) => ({
        to: call.to,
        data: call.data,
        value: call.value,
      })),
    });

    console.log(
      `[Sponsorship] Task submitted: taskId=${taskId}, waiting for receipt`
    );

    // Step 4: Poll for on-chain confirmation (handles block time > HTTP timeout)
    const receipt = await gelatoClient.waitForReceipt({
      id: taskId,
      timeout: 120_000,
    });

    const txHash = receipt.transactionHash;
    console.log(`[Sponsorship] Transaction confirmed: hash=${txHash}`);

    return {
      success: true,
      txHash,
      sponsoredBy: "gelato",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    console.error(
      `[Sponsorship] Sponsored transaction failed for chain=${chainId}:`,
      error
    );

    return {
      success: false,
      error: `Gas sponsorship failed: ${message}. Transaction was not submitted.`,
    };
  }
}
