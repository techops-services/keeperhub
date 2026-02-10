import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/keeperhub/lib/api-error";
import {
  getOrganizationWalletAddress,
  initializeParaSigner,
} from "@/keeperhub/lib/para/wallet-helpers";
import { getGasStrategy } from "@/keeperhub/lib/web3/gas-strategy";
import { getNonceManager } from "@/keeperhub/lib/web3/nonce-manager";
import {
  isSponsorshipAvailable,
  sendSponsoredTransaction,
} from "@/keeperhub/lib/web3/sponsorship";
import {
  type TransactionContext,
  withNonceSession,
} from "@/keeperhub/lib/web3/transaction-manager";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { chains } from "@/lib/db/schema";

const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

function handleTransferError(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("insufficient funds")) {
      return NextResponse.json(
        { error: "Insufficient funds for transfer and gas" },
        { status: 400 }
      );
    }

    if (message.includes("nonce")) {
      return NextResponse.json(
        { error: "Transaction nonce error. Please try again." },
        { status: 400 }
      );
    }
  }
  return null;
}

type TransferOptions = {
  nonce: number;
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
};

async function executeERC20Transfer(
  signer: ethers.Signer,
  tokenAddress: string,
  amount: string,
  recipient: string,
  options: TransferOptions
): Promise<string> {
  const contract = new ethers.Contract(
    tokenAddress,
    ERC20_TRANSFER_ABI,
    signer
  );
  const decimals = await contract.decimals();
  const amountWei = ethers.parseUnits(amount, decimals);
  const tx = await contract.transfer(recipient, amountWei, {
    nonce: options.nonce,
    gasLimit: options.gasLimit,
    maxFeePerGas: options.maxFeePerGas,
    maxPriorityFeePerGas: options.maxPriorityFeePerGas,
  });
  console.log(`[Withdraw] Transaction sent: ${tx.hash}`);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function executeNativeTransfer(
  signer: ethers.Signer,
  amount: string,
  recipient: string,
  options: TransferOptions
): Promise<string> {
  const amountWei = ethers.parseEther(amount);
  const tx = await signer.sendTransaction({
    to: recipient,
    value: amountWei,
    nonce: options.nonce,
    gasLimit: options.gasLimit,
    maxFeePerGas: options.maxFeePerGas,
    maxPriorityFeePerGas: options.maxPriorityFeePerGas,
  });
  console.log(`[Withdraw] Transaction sent: ${tx.hash}`);
  const receipt = await tx.wait();
  return receipt?.hash || tx.hash;
}

// Validate user authentication and admin permissions
async function validateUserAndOrganization(request: Request) {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return { error: "Unauthorized", status: 401 };
  }

  const activeOrgId = session.session.activeOrganizationId;

  if (!activeOrgId) {
    return {
      error: "No active organization. Please select or create an organization.",
      status: 400,
    };
  }

  const activeMember = await auth.api.getActiveMember({
    headers: await headers(),
  });

  if (!activeMember) {
    return {
      error: "You are not a member of the active organization",
      status: 403,
    };
  }

  const role = activeMember.role;
  if (role !== "admin" && role !== "owner") {
    return {
      error: "Only organization admins and owners can withdraw funds",
      status: 403,
    };
  }

  return { user: session.user, organizationId: activeOrgId };
}

