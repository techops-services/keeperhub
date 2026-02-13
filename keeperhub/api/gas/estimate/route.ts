import { ethers } from "ethers";
import { NextResponse } from "next/server";
import { apiError } from "@/keeperhub/lib/api-error";
import { getOrganizationWalletAddress } from "@/keeperhub/lib/para/wallet-helpers";
import { getChainGasDefaults } from "@/keeperhub/lib/web3/gas-defaults";
import { auth } from "@/lib/auth";
import { ERC20_ABI } from "@/lib/contracts";
import { resolveRpcConfig } from "@/lib/rpc";

type EstimateConfig = {
  contractAddress?: string;
  abi?: string;
  abiFunction?: string;
  functionArgs?: string;
  recipientAddress?: string;
  amount?: string;
  tokenConfig?: unknown;
};

type ActionSlug = "write-contract" | "transfer-funds" | "transfer-token";

const TEMPLATE_REF_PATTERN = /\{\{.*?\}\}/;
const VALID_SLUGS: ActionSlug[] = [
  "write-contract",
  "transfer-funds",
  "transfer-token",
];

function hasTemplateRefs(value: string | undefined): boolean {
  if (!value) {
    return false;
  }
  return TEMPLATE_REF_PATTERN.test(value);
}

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * Estimate gas for a native token transfer
 */
function estimateTransferFunds(
  config: EstimateConfig,
  provider: ethers.JsonRpcProvider,
  walletAddress: string
): Promise<NextResponse | bigint> | NextResponse {
  if (!config.recipientAddress) {
    return badRequest(
      "recipientAddress is required for transfer-funds estimation"
    );
  }
  if (!ethers.isAddress(config.recipientAddress)) {
    return badRequest(`Invalid recipient address: ${config.recipientAddress}`);
  }

  return provider.estimateGas({
    from: walletAddress,
    to: config.recipientAddress,
    value: config.amount ? ethers.parseEther(config.amount) : BigInt(0),
  });
}

/**
 * Parse token address from tokenConfig object
 */
function parseTokenAddress(tokenConfig: unknown): string | undefined {
  if (!tokenConfig) {
    return;
  }
  try {
    const parsed =
      typeof tokenConfig === "string"
        ? (JSON.parse(tokenConfig) as Record<string, unknown>)
        : (tokenConfig as Record<string, unknown>);
    if (parsed.customToken && typeof parsed.customToken === "object") {
      return (parsed.customToken as Record<string, string>).address;
    }
  } catch {
    // Not parseable
  }
  return;
}

/**
 * Estimate gas for an ERC20 token transfer
 */
async function estimateTransferToken(
  config: EstimateConfig,
  provider: ethers.JsonRpcProvider,
  walletAddress: string
): Promise<NextResponse | bigint> {
  if (!config.recipientAddress) {
    return badRequest(
      "recipientAddress is required for transfer-token estimation"
    );
  }

  const tokenAddress = parseTokenAddress(config.tokenConfig);
  if (!(tokenAddress && ethers.isAddress(tokenAddress))) {
    return badRequest(
      "Valid token address is required for transfer-token estimation"
    );
  }

  const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const decimals = Number(await tokenContract.decimals());
  const amountRaw = config.amount
    ? ethers.parseUnits(config.amount, decimals)
    : BigInt(0);

  return tokenContract.transfer.estimateGas(
    config.recipientAddress,
    amountRaw,
    { from: walletAddress }
  );
}

/**
 * Estimate gas for a contract write call
 */
