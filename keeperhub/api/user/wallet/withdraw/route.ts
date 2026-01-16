import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { apiError } from "@/keeperhub/lib/api-error";
import { initializeParaSigner } from "@/keeperhub/lib/para/wallet-helpers";
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

async function executeERC20Transfer(
  signer: ethers.Signer,
  tokenAddress: string,
  amount: string,
  recipient: string
): Promise<string> {
  const contract = new ethers.Contract(
    tokenAddress,
    ERC20_TRANSFER_ABI,
    signer
  );
  const decimals = await contract.decimals();
  const amountWei = ethers.parseUnits(amount, decimals);
  const tx = await contract.transfer(recipient, amountWei);
  console.log(`[Withdraw] Transaction sent: ${tx.hash}`);
  const receipt = await tx.wait();
  return receipt.hash;
}

async function executeNativeTransfer(
  signer: ethers.Signer,
  amount: string,
  recipient: string
): Promise<string> {
  const amountWei = ethers.parseEther(amount);
  const tx = await signer.sendTransaction({
    to: recipient,
    value: amountWei,
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

    // 4. Initialize Para signer
    console.log(
      `[Withdraw] Initializing signer for org ${organizationId} on chain ${chain.name}`
    );
    const signer = await initializeParaSigner(
      organizationId,
      chain.defaultPrimaryRpc
    );

    // 5. Execute transfer
    const txHash = tokenAddress
      ? await executeERC20Transfer(signer, tokenAddress, amount, recipient)
      : await executeNativeTransfer(signer, amount, recipient);

    console.log(`[Withdraw] Transaction confirmed: ${txHash}`);

    return NextResponse.json({
      success: true,
      txHash,
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