export async function POST(request: Request) {
  try {
    // 1. Validate user and permissions
    const validation = await validateUserAndOrganization(request);
    if ("error" in validation) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }
    const { organizationId } = validation;

    // 2. Parse request body
    const body = await request.json();
    const { chainId, tokenAddress, amount, recipient } = body;

    if (!(chainId && amount && recipient)) {
      return NextResponse.json(
        { error: "Missing required fields: chainId, amount, recipient" },
        { status: 400 }
      );
    }

    // Validate recipient address
    if (!ethers.isAddress(recipient)) {
      return NextResponse.json(
        { error: "Invalid recipient address" },
        { status: 400 }
      );
    }

    // Validate amount
    const parsedAmount = Number.parseFloat(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // 3. Get chain info from database
    const chainResult = await db
      .select()
      .from(chains)
      .where(eq(chains.chainId, chainId))
      .limit(1);

    if (chainResult.length === 0) {
      return NextResponse.json(
        { error: `Chain ${chainId} not found` },
        { status: 404 }
      );
    }

    const chain = chainResult[0];
    const rpcUrl = chain.defaultPrimaryRpc;

    // 4. Get wallet address for nonce management
    const walletAddress = await getOrganizationWalletAddress(organizationId);

    // Generate a unique execution ID for this API call
    const executionId = `withdraw-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // Build transaction context
    const txContext: TransactionContext = {
      organizationId,
      executionId,
      chainId,
      rpcUrl,
      triggerType: "manual",
    };

    // Execute transaction with nonce management
    const result = await withNonceSession(
      txContext,
      walletAddress,
      async (session) => {
        // --- Gas sponsorship path ---
        if (await isSponsorshipAvailable(chainId)) {
          let calls: Array<{
            to: `0x${string}`;
            data?: `0x${string}`;
            value?: bigint;
          }>;

          if (tokenAddress) {
            const readProvider = new ethers.JsonRpcProvider(rpcUrl);
            const readContract = new ethers.Contract(
              tokenAddress,
              ERC20_TRANSFER_ABI,
              readProvider
            );
            const decimals = await readContract.decimals();
            const amountWei = ethers.parseUnits(amount, decimals);
            const iface = new ethers.Interface(ERC20_TRANSFER_ABI);
            const encodedData = iface.encodeFunctionData("transfer", [
              recipient,
              amountWei,
            ]);
            calls = [
              {
                to: tokenAddress as `0x${string}`,
                data: encodedData as `0x${string}`,
              },
            ];
          } else {
            const amountWei = ethers.parseEther(amount);
            calls = [{ to: recipient as `0x${string}`, value: amountWei }];
          }

          const sponsoredResult = await sendSponsoredTransaction({
            organizationId,
            chainId,
            rpcUrl,
            calls,
          });

          if (!sponsoredResult.success) {
            throw new Error(sponsoredResult.error);
          }

          return { txHash: sponsoredResult.txHash };
        }
        // --- Direct submission path (no sponsorship) ---

        const nonceManager = getNonceManager();
        const gasStrategy = getGasStrategy();

        // Initialize Para signer
        console.log(
          `[Withdraw] Initializing signer for org ${organizationId} on chain ${chain.name}`
        );
        const signer = await initializeParaSigner(organizationId, rpcUrl);
        const provider = signer.provider;

        if (!provider) {
          throw new Error("Signer has no provider");
        }

        // Get nonce from session
        const nonce = nonceManager.getNextNonce(session);

        // Estimate gas based on transfer type
        let estimatedGas: bigint;
        if (tokenAddress) {
          const contract = new ethers.Contract(
            tokenAddress,
            ERC20_TRANSFER_ABI,
            signer
          );
          const decimals = await contract.decimals();
          const amountWei = ethers.parseUnits(amount, decimals);
          estimatedGas = await contract.transfer.estimateGas(
            recipient,
            amountWei
          );
        } else {
          const amountWei = ethers.parseEther(amount);
          estimatedGas = await provider.estimateGas({
            from: walletAddress,
            to: recipient,
            value: amountWei,
          });
        }

        // Get gas configuration from strategy
        const gasConfig = await gasStrategy.getGasConfig(
          provider,
          "manual",
          estimatedGas,
          chainId
        );

        console.log("[Withdraw] Gas config:", {
          estimatedGas: estimatedGas.toString(),
          gasLimit: gasConfig.gasLimit.toString(),
          maxFeePerGas: `${ethers.formatUnits(gasConfig.maxFeePerGas, "gwei")} gwei`,
          maxPriorityFeePerGas:
            ethers.formatUnits(gasConfig.maxPriorityFeePerGas, "gwei") +
            " gwei",
        });

        const transferOptions: TransferOptions = {
          nonce,
          gasLimit: gasConfig.gasLimit,
          maxFeePerGas: gasConfig.maxFeePerGas,
          maxPriorityFeePerGas: gasConfig.maxPriorityFeePerGas,
        };

        // Execute transfer
        const txHash = tokenAddress
          ? await executeERC20Transfer(
              signer,
              tokenAddress,
              amount,
              recipient,
              transferOptions
            )
          : await executeNativeTransfer(
              signer,
              amount,
              recipient,
              transferOptions
            );

        // Record and confirm transaction
        await nonceManager.recordTransaction(
          session,
          nonce,
          txHash,
          undefined,
          gasConfig.maxFeePerGas.toString()
        );
        await nonceManager.confirmTransaction(txHash);

        console.log(`[Withdraw] Transaction confirmed: ${txHash}`);

        return { txHash };
      }
    );

    return NextResponse.json({
      success: true,
      txHash: result.txHash,
      chainId,
      tokenAddress: tokenAddress || null,
      amount,
      recipient,
    });
  } catch (error) {
    console.error("[Withdraw] Failed:", error);
    const errorResponse = handleTransferError(error);
    return errorResponse ?? apiError(error, "Failed to execute withdrawal");
  }
}
