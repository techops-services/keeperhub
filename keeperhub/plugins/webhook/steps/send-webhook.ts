import "server-only";

import { withPluginMetrics } from "@/keeperhub/lib/metrics/instrumentation/plugin";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";

type SendWebhookResult =
  | { success: true; statusCode: number; response: unknown }
  | { success: false; error: string };

export type SendWebhookCoreInput = {
  webhookUrl: string;
  webhookMethod: string;
  webhookHeaders?: string;
  webhookPayload?: string;
};

export type SendWebhookInput = StepInput & SendWebhookCoreInput;

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
    console.warn("[Webhook] Failed to parse JSON:", error);
    return null;
  }
}

/**
 * Core logic - portable between app and export
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Webhook handling requires validation of URL, headers, body
async function stepHandler(
  input: SendWebhookCoreInput
): Promise<SendWebhookResult> {
  console.log("[Webhook] Starting send webhook step");

  const url = input.webhookUrl;
  const method = input.webhookMethod || "POST";

  if (!url) {
    console.warn("[Webhook] No URL provided");
    return {
      success: false,
      error: "Webhook URL is required",
    };
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    console.warn("[Webhook] Invalid URL format");
    return {
      success: false,
      error: "Invalid webhook URL format",
    };
  }

  // Parse headers
  const headersObj = parseJsonSafely(input.webhookHeaders);
  const headers: Record<string, string> = {};

  if (
    headersObj &&
    typeof headersObj === "object" &&
    !Array.isArray(headersObj)
  ) {
    for (const [key, value] of Object.entries(headersObj)) {
      if (typeof value === "string") {
        headers[key] = value;
      }
    }
  }

  // Set default Content-Type if not provided and method requires body
  if (
    !(headers["Content-Type"] || headers["content-type"]) &&
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

    if (contentType?.includes("application/json")) {
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
      console.warn("[Webhook] API error:", response.status, responseData);
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
    console.warn("[Webhook] Error sending webhook:", error);
    return {
      success: false,
      error: `Failed to send webhook: ${getErrorMessage(error)}`,
    };
  }
}

/**
 * App entry point - wraps with logging
 */
// biome-ignore lint/suspicious/useAwait: "use step" directive requires async
export async function sendWebhookStep(
  input: SendWebhookInput
): Promise<SendWebhookResult> {
  "use step";

  return withPluginMetrics(
    {
      pluginName: "webhook",
      actionName: "send-webhook",
      executionId: input._context?.executionId,
    },
    () => withStepLogging(input, () => stepHandler(input))
  );
}
sendWebhookStep.maxRetries = 0;

export const _integrationType = "webhook";
