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
