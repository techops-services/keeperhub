import "server-only";

import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import { withPluginMetrics } from "@/keeperhub/lib/metrics/instrumentation/plugin";
import { db } from "@/lib/db";
import { explorerConfigs, workflowExecutions } from "@/lib/db/schema";
import { getAddressUrl } from "@/lib/explorer";
import { getChainIdFromNetwork, resolveRpcConfig } from "@/lib/rpc";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

const DEFAULT_BATCH_SIZE = 2000;
const DEFAULT_BLOCK_LOOKBACK = 6500;

async function getUserIdFromExecution(
  executionId: string | undefined
): Promise<string | undefined> {
  if (!executionId) {
    return;
  }

  const execution = await db
    .select({ userId: workflowExecutions.userId })
    .from(workflowExecutions)
    .where(eq(workflowExecutions.id, executionId))
    .limit(1);

  return execution[0]?.userId;
}

type DecodedEvent = {
  blockNumber: number;
  transactionHash: string;
  logIndex: number;
  args: Record<string, unknown>;
};

type QueryEventsResult =
  | {
      success: true;
      events: DecodedEvent[];
      fromBlock: number;
      toBlock: number;
      eventCount: number;
    }
  | { success: false; error: string };

export type QueryEventsCoreInput = {
  network: string;
  contractAddress: string;
  abi: string;
  eventName: string;
  fromBlock?: string;
  toBlock?: string;
  blockCount?: number | string;
};

export type QueryEventsInput = StepInput & QueryEventsCoreInput;

type BlockRange = { fromBlock: number; toBlock: number };

function serializeBigInts(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

function decodeEventArgs(
  event: ethers.EventLog,
  eventFragment: ethers.EventFragment
): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const [index, input] of eventFragment.inputs.entries()) {
    const name = input.name || `arg${index}`;
    args[name] = serializeBigInts(event.args[index]);
  }
  return args;
}

type AbiEntry = { type: string; name: string };

function parseAbi(
  abi: string
): { success: true; parsed: AbiEntry[] } | { success: false; error: string } {
  let parsedAbi: unknown;
  try {
    parsedAbi = JSON.parse(abi);
  } catch (error) {
    return {
      success: false,
      error: `Invalid ABI JSON: ${getErrorMessage(error)}`,
    };
  }

  if (!Array.isArray(parsedAbi)) {
    return { success: false, error: "ABI must be a JSON array" };
  }

  return { success: true, parsed: parsedAbi as AbiEntry[] };
}

function parseBlockCount(
  blockCountInput: number | string | undefined
): { success: true; value: number } | { success: false; error: string } | null {
  if (blockCountInput === undefined || blockCountInput === null) {
    return null;
  }

  const strVal =
    typeof blockCountInput === "string" ? blockCountInput.trim() : "";
  if (typeof blockCountInput === "string" && strVal === "") {
    return null;
  }

  const parsed =
    typeof blockCountInput === "number"
      ? blockCountInput
      : Number.parseInt(strVal, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return {
      success: false,
      error: `Invalid blockCount value: ${blockCountInput}`,
    };
  }

  return { success: true, value: parsed };
}

function resolveFromBlock(
  fromBlockInput: string | undefined,
  blockCountInput: number | string | undefined,
  resolvedToBlock: number
): { success: true; value: number } | { success: false; error: string } {
  const fromBlockStr = fromBlockInput?.toString().trim() ?? "";

  if (fromBlockStr !== "") {
    const parsed = Number.parseInt(fromBlockStr, 10);
    if (Number.isNaN(parsed)) {
      return {
        success: false,
        error: `Invalid fromBlock value: ${fromBlockInput}`,
      };
    }
    return { success: true, value: parsed };
  }

  const blockCountResult = parseBlockCount(blockCountInput);
  if (blockCountResult !== null && !blockCountResult.success) {
    return { success: false, error: blockCountResult.error };
  }

  const lookback =
    blockCountResult !== null ? blockCountResult.value : DEFAULT_BLOCK_LOOKBACK;

  return { success: true, value: Math.max(0, resolvedToBlock - lookback) };
}

async function resolveBlockRange(
  provider: ethers.JsonRpcProvider,
  fromBlockInput: string | undefined,
  toBlockInput: string | undefined,
  blockCountInput: number | string | undefined
): Promise<
  { success: true; range: BlockRange } | { success: false; error: string }
> {
  const toBlockStr = toBlockInput?.toString().trim() ?? "";
  let resolvedToBlock: number;

  if (toBlockStr === "" || toBlockStr.toLowerCase() === "latest") {
    resolvedToBlock = await provider.getBlockNumber();
    console.log("[Query Events] Resolved latest block:", resolvedToBlock);
  } else {
    resolvedToBlock = Number.parseInt(toBlockStr, 10);
    if (Number.isNaN(resolvedToBlock)) {
      return {
        success: false,
        error: `Invalid toBlock value: ${toBlockInput}`,
      };
    }
  }

  const fromBlockResult = resolveFromBlock(
    fromBlockInput,
    blockCountInput,
    resolvedToBlock
  );
  if (!fromBlockResult.success) {
    return { success: false, error: fromBlockResult.error };
  }

  return {
    success: true,
    range: { fromBlock: fromBlockResult.value, toBlock: resolvedToBlock },
  };
}

