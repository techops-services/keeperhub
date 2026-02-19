import "server-only";

import { createContext, runInContext } from "node:vm";
import { ErrorCategory, logUserError } from "@/keeperhub/lib/logging";
import { withPluginMetrics } from "@/keeperhub/lib/metrics/instrumentation/plugin";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

type LogEntry = {
  level: "log" | "warn" | "error";
  args: unknown[];
};

type RunCodeResult =
  | { success: true; result: unknown; logs: LogEntry[] }
  | { success: false; error: string; logs: LogEntry[]; line?: number };

export type RunCodeCoreInput = {
  code: string;
  timeout?: number;
};

export type RunCodeInput = StepInput & RunCodeCoreInput;

const DEFAULT_TIMEOUT_SECONDS = 60;
const MAX_TIMEOUT_SECONDS = 120;
const MAX_LOG_ENTRIES = 200;
const VM_LINE_REGEX = /evalmachine\.<anonymous>:(\d+)/;
const UNRESOLVED_TEMPLATE_REGEX = /\{\{@?[^}]+\}\}/g;

/**
 * Extract a line number from a VM error stack trace if available.
 */
function extractLineNumber(error: unknown): number | undefined {
  if (!(error instanceof Error && error.stack)) {
    return undefined;
  }

  const match = error.stack.match(VM_LINE_REGEX);
  if (match?.[1]) {
    // Subtract 1 to account for the async IIFE wrapper line prepended to user code
    const rawLine = Number.parseInt(match[1], 10);
    return Math.max(1, rawLine - 1);
  }

  return undefined;
}

/**
 * Create a captured console object that stores log entries.
 */
function createCapturedConsole(logs: LogEntry[]): {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
} {
  function capture(level: LogEntry["level"]) {
    return (...args: unknown[]): void => {
      if (logs.length < MAX_LOG_ENTRIES) {
        logs.push({ level, args });
      }
    };
  }

  return {
    log: capture("log"),
    warn: capture("warn"),
    error: capture("error"),
  };
}

/**
 * Core logic - executes user code in a sandboxed vm context.
 *
 * Template variables (e.g. {{NodeName.field}}) are resolved by the workflow
 * engine before the code reaches this handler -- the code string already
 * contains the actual values at execution time.
 *
 * Security model: node:vm prevents accidental access to Node.js internals.
 * It is NOT a security boundary against malicious code. This is acceptable
 * for a self-hosted platform where users are authenticated team members.
 */
async function stepHandler(input: RunCodeCoreInput): Promise<RunCodeResult> {
  const { code } = input;

  if (!code || code.trim() === "") {
    return { success: false, error: "No code provided", logs: [] };
  }

  // Check for unresolved template variables that would cause syntax errors
  const unresolvedTemplates = code.match(UNRESOLVED_TEMPLATE_REGEX);
  if (unresolvedTemplates) {
    const unique = [...new Set(unresolvedTemplates)];
    return {
      success: false,
      error: `Unresolved template variables: ${unique.join(", ")}. Make sure upstream nodes have executed and their outputs are available.`,
      logs: [],
    };
  }

  const logs: LogEntry[] = [];
  const capturedConsole = createCapturedConsole(logs);

  const rawTimeout = input.timeout ?? DEFAULT_TIMEOUT_SECONDS;
  const timeoutSeconds = Math.min(Math.max(1, rawTimeout), MAX_TIMEOUT_SECONDS);
  const timeoutMs = timeoutSeconds * 1000;

  // Wrap fetch with an AbortController deadline so network requests respect
  // the configured timeout and cannot hang indefinitely.
  function sandboxedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // If the caller already provided a signal, abort when either fires
    const callerSignal = init?.signal;
    if (callerSignal?.aborted) {
      controller.abort();
    } else {
      callerSignal?.addEventListener("abort", () => controller.abort(), {
        once: true,
      });
    }

    return fetch(input, { ...init, signal: controller.signal }).finally(() =>
      clearTimeout(timer)
    );
  }

  const sandbox = createContext({
    // I/O
    console: capturedConsole,
    fetch: sandboxedFetch,

    // Core types
    BigInt,
    JSON,
    Math,
    Date,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Symbol,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,

    // Error types
    Error,
    TypeError,
    RangeError,
    SyntaxError,
    ReferenceError,
    URIError,

    // Numeric / parsing
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    Infinity,
    NaN,

    // URI encoding
    encodeURIComponent,
    decodeURIComponent,
    encodeURI,
    decodeURI,

    // Base64
    atob,
    btoa,

    // Text encoding
    TextEncoder,
    TextDecoder,

    // Binary / typed arrays
    ArrayBuffer,
    SharedArrayBuffer,
    DataView,
    Uint8Array,
    Uint16Array,
    Uint32Array,
    Int8Array,
    Int16Array,
    Int32Array,
    Float32Array,
    Float64Array,
    BigInt64Array,
    BigUint64Array,

    // Fetch API types
    URL,
    URLSearchParams,
    Headers,
    Request,
    Response,
    AbortController,
    AbortSignal,

    // Utilities
    structuredClone,
    Intl,
    crypto: { randomUUID: crypto.randomUUID.bind(crypto) },
  });

  // Wrap code in an async IIFE so users can use `return` and `await`
  const wrappedCode = `(async () => {\n${code}\n})()`;

  try {
    const result: unknown = await runInContext(wrappedCode, sandbox, {
      timeout: timeoutMs,
      filename: "user-code.js",
    });

    return { success: true, result, logs };
  } catch (error) {
    const line = extractLineNumber(error);
    const message = getErrorMessage(error);

    // Detect timeout errors from vm
    const isTimeout =
      error instanceof Error &&
      error.message.includes("Script execution timed out");

    const errorMessage = isTimeout
      ? `Code execution timed out after ${String(timeoutSeconds)} seconds`
      : `Code execution failed: ${message}`;

    logUserError(ErrorCategory.VALIDATION, "[Code] Execution error:", error, {
      plugin_name: "code",
      action_name: "run-code",
    });

    return {
      success: false,
      error: errorMessage,
      logs,
      ...(line !== undefined ? { line } : {}),
    };
  }
}

/**
 * Entry point - wraps with logging + metrics
 */
// biome-ignore lint/suspicious/useAwait: "use step" directive requires async
export async function runCodeStep(input: RunCodeInput): Promise<RunCodeResult> {
  "use step";

  return withPluginMetrics(
    {
      pluginName: "code",
      actionName: "run-code",
      executionId: input._context?.executionId,
    },
    () => withStepLogging(input, () => stepHandler(input))
  );
}
runCodeStep.maxRetries = 0;

export const _integrationType = "code";
