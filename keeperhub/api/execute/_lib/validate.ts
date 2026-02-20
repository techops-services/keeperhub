import { isValidOperator, VALID_OPERATORS } from "./condition";
import type { ExecuteErrorResponse } from "./types";

export type ValidationResult =
  | { valid: true }
  | { valid: false; error: ExecuteErrorResponse };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function requiredFieldError(field: string): ValidationResult {
  return {
    valid: false,
    error: {
      error: "Missing required field",
      field,
      details: `${field} is required and must be a non-empty string`,
    },
  };
}

export function validateTransferInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      error: { error: "Request body is required" },
    };
  }

  const record = body as Record<string, unknown>;

  if (!isNonEmptyString(record.network)) {
    return requiredFieldError("network");
  }

  if (!isNonEmptyString(record.recipientAddress)) {
    return requiredFieldError("recipientAddress");
  }

  if (!isNonEmptyString(record.amount)) {
    return requiredFieldError("amount");
  }

  return { valid: true };
}

export function validateContractCallInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      error: { error: "Request body is required" },
    };
  }

  const record = body as Record<string, unknown>;

  if (!isNonEmptyString(record.contractAddress)) {
    return requiredFieldError("contractAddress");
  }

  if (!isNonEmptyString(record.network)) {
    return requiredFieldError("network");
  }

  if (!isNonEmptyString(record.functionName)) {
    return requiredFieldError("functionName");
  }

  if ("functionArgs" in record && typeof record.functionArgs !== "string") {
    return {
      valid: false,
      error: {
        error: "Invalid field type",
        field: "functionArgs",
        details: "functionArgs must be a JSON string when provided",
      },
    };
  }

  return { valid: true };
}

function isNonNullObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateConditionField(condition: unknown): ValidationResult | null {
  if (!isNonNullObject(condition)) {
    return {
      valid: false,
      error: {
        error: "Missing required field",
        field: "condition",
        details: "condition must be an object with operator and value",
      },
    };
  }

  if (!isValidOperator(condition.operator)) {
    return {
      valid: false,
      error: {
        error: "Invalid condition operator",
        field: "condition.operator",
        details: `Valid operators: ${VALID_OPERATORS.join(", ")}`,
      },
    };
  }

  if (!isNonEmptyString(condition.value)) {
    return {
      valid: false,
      error: {
        error: "Missing required field",
        field: "condition.value",
        details: "condition.value is required and must be a non-empty string",
      },
    };
  }

  return null;
}

function validateActionField(action: unknown): ValidationResult | null {
  if (!isNonNullObject(action)) {
    return {
      valid: false,
      error: {
        error: "Missing required field",
        field: "action",
        details:
          "action must be an object with contractAddress and functionName",
      },
    };
  }

  if (!isNonEmptyString(action.contractAddress)) {
    return requiredFieldError("action.contractAddress");
  }

  if (!isNonEmptyString(action.functionName)) {
    return requiredFieldError("action.functionName");
  }

  return null;
}

export function validateCheckAndExecuteInput(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return {
      valid: false,
      error: { error: "Request body is required" },
    };
  }

  const record = body as Record<string, unknown>;

  if (!isNonEmptyString(record.contractAddress)) {
    return requiredFieldError("contractAddress");
  }

  if (!isNonEmptyString(record.network)) {
    return requiredFieldError("network");
  }

  if (!isNonEmptyString(record.functionName)) {
    return requiredFieldError("functionName");
  }

  const conditionError = validateConditionField(record.condition);
  if (conditionError) {
    return conditionError;
  }

  const actionError = validateActionField(record.action);
  if (actionError) {
    return actionError;
  }

  return { valid: true };
}