async function queryEventBatches(
  contract: ethers.Contract,
  eventName: string,
  eventFragment: ethers.EventFragment,
  range: BlockRange
): Promise<DecodedEvent[]> {
  const batchSize = DEFAULT_BATCH_SIZE;
  const eventFilter = contract.filters[eventName]?.();
  if (eventFilter === undefined || eventFilter === null) {
    throw new Error(`Could not create filter for event '${eventName}'`);
  }

  const allEvents: DecodedEvent[] = [];

  for (
    let start = range.fromBlock;
    start <= range.toBlock;
    start += batchSize
  ) {
    const end = Math.min(start + batchSize - 1, range.toBlock);
    console.log(`[Query Events] Querying batch: blocks ${start} to ${end}`);

    const batchEvents = await contract.queryFilter(eventFilter, start, end);

    for (const event of batchEvents) {
      if (event instanceof ethers.EventLog) {
        allEvents.push({
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          logIndex: event.index,
          args: decodeEventArgs(event, eventFragment),
        });
      }
    }
  }

  return allEvents;
}

async function stepHandler(
  input: QueryEventsInput
): Promise<QueryEventsResult> {
  console.log("[Query Events] Starting step with input:", {
    contractAddress: input.contractAddress,
    network: input.network,
    eventName: input.eventName,
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
    blockCount: input.blockCount,
    executionId: input._context?.executionId,
  });

  const { contractAddress, network, abi, eventName, _context } = input;

  if (!ethers.isAddress(contractAddress)) {
    return {
      success: false,
      error: `Invalid contract address: ${contractAddress}`,
    };
  }

  const abiResult = parseAbi(abi);
  if (!abiResult.success) {
    return { success: false, error: abiResult.error };
  }

  const eventAbiEntry = abiResult.parsed.find(
    (item) => item.type === "event" && item.name === eventName
  );
  if (!eventAbiEntry) {
    return { success: false, error: `Event '${eventName}' not found in ABI` };
  }

  let chainId: number;
  try {
    chainId = getChainIdFromNetwork(network);
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }

  const userId = await getUserIdFromExecution(_context?.executionId);
  const rpcConfig = await resolveRpcConfig(chainId, userId);
  if (!rpcConfig) {
    return {
      success: false,
      error: `Chain ${chainId} not found or not enabled`,
    };
  }

  console.log(
    "[Query Events] Using RPC URL:",
    rpcConfig.primaryRpcUrl,
    "source:",
    rpcConfig.source
  );

  const provider = new ethers.JsonRpcProvider(rpcConfig.primaryRpcUrl);
  const contract = new ethers.Contract(
    contractAddress,
    abiResult.parsed,
    provider
  );

  const eventFragment = contract.interface.getEvent(eventName);
  if (!eventFragment) {
    return {
      success: false,
      error: `Event '${eventName}' not found in contract interface`,
    };
  }

  const blockRangeResult = await resolveBlockRange(
    provider,
    input.fromBlock,
    input.toBlock,
    input.blockCount
  );
  if (!blockRangeResult.success) {
    return { success: false, error: blockRangeResult.error };
  }
  const { range } = blockRangeResult;

  if (range.fromBlock > range.toBlock) {
    return {
      success: true,
      events: [],
      fromBlock: range.fromBlock,
      toBlock: range.toBlock,
      eventCount: 0,
    };
  }

  try {
    const events = await queryEventBatches(
      contract,
      eventName,
      eventFragment,
      range
    );

    console.log("[Query Events] Query complete. Events found:", events.length);

    return {
      success: true,
      events,
      fromBlock: range.fromBlock,
      toBlock: range.toBlock,
      eventCount: events.length,
    };
  } catch (error) {
    return {
      success: false,
      error: `Event query failed: ${getErrorMessage(error)}`,
    };
  }
}

export async function queryEventsStep(
  input: QueryEventsInput
): Promise<QueryEventsResult> {
  "use step";

  let enrichedInput: QueryEventsInput & { contractAddressLink?: string } =
    input;
  try {
    const chainId = getChainIdFromNetwork(input.network);
    const explorerConfig = await db.query.explorerConfigs.findFirst({
      where: eq(explorerConfigs.chainId, chainId),
    });
    if (explorerConfig) {
      const contractAddressLink = getAddressUrl(
        explorerConfig,
        input.contractAddress
      );
      if (contractAddressLink) {
        enrichedInput = { ...input, contractAddressLink };
      }
    }
  } catch {
    // Non-critical: if lookup fails, input logs without the link
  }

  return withPluginMetrics(
    {
      pluginName: "web3",
      actionName: "query-events",
      executionId: input._context?.executionId,
    },
    () => withStepLogging(enrichedInput, () => stepHandler(input))
  );
}

export const _integrationType = "web3";