function estimateWriteContract(
  config: EstimateConfig,
  provider: ethers.JsonRpcProvider,
  walletAddress: string
): Promise<bigint> | NextResponse {
  if (!(config.contractAddress && config.abi && config.abiFunction)) {
    return badRequest(
      "contractAddress, abi, and abiFunction are required for write-contract estimation"
    );
  }
  if (!ethers.isAddress(config.contractAddress)) {
    return badRequest(`Invalid contract address: ${config.contractAddress}`);
  }

  let parsedAbi: ethers.InterfaceAbi;
  try {
    parsedAbi = JSON.parse(config.abi) as ethers.InterfaceAbi;
  } catch {
    return badRequest("Invalid ABI JSON");
  }

  let args: unknown[] = [];
  if (config.functionArgs && config.functionArgs.trim() !== "") {
    try {
      args = JSON.parse(config.functionArgs) as unknown[];
    } catch {
      return badRequest("Invalid function arguments JSON");
    }
  }

  const contract = new ethers.Contract(
    config.contractAddress,
    parsedAbi,
    provider
  );

  const fn = contract[config.abiFunction];
  if (typeof fn !== "function") {
    return badRequest(`Function '${config.abiFunction}' not found in ABI`);
  }

  return fn.estimateGas(...args, { from: walletAddress });
}

/**
 * Validate common request fields and return parsed values
 */
async function validateRequest(request: Request): Promise<
  | NextResponse
  | {
      chainId: number;
      actionSlug: ActionSlug;
      config: EstimateConfig;
      activeOrgId: string;
    }
> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeOrgId = session.session.activeOrganizationId;
  if (!activeOrgId) {
    return badRequest("No active organization");
  }

  const body = (await request.json().catch(() => ({}))) as Partial<{
    chainId: number;
    actionSlug: ActionSlug;
    config: EstimateConfig;
  }>;

  const { chainId: rawChainId, actionSlug, config } = body;

  if (!(rawChainId && actionSlug && config)) {
    return badRequest("chainId, actionSlug, and config are required");
  }

  if (!VALID_SLUGS.includes(actionSlug)) {
    return badRequest(
      `Invalid actionSlug. Must be one of: ${VALID_SLUGS.join(", ")}`
    );
  }

  const configValues = [
    config.contractAddress,
    config.abi,
    config.abiFunction,
    config.functionArgs,
    config.recipientAddress,
    config.amount,
  ];
  if (configValues.some(hasTemplateRefs)) {
    return badRequest(
      "Cannot estimate gas with template references ({{...}}). Provide literal values."
    );
  }

  const chainId = Number(rawChainId);
  if (Number.isNaN(chainId)) {
    return badRequest("Invalid chainId");
  }

  return { chainId, actionSlug, config, activeOrgId };
}

/**
 * POST /api/gas/estimate
 *
 * Returns a gas estimate for a given action configuration.
 * Requires authenticated session (uses org wallet address as `from`).
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const validated = await validateRequest(request);
    if (validated instanceof NextResponse) {
      return validated;
    }

    const { chainId, actionSlug, config, activeOrgId } = validated;

    const rpcConfig = await resolveRpcConfig(chainId);
    if (!rpcConfig) {
      return badRequest(`Chain ${chainId} not found or not enabled`);
    }

    const provider = new ethers.JsonRpcProvider(rpcConfig.primaryRpcUrl);

    let walletAddress: string;
    try {
      walletAddress = await getOrganizationWalletAddress(activeOrgId);
    } catch {
      return badRequest("No wallet configured. Create a wallet first.");
    }

    let result: NextResponse | bigint;

    switch (actionSlug) {
      case "transfer-funds":
        result = await estimateTransferFunds(config, provider, walletAddress);
        break;
      case "transfer-token":
        result = await estimateTransferToken(config, provider, walletAddress);
        break;
      case "write-contract":
        result = await estimateWriteContract(config, provider, walletAddress);
        break;
      default:
        return badRequest(`Unsupported action: ${actionSlug as string}`);
    }

    // If the estimator returned a NextResponse, it's an error
    if (result instanceof NextResponse) {
      return result;
    }

    const chainDefaults = getChainGasDefaults(chainId);

    return NextResponse.json({
      estimatedGas: result.toString(),
      chainDefaults: {
        multiplier: chainDefaults.multiplier,
        conservative: chainDefaults.conservative,
      },
    });
  } catch (error) {
    return apiError(error, "Failed to estimate gas");
  }
}
