#!/usr/bin/env tsx

/**
 * Step Function Profiler
 *
 * Profiles individual step functions to measure JavaScript operations.
 * Useful for benchmarking and comparing step complexity.
 *
 * Usage:
 *   # Profile a specific step
 *   pnpm tsx scripts/profile-step.ts --step slack/send-message
 *
 *   # Profile all steps (dry run - no actual execution)
 *   pnpm tsx scripts/profile-step.ts --all --dry-run
 *
 *   # Profile with mock input
 *   pnpm tsx scripts/profile-step.ts --step web3/check-balance --input '{"network":"ethereum","address":"0x..."}'
 *
 *   # Compare multiple steps
 *   pnpm tsx scripts/profile-step.ts --compare slack/send-message,discord/send-message
 */

import { Session } from "node:inspector/promises";
import { performance } from "node:perf_hooks";

// ============================================================================
// Types
// ============================================================================

type ProfileResult = {
  stepName: string;
  samples: number;
  hitCount: number;
  uniqueFunctions: number;
  durationMs: number;
  memoryUsedMB: number;
  topFunctions: Array<{
    name: string;
    hits: number;
    file: string;
  }>;
};

type ProfileNode = {
  id: number;
  callFrame: {
    functionName: string;
    scriptId: string;
    url: string;
    lineNumber: number;
    columnNumber: number;
  };
  hitCount: number;
  children?: number[];
};

type CPUProfile = {
  nodes: ProfileNode[];
  startTime: number;
  endTime: number;
  samples?: number[];
  timeDeltas?: number[];
};

// ============================================================================
// Step Registry (simplified - imports from actual registry)
// ============================================================================

// Map of step names to their import paths
const STEP_REGISTRY: Record<string, { path: string; fn: string }> = {
  "slack/send-message": {
    path: "../plugins/slack/steps/send-slack-message",
    fn: "sendSlackMessageStep",
  },
  "discord/send-message": {
    path: "../keeperhub/plugins/discord/steps/send-message",
    fn: "sendDiscordMessageStep",
  },
  "web3/check-balance": {
    path: "../keeperhub/plugins/web3/steps/check-balance",
    fn: "checkBalanceStep",
  },
  "web3/transfer-funds": {
    path: "../keeperhub/plugins/web3/steps/transfer-funds",
    fn: "transferFundsStep",
  },
  "webhook/send-webhook": {
    path: "../keeperhub/plugins/webhook/steps/send-webhook",
    fn: "sendWebhookStep",
  },
  "sendgrid/send-email": {
    path: "../keeperhub/plugins/sendgrid/steps/send-email",
    fn: "sendEmailStep",
  },
  "resend/send-email": {
    path: "../plugins/resend/steps/send-email",
    fn: "sendEmailStep",
  },
};

// Mock inputs for dry-run testing
const MOCK_INPUTS: Record<string, Record<string, unknown>> = {
  "slack/send-message": {
    slackChannel: "#test",
    slackMessage: "Test message",
    integrationId: "mock-integration-id",
  },
  "discord/send-message": {
    channelId: "123456789",
    content: "Test message",
    integrationId: "mock-integration-id",
  },
  "web3/check-balance": {
    network: "ethereum",
    address: "0x0000000000000000000000000000000000000000",
  },
  "web3/transfer-funds": {
    network: "ethereum",
    amount: "0.001",
    recipientAddress: "0x0000000000000000000000000000000000000000",
  },
  "webhook/send-webhook": {
    url: "https://example.com/webhook",
    method: "POST",
    body: '{"test": true}',
  },
  "sendgrid/send-email": {
    to: "test@example.com",
    subject: "Test",
    body: "Test email",
    integrationId: "mock-integration-id",
  },
  "resend/send-email": {
    to: "test@example.com",
    subject: "Test",
    body: "Test email",
    integrationId: "mock-integration-id",
  },
};

// ============================================================================
// Profiler
// ============================================================================

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Profiler requires sequential setup, execution, and teardown
async function profileStep(
  stepName: string,
  input: Record<string, unknown>,
  dryRun: boolean
): Promise<ProfileResult> {
  const session = new Session();
  session.connect();

  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();

  // Start profiling
  await session.post("Profiler.enable");
  await session.post("Profiler.start");

  let error: Error | null = null;

  if (dryRun) {
    // Dry run - just import and analyze the module without executing
    const stepInfo = STEP_REGISTRY[stepName];
    if (stepInfo) {
      try {
        await import(stepInfo.path);
      } catch {
        // Ignore import errors in dry run
      }
    }
  } else {
    const stepInfo = STEP_REGISTRY[stepName];
    if (!stepInfo) {
      throw new Error(
        `Unknown step: ${stepName}. Available: ${Object.keys(STEP_REGISTRY).join(", ")}`
      );
    }

    try {
      // Dynamic import of the step module
      const module = await import(stepInfo.path);
      const stepFn = module[stepInfo.fn];

      if (!stepFn) {
        throw new Error(`Step function ${stepInfo.fn} not found in module`);
      }

      // Execute the step (will likely fail without proper credentials, but we're profiling the code path)
      await stepFn(input).catch((e: Error) => {
        error = e;
      });
    } catch (e) {
      error = e as Error;
    }
  }

  // Stop profiling
  const result = await session.post("Profiler.stop");
  const profile = result.profile as CPUProfile;

  await session.post("Profiler.disable");
  session.disconnect();

  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;

  // Analyze profile
  let totalHits = 0;
  const functionHits = new Map<string, { hits: number; file: string }>();

  for (const node of profile.nodes) {
    const { functionName, url } = node.callFrame;
    const hits = node.hitCount || 0;
    totalHits += hits;

    if (hits > 0 && functionName) {
      const key = functionName;
      const existing = functionHits.get(key);
      if (existing) {
        existing.hits += hits;
      } else {
        functionHits.set(key, { hits, file: url });
      }
    }
  }

  const topFunctions = Array.from(functionHits.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 10);

  if (error && !dryRun) {
    console.log(
      `[${stepName}] Execution error (expected in test): ${error.message}`
    );
  }

  return {
    stepName,
    samples: profile.samples?.length || 0,
    hitCount: totalHits,
    uniqueFunctions: functionHits.size,
    durationMs: endTime - startTime,
    memoryUsedMB: (endMemory - startMemory) / 1024 / 1024,
    topFunctions,
  };
}

