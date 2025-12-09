import "server-only";

import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";
import type { WebhookCredentials } from "../credentials";

type SendWebhookResult =
  | { success: true; statusCode: number; response: unknown }
  | { success: false; error: string };

export type SendWebhookCoreInput = {
  webhookUrl: string;
  webhookMethod: string;
  webhookHeaders?: string;
  webhookPayload?: string;
};

export type SendWebhookInput = StepInput &
  SendWebhookCoreInput & {
    integrationId?: string;
  };

/**
 * Parse JSON string safely, returning null if invalid
 */
function parseJsonSafely(jsonString: string | undefined): unknown {
  if (!jsonString || jsonString.trim() === "") {
    return null;
  }

  try {
    return JSON.parse(jsonString);
  } catch (error) {
    console.error("[Webhook] Failed to parse JSON:", error);
    return null;
  }
}

/**
 * Core logic - portable between app and export
 */
async function stepHandler(
  input: SendWebhookCoreInput,
  _credentials: WebhookCredentials
): Promise<SendWebhookResult> {
  console.log("[Webhook] Starting send webhook step");

  const url = input.webhookUrl;
  const method = input.webhookMethod || "POST";

  if (!url) {
    console.error("[Webhook] No URL provided");
    return {
      success: false,
      error: "Webhook URL is required",
    };
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    console.error("[Webhook] Invalid URL format");
    return {
      success: false,
      error: "Invalid webhook URL format",
    };
  }

  // Parse headers
  const headersObj = parseJsonSafely(input.webhookHeaders);
  const headers: Record<string, string> = {};

  if (headersObj && typeof headersObj === "object" && !Array.isArray(headersObj)) {
    for (const [key, value] of Object.entries(headersObj)) {
      if (typeof value === "string") {
        headers[key] = value;
      }
    }
  }

  // Set default Content-Type if not provided and method requires body
  if (
    !headers["Content-Type"] &&
    !headers["content-type"] &&
    method !== "GET" &&
    input.webhookPayload
  ) {
    headers["Content-Type"] = "application/json";
  }

  // Parse payload
  const payload = parseJsonSafely(input.webhookPayload);

  try {
    console.log("[Webhook] Sending request to webhook");

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Only include body for methods that support it
    if (method !== "GET" && payload !== null) {
      fetchOptions.body = JSON.stringify(payload);
    }

    const response = await fetch(url, fetchOptions);

    let responseData: unknown;
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
      try {
        responseData = await response.json();
      } catch {
        // If JSON parsing fails, try text
        responseData = await response.text();
      }
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      console.error("[Webhook] API error:", response.status, responseData);
      return {
        success: false,
        error: `HTTP ${response.status}: ${typeof responseData === "string" ? responseData : JSON.stringify(responseData)}`,
      };
    }

    console.log("[Webhook] Webhook sent successfully");

    return {
      success: true,
      statusCode: response.status,
      response: responseData,
    };
  } catch (error) {
    console.error("[Webhook] Error sending webhook:", error);
    return {
      success: false,
      error: `Failed to send webhook: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * App entry point - fetches credentials and wraps with logging
 */
export async function sendWebhookStep(
  input: SendWebhookInput
): Promise<SendWebhookResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  return withStepLogging(input, () => stepHandler(input, credentials));
}
sendWebhookStep.maxRetries = 0;

export const _integrationType = "webhook";

