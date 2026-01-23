import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract a meaningful error message from various error types.
 * Handles Error instances, objects with message/error properties, strings,
 * and nested error structures common in AI SDKs.
 * Note: This is synchronous - use getErrorMessageAsync for Promise errors.
 */
export function getErrorMessage(error: unknown): string {
  // Handle null/undefined
  if (error === null || error === undefined) {
    return "Unknown error";
  }

  // Handle Error instances (and their subclasses)
  if (error instanceof Error) {
    // Some errors have a cause property with more details
    if (error.cause && error.cause instanceof Error) {
      return `${error.message}: ${error.cause.message}`;
    }
    return error.message;
  }

  // Handle strings
  if (typeof error === "string") {
    return error;
  }

  // Handle objects
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;

    // Check for common error message properties
    if (typeof obj.message === "string" && obj.message) {
      return obj.message;
    }

    // AI SDK often wraps errors in responseBody or data
    if (obj.responseBody && typeof obj.responseBody === "object") {
      const body = obj.responseBody as Record<string, unknown>;
      if (typeof body.error === "string") {
        return body.error;
      }
      if (
        body.error &&
        typeof body.error === "object" &&
        typeof (body.error as Record<string, unknown>).message === "string"
      ) {
        return (body.error as Record<string, unknown>).message as string;
      }
    }

    // Check for nested error property
    if (typeof obj.error === "string" && obj.error) {
      return obj.error;
    }
    if (obj.error && typeof obj.error === "object") {
      const nestedError = obj.error as Record<string, unknown>;
      if (typeof nestedError.message === "string") {
        return nestedError.message;
      }
    }

    // Check for data.error pattern (common in API responses)
    if (obj.data && typeof obj.data === "object") {
      const data = obj.data as Record<string, unknown>;
      if (typeof data.error === "string") {
        return data.error;
      }
      if (typeof data.message === "string") {
        return data.message;
      }
    }

    // Check for reason property (common in some error types)
    if (typeof obj.reason === "string" && obj.reason) {
      return obj.reason;
    }

    // Check for statusText (HTTP errors)
    if (typeof obj.statusText === "string" && obj.statusText) {
      const status = typeof obj.status === "number" ? ` (${obj.status})` : "";
      return `${obj.statusText}${status}`;
    }

    // Try to stringify the error object (but avoid [object Object])
    try {
      const stringified = JSON.stringify(error, null, 0);
      if (stringified && stringified !== "{}" && stringified.length < 500) {
        return stringified;
      }
    } catch {
      // Ignore stringify errors
    }

    // Last resort: use Object.prototype.toString
    const toString = Object.prototype.toString.call(error);
    if (toString !== "[object Object]") {
      return toString;
    }
  }

  return "Unknown error";
}

/**
 * Async version that handles Promise errors by awaiting them first.
 * Use this in catch blocks where the error might be a Promise.
 */
export async function getErrorMessageAsync(error: unknown): Promise<string> {
  // If error is a Promise, await it to get the actual error
  if (error instanceof Promise) {
    try {
      const resolvedValue = await error;
      // The promise resolved - check if it contains error info
      return getErrorMessage(resolvedValue);
    } catch (rejectedError) {
      return getErrorMessage(rejectedError);
    }
  }

  // Check if it's a thenable (Promise-like)
  if (
    error &&
    typeof error === "object" &&
    "then" in error &&
    typeof (error as { then: unknown }).then === "function"
  ) {
    try {
      const resolvedValue = await (error as Promise<unknown>);
      // The promise resolved - check if it contains error info
      return getErrorMessage(resolvedValue);
    } catch (rejectedError) {
      return getErrorMessage(rejectedError);
    }
  }

  return getErrorMessage(error);
}
/**
 * Deserialize a value from { value: string, type: string } format back to appropriate type
 * - uint* and int* types → BigInt
 * - bool → boolean
 * - string/address/bytes → string
 * - arrays → recursively deserialize each element
 * - tuples → recursively deserialize each field
 */