// ============================================================================
// Output Formatting
// ============================================================================

function formatResult(result: ProfileResult): string {
  const lines: string[] = [];

  lines.push(`\n📦 ${result.stepName}`);
  lines.push(`   Samples:           ${result.samples.toLocaleString()}`);
  lines.push(`   Total hits:        ${result.hitCount.toLocaleString()}`);
  lines.push(`   Unique functions:  ${result.uniqueFunctions}`);
  lines.push(`   Duration:          ${result.durationMs.toFixed(2)}ms`);
  lines.push(`   Memory delta:      ${result.memoryUsedMB.toFixed(2)}MB`);

  if (result.topFunctions.length > 0) {
    lines.push("   Top functions:");
    for (const fn of result.topFunctions.slice(0, 5)) {
      const shortFile = fn.file.split("/").slice(-2).join("/") || "(native)";
      lines.push(
        `     - ${fn.name.padEnd(30)} ${fn.hits.toString().padStart(5)} hits  (${shortFile})`
      );
    }
  }

  return lines.join("\n");
}

function formatComparison(results: ProfileResult[]): string {
  const lines: string[] = [];

  lines.push(`\n${"=".repeat(60)}`);
  lines.push("STEP COMPARISON");
  lines.push(`${"=".repeat(60)}`);

  // Sort by hit count
  const sorted = [...results].sort((a, b) => b.hitCount - a.hitCount);

  lines.push(
    `\n${"Step".padEnd(30)}${"Hits".padStart(10)}${"Samples".padStart(10)}${"Duration".padStart(12)}`
  );
  lines.push("-".repeat(62));

  for (const r of sorted) {
    lines.push(
      `${r.stepName.padEnd(30)}${r.hitCount.toString().padStart(10)}${r.samples.toString().padStart(10)}${`${r.durationMs.toFixed(2)}ms`.padStart(12)}`
    );
  }

  lines.push(`\n${"=".repeat(60)}`);

  return lines.join("\n");
}

// ============================================================================
// CLI
// ============================================================================

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: CLI argument parsing with multiple code paths
async function main() {
  const args = process.argv.slice(2);

  const getArg = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`);
    if (idx !== -1 && args[idx + 1]) {
      return args[idx + 1];
    }
    const eqArg = args.find((a) => a.startsWith(`--${name}=`));
    return eqArg?.split("=")[1];
  };

  const hasFlag = (name: string): boolean => args.includes(`--${name}`);

  const dryRun = hasFlag("dry-run");
  const showHelp = hasFlag("help") || hasFlag("h");

  if (showHelp) {
    console.log(`
Step Function Profiler

Usage:
  pnpm tsx scripts/profile-step.ts [options]

Options:
  --step <name>       Profile a specific step (e.g., slack/send-message)
  --all               Profile all registered steps
  --compare <steps>   Compare multiple steps (comma-separated)
  --input <json>      Custom input JSON for the step
  --dry-run           Only import modules, don't execute steps
  --help              Show this help

Available steps:
${Object.keys(STEP_REGISTRY)
  .map((s) => `  - ${s}`)
  .join("\n")}
`);
    return;
  }

  const stepName = getArg("step");
  const compareSteps = getArg("compare");
  const customInput = getArg("input");
  const profileAll = hasFlag("all");

  console.log("\n🔬 Step Function Profiler");
  console.log("=".repeat(40));

  if (profileAll || compareSteps) {
    const stepsToProfile = profileAll
      ? Object.keys(STEP_REGISTRY)
      : compareSteps?.split(",") || [];

    const results: ProfileResult[] = [];

    for (const step of stepsToProfile) {
      const trimmedStep = step.trim();
      console.log(`\nProfiling ${trimmedStep}...`);
      const input = MOCK_INPUTS[trimmedStep] || {};
      const result = await profileStep(trimmedStep, input, dryRun);
      results.push(result);
      console.log(formatResult(result));
    }

    if (results.length > 1) {
      console.log(formatComparison(results));
    }
  } else if (stepName) {
    let input: Record<string, unknown> = MOCK_INPUTS[stepName] || {};

    if (customInput) {
      try {
        input = { ...input, ...JSON.parse(customInput) };
      } catch {
        console.error("Failed to parse --input JSON");
        process.exit(1);
      }
    }

    console.log(`\nProfiling ${stepName}${dryRun ? " (dry run)" : ""}...`);
    const result = await profileStep(stepName, input, dryRun);
    console.log(formatResult(result));
  } else {
    console.log("No step specified. Use --help for usage.");
    console.log("\nAvailable steps:");
    for (const step of Object.keys(STEP_REGISTRY)) {
      console.log(`  - ${step}`);
    }
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
