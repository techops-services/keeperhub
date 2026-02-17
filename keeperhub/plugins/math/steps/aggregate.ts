import "server-only";

import { withPluginMetrics } from "@/keeperhub/lib/metrics/instrumentation/plugin";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────────────────────────

const PLUGIN_NAME = "math";
const ACTION_NAME = "aggregate";

const AGGREGATE_OPERATIONS = [
  "sum",
  "count",
  "average",
  "median",
  "min",
  "max",
  "product",
] as const;

/** Post-ops that require an operand (binary) */
const BINARY_POST_OPERATIONS = [
  "multiply",
  "divide",
  "modulo",
  "subtract",
  "add",
  "power",
] as const;

/** Post-ops that take no operand (unary) */
const UNARY_POST_OPERATIONS = ["abs", "round", "floor", "ceil"] as const;

const ALL_POST_OPERATIONS = [
  "none",
  ...BINARY_POST_OPERATIONS,
  ...UNARY_POST_OPERATIONS,
] as const;

const INPUT_MODES = ["array", "explicit"] as const;
const RESULT_TYPES = ["number", "bigint"] as const;

const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const EXPLICIT_SEPARATOR = /[,\n]+/;
const COMMA_STRIP = /,/g;
const INTEGER_PATTERN = /^-?\d+$/;

// ─── Types ──────────────────────────────────────────────────────────────────

type AggregateOperation = (typeof AGGREGATE_OPERATIONS)[number];
type BinaryPostOperation = (typeof BINARY_POST_OPERATIONS)[number];
type UnaryPostOperation = (typeof UNARY_POST_OPERATIONS)[number];
type PostOperation = (typeof ALL_POST_OPERATIONS)[number];
type InputMode = (typeof INPUT_MODES)[number];
type ResultType = (typeof RESULT_TYPES)[number];

type NumericValue =
  | { kind: "number"; value: number }
  | { kind: "bigint"; value: bigint };

type AggregateResult =
  | {
      success: true;
      result: string;
      resultType: ResultType;
      operation: string;
      inputCount: number;
    }
  | { success: false; error: string };

export type AggregateCoreInput = {
  operation: AggregateOperation;
  inputMode: InputMode;
  arrayInput?: string;
  fieldPath?: string;
  explicitValues?: string;
  postOperation?: PostOperation;
  postOperand?: string;
};

export type AggregateInput = StepInput & AggregateCoreInput;

// ─── Validation ─────────────────────────────────────────────────────────────

const VALID_OPERATIONS: ReadonlySet<string> = new Set(AGGREGATE_OPERATIONS);
const VALID_POST_OPERATIONS: ReadonlySet<string> = new Set(ALL_POST_OPERATIONS);
const BINARY_POST_OPS_SET: ReadonlySet<string> = new Set(
  BINARY_POST_OPERATIONS
);

function isValidOperation(value: string): value is AggregateOperation {
  return VALID_OPERATIONS.has(value);
}

function isActivePostOperation(
  value: string | undefined
): value is BinaryPostOperation | UnaryPostOperation {
  return (
    value !== undefined && value !== "none" && VALID_POST_OPERATIONS.has(value)
  );
}

function isBinaryPostOperation(value: string): value is BinaryPostOperation {
  return BINARY_POST_OPS_SET.has(value);
}

// ─── Error helpers ──────────────────────────────────────────────────────────

function fail(error: string): AggregateResult {
  return { success: false, error };
}

// ─── Numeric parsing ────────────────────────────────────────────────────────

function cleanRawValue(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (typeof value === "string") {
    const cleaned = value.replace(COMMA_STRIP, "").trim();
    return cleaned === "" ? null : cleaned;
  }
  return null;
}

function parseNumeric(cleaned: string): NumericValue | null {
  if (INTEGER_PATTERN.test(cleaned)) {
    const bi = BigInt(cleaned);
    if (
      bi > BigInt(Number.MAX_SAFE_INTEGER) ||
      bi < BigInt(-Number.MAX_SAFE_INTEGER)
    ) {
      return { kind: "bigint", value: bi };
    }
    return { kind: "number", value: Number(bi) };
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? { kind: "number", value: num } : null;
}

function toNumeric(value: unknown): NumericValue | null {
  const cleaned = cleanRawValue(value);
  if (cleaned === null) {
    return null;
  }
  return parseNumeric(cleaned);
}

function toNumber(value: unknown): number | null {
  const cleaned = cleanRawValue(value);
  if (cleaned === null) {
    return null;
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

// ─── Field path resolution ──────────────────────────────────────────────────

function resolveFieldPath(obj: unknown, path: string): unknown {
  let current: unknown = obj;
  for (const segment of path.split(".")) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object"
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

// ─── Value extraction ───────────────────────────────────────────────────────

function unwrapArray(input: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new Error(
      "arrayInput is not valid JSON. Expected a JSON array or an object containing an array."
    );
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (typeof parsed === "object" && parsed !== null) {
    const arrayField = Object.values(parsed).find((v) => Array.isArray(v));
    if (Array.isArray(arrayField)) {
      return arrayField;
    }
  }

  throw new Error("arrayInput must be a JSON array or object containing one.");
}

function collectNumericValues(
  items: unknown[],
  fieldPath: string | undefined
): NumericValue[] {
  const values: NumericValue[] = [];
  for (const item of items) {
    const raw = fieldPath ? resolveFieldPath(item, fieldPath) : item;
    const nv = toNumeric(raw);
    if (nv !== null) {
      values.push(nv);
    }
  }
  return values;
}

function extractArrayValues(
  arrayInput: string,
  fieldPath: string | undefined
): NumericValue[] {
  const items = unwrapArray(arrayInput);
  return collectNumericValues(items, fieldPath);
}

function extractExplicitValues(explicitValues: string): NumericValue[] {
  const parts = explicitValues.split(EXPLICIT_SEPARATOR);
  const values: NumericValue[] = [];
  for (const part of parts) {
    const nv = toNumeric(part);
    if (nv !== null) {
      values.push(nv);
    }
  }
  return values;
}

// ─── BigInt aggregation ─────────────────────────────────────────────────────

function toBigInts(values: NumericValue[]): bigint[] {
  return values.map((v) =>
    v.kind === "bigint" ? v.value : BigInt(Math.trunc(v.value))
  );
}

function sumBigInt(values: bigint[]): bigint {
  let result = BIGINT_ZERO;
  for (const v of values) {
    result += v;
  }
  return result;
}

function productBigInt(values: bigint[]): bigint {
  let result = BIGINT_ONE;
  for (const v of values) {
    result *= v;
  }
  return result;
}

function minBigInt(values: bigint[]): bigint {
  let result = values[0];
  for (const v of values) {
    if (v < result) {
      result = v;
    }
  }
  return result;
}

function maxBigInt(values: bigint[]): bigint {
  let result = values[0];
  for (const v of values) {
    if (v > result) {
      result = v;
    }
  }
  return result;
}

function medianBigInt(values: bigint[]): bigint {
  const sorted = [...values].sort((a, b) => {
    if (a < b) {
      return -1;
    }
    if (a > b) {
      return 1;
    }
    return 0;
  });
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / BigInt(2);
  }
  return sorted[mid];
}

function aggregateBigInt(
  values: bigint[],
  operation: AggregateOperation
): string {
  if (values.length === 0) {
    if (operation === "count" || operation === "sum") {
      return "0";
    }
    if (operation === "product") {
      return "1";
    }
    throw new Error(`Cannot compute ${operation} on an empty set of values.`);
  }

  switch (operation) {
    case "sum":
      return sumBigInt(values).toString();
    case "count":
      return String(values.length);
    case "average":
      return (sumBigInt(values) / BigInt(values.length)).toString();
    case "median":
      return medianBigInt(values).toString();
    case "min":
      return minBigInt(values).toString();
    case "max":
      return maxBigInt(values).toString();
    case "product":
      return productBigInt(values).toString();
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// ─── Number aggregation ─────────────────────────────────────────────────────

function toNumbers(values: NumericValue[]): number[] {
  return values.map((v) => (v.kind === "number" ? v.value : Number(v.value)));
}

function medianNumber(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function aggregateNumber(
  values: number[],
  operation: AggregateOperation
): number {
  if (values.length === 0) {
    if (operation === "count" || operation === "sum") {
      return 0;
    }
    if (operation === "product") {
      return 1;
    }
    throw new Error(`Cannot compute ${operation} on an empty set of values.`);
  }

  switch (operation) {
    case "sum": {
      let sum = 0;
      for (const v of values) {
        sum += v;
      }
      return sum;
    }
    case "count":
      return values.length;
    case "average": {
      let sum = 0;
      for (const v of values) {
        sum += v;
      }
      return sum / values.length;
    }
    case "median":
      return medianNumber(values);
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    case "product": {
      let prod = 1;
      for (const v of values) {
        prod *= v;
      }
      return prod;
    }
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// ─── Post-operations ────────────────────────────────────────────────────────

function applyBinaryPostOperation(
  value: number,
  postOp: BinaryPostOperation,
  operand: number
): number {
  switch (postOp) {
    case "add":
      return value + operand;
    case "subtract":
      return value - operand;
    case "multiply":
      return value * operand;
    case "divide":
      if (operand === 0) {
        throw new Error("Division by zero.");
      }
      return value / operand;
    case "modulo":
      if (operand === 0) {
        throw new Error("Modulo by zero.");
      }
      return value % operand;
    case "power":
      return value ** operand;
    default:
      throw new Error(`Unknown post-operation: ${postOp}`);
  }
}

function applyUnaryPostOperation(
  value: number,
  postOp: UnaryPostOperation
): number {
  switch (postOp) {
    case "abs":
      return Math.abs(value);
    case "round":
      return Math.round(value);
    case "floor":
      return Math.floor(value);
    case "ceil":
      return Math.ceil(value);
    default:
      throw new Error(`Unknown post-operation: ${postOp}`);
  }
}

function applyPostOperation(
  value: number,
  postOp: BinaryPostOperation | UnaryPostOperation,
  operand: number | null
): number {
  if (isBinaryPostOperation(postOp)) {
    if (operand === null) {
      throw new Error(
        `postOperand is required for "${postOp}" post-operation.`
      );
    }
    return applyBinaryPostOperation(value, postOp, operand);
  }
  return applyUnaryPostOperation(value, postOp as UnaryPostOperation);
}

// ─── Input parsing ──────────────────────────────────────────────────────────

function parseInputValues(
  input: AggregateCoreInput
): NumericValue[] | AggregateResult {
  if (input.inputMode === "array") {
    if (!input.arrayInput) {
      return fail(
        "arrayInput is required in array mode. Reference an upstream node output containing a JSON array."
      );
    }
    return extractArrayValues(input.arrayInput, input.fieldPath);
  }

  if (input.inputMode === "explicit") {
    if (!input.explicitValues) {
      return fail(
        "explicitValues is required in explicit mode. Provide comma-separated or newline-separated values."
      );
    }
    return extractExplicitValues(input.explicitValues);
  }

  return fail(
    `Invalid inputMode "${input.inputMode}". Must be "array" or "explicit".`
  );
}

function validatePostOperation(
  input: AggregateCoreInput
): AggregateResult | null {
  const { postOperation } = input;
  if (!postOperation || postOperation === "none") {
    return null;
  }
  if (!VALID_POST_OPERATIONS.has(postOperation)) {
    return fail(
      `Invalid postOperation "${postOperation}". Must be one of: ${ALL_POST_OPERATIONS.join(", ")}.`
    );
  }
  if (isBinaryPostOperation(postOperation)) {
    const operand = toNumber(input.postOperand);
    if (operand === null) {
      return fail(
        `postOperand is required and must be a valid number for "${postOperation}" post-operation.`
      );
    }
  }
  return null;
}

function buildOperationLabel(input: AggregateCoreInput): string {
  const { postOperation } = input;
  return isActivePostOperation(postOperation)
    ? `${input.operation} then ${postOperation}`
    : input.operation;
}

// ─── Core step handler ──────────────────────────────────────────────────────

function stepHandler(input: AggregateCoreInput): AggregateResult {
  try {
    if (!isValidOperation(input.operation)) {
      return fail(
        `Invalid operation "${input.operation}". Must be one of: ${AGGREGATE_OPERATIONS.join(", ")}.`
      );
    }

    const parsed = parseInputValues(input);
    if (!Array.isArray(parsed)) {
      return parsed;
    }

    const postError = validatePostOperation(input);
    if (postError !== null) {
      return postError;
    }

    const needsBigInt = parsed.some((v) => v.kind === "bigint");
    const { postOperation } = input;

    if (needsBigInt && !isActivePostOperation(postOperation)) {
      const result = aggregateBigInt(toBigInts(parsed), input.operation);
      return {
        success: true,
        result,
        resultType: "bigint",
        operation: buildOperationLabel(input),
        inputCount: parsed.length,
      };
    }

    let result = aggregateNumber(toNumbers(parsed), input.operation);

    if (isActivePostOperation(postOperation)) {
      const operand = toNumber(input.postOperand);
      result = applyPostOperation(result, postOperation, operand);
    }

    return {
      success: true,
      result: String(result),
      resultType: "number",
      operation: buildOperationLabel(input),
      inputCount: parsed.length,
    };
  } catch (error) {
    return fail(`Aggregation failed: ${getErrorMessage(error)}`);
  }
}

// ─── Entry point ────────────────────────────────────────────────────────────

export async function aggregateStep(
  input: AggregateInput
): Promise<AggregateResult> {
  "use step";

  return await withPluginMetrics(
    {
      pluginName: PLUGIN_NAME,
      actionName: ACTION_NAME,
      executionId: input._context?.executionId,
    },
    () => withStepLogging(input, () => Promise.resolve(stepHandler(input)))
  );
}

export const _integrationType = PLUGIN_NAME;