export function deserializeArg(
  serialized: { value: unknown; type: string } | unknown
): unknown {
  // If not a serialized object, return as-is
  if (
    !serialized ||
    typeof serialized !== "object" ||
    !("value" in serialized) ||
    !("type" in serialized)
  ) {
    return serialized;
  }

  const { value, type } = serialized as { value: unknown; type: string };

  // Handle arrays (e.g., uint256[], address[], tuple[])
  if (type.endsWith("[]")) {
    if (Array.isArray(value)) {
      const baseType = type.slice(0, -2);
      return value.map((item) => {
        // If item is already deserialized, return as-is
        // Otherwise, treat as serialized object
        if (
          item &&
          typeof item === "object" &&
          "value" in item &&
          "type" in item
        ) {
          return deserializeArg(item);
        }
        // For array of primitives, deserialize based on base type
        return deserializePrimitive(item as string, baseType);
      });
    }
    return value;
  }

  // Handle fixed-size arrays (e.g., uint256[5])
  const fixedArrayMatch = type.match(/^(.+)\[(\d+)\]$/);
  if (fixedArrayMatch) {
    if (Array.isArray(value)) {
      const baseType = fixedArrayMatch[1];
      return value.map((item) => {
        if (
          item &&
          typeof item === "object" &&
          "value" in item &&
          "type" in item
        ) {
          return deserializeArg(item);
        }
        return deserializePrimitive(item as string, baseType);
      });
    }
    return value;
  }

  // Handle tuples/structs
  if (type === "tuple" && value && typeof value === "object") {
    const deserialized: Record<string, unknown> = {};
    for (const [key, fieldValue] of Object.entries(value)) {
      deserialized[key] = deserializeArg(fieldValue);
    }
    return deserialized;
  }

  // Handle nested tuples in arrays (e.g., tuple[])
  if (type.startsWith("tuple") && value && typeof value === "object") {
    return deserializeArg({ value, type: "tuple" });
  }

  // Handle primitive types
  return deserializePrimitive(value as string, type);
}

/**
 * Deserialize a primitive value based on its type
 */
export function deserializePrimitive(value: string, type: string): unknown {
  // uint* and int* types → BigInt
  if (type.includes("uint") || type.includes("int")) {
    try {
      return BigInt(value);
    } catch {
      // If BigInt conversion fails, return as string
      return value;
    }
  }

  // bool → boolean
  if (type === "bool") {
    return value === "true";
  }

  // string, address, bytes* → string (keep as-is)
  if (type === "string" || type === "address" || type.startsWith("bytes")) {
    return value;
  }

  // Unknown type, return as string
  return value;
}

/**
 * Recursively deserialize event trigger data
 * Converts { value: string, type: string } objects back to appropriate types
 */
export function deserializeEventTriggerData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const deserialized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (key === "args" && value && typeof value === "object") {
      // Deserialize args object recursively
      const argsDeserialized: Record<string, unknown> = {};
      for (const [argKey, argValue] of Object.entries(
        value as Record<string, unknown>
      )) {
        argsDeserialized[argKey] = deserializeArg(argValue);
      }
      deserialized[key] = argsDeserialized;
    } else if (
      ["blockNumber", "logIndex", "transactionIndex"].includes(key) &&
      value &&
      typeof value === "object" &&
      "value" in value &&
      "type" in value
    ) {
      // Deserialize numeric fields
      deserialized[key] = deserializeArg(value);
    } else {
      // Keep other fields as-is (eventName, transactionHash, blockHash, address, etc.)
      deserialized[key] = value;
    }
  }

  console.log(
    "[Deserialize] Input data keys:",
    Object.keys(data),
    "Output keys:",
    Object.keys(deserialized),
    "Has args:",
    "args" in deserialized,
    "Args keys:",
    deserialized.args && typeof deserialized.args === "object"
      ? Object.keys(deserialized.args as Record<string, unknown>)
      : "no args"
  );

  return deserialized;
}