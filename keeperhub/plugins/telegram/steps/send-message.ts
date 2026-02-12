import "server-only";

import { withPluginMetrics } from "@/keeperhub/lib/metrics/instrumentation/plugin";
import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import type { TelegramCredentials } from "../credentials";

type TelegramApiResponse = {
  ok: boolean;
  result?: {
    message_id: number;
    date: number;
    chat: {
      id: number;
      type: string;
    };
    text?: string;
  };
  description?: string;
  error_code?: number;
};

type SendTelegramMessageResult =
  | { success: true; messageId: number }
  | { success: false; error: string };

export type SendTelegramMessageCoreInput = {
  chatId: string;
  message: string;
  parseMode?: string;
};

export type SendTelegramMessageInput = StepInput &
  SendTelegramMessageCoreInput & {
    integrationId: string;
  };

/**
 * Enhance error message for MarkdownV2 parsing errors
 */
function enhanceErrorMessage(
  description: string | undefined,
  parseMode: string | undefined
): string {
  if (
    parseMode === "MarkdownV2" &&
    description?.includes("can't parse entities") &&
    description?.includes("reserved and must be escaped")
  ) {
    return `${description} When using MarkdownV2, special characters (., -, _, *, [, ], (, ), ~, \`, >, #, +, =, |, {, }, !) must be escaped with a backslash (\\) before them.`;
  }
  return description || "Failed to send Telegram message";
}

/**
 * Send a message to Telegram API
 */
async function sendMessage(
  apiUrl: string,
  params: URLSearchParams,
  parseMode: string | undefined
): Promise<SendTelegramMessageResult> {
  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorData = (await response
        .json()
        .catch(() => ({}))) as TelegramApiResponse;
      console.warn("[Telegram] HTTP error response:", {
        status: response.status,
        statusText: response.statusText,
        errorData,
      });
      return {
        success: false,
        error:
          errorData.description ||
          `HTTP ${response.status}: Failed to send Telegram message`,
      };
    }

    const data = (await response
      .json()
      .catch(() => ({}))) as TelegramApiResponse;
    console.log("[Telegram] Response data:", data);

    if (!data.ok) {
      console.warn("[Telegram] API error in response:", data);
      return {
        success: false,
        error:
          enhanceErrorMessage(data.description, parseMode) ||
          `HTTP ${response.status}: Failed to send Telegram message`,
      };
    }

    console.log("[Telegram] Message sent successfully");
    return {
      success: true,
      messageId: data.result?.message_id || 0,
    };
  } catch (error) {
    console.warn("[Telegram] Fetch error:", error);
    return {
      success: false,
      error: `Failed to send Telegram message: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Core logic - portable between app and export
 */
async function stepHandler(
  input: SendTelegramMessageCoreInput,
  credentials: TelegramCredentials
): Promise<SendTelegramMessageResult> {
  console.log("[Telegram] Starting send message step");

  const botToken = credentials.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.warn("[Telegram] No bot token provided in integration");
    return {
      success: false,
      error:
        "Telegram bot token is required. Please configure it in the integration settings.",
    };
  }

  if (!input.chatId) {
    console.warn("[Telegram] No chat ID provided");
    return {
      success: false,
      error: "Chat ID is required. Please provide a valid chat ID.",
    };
  }

  if (!input.message) {
    console.warn("[Telegram] No message provided");
    return {
      success: false,
      error: "Message text is required.",
    };
  }

  const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  // Build request body as URLSearchParams
  const params = new URLSearchParams({
    chat_id: input.chatId,
    text: input.message,
  });

  // Only include parse_mode if it's provided and not "none"
  if (
    input.parseMode &&
    input.parseMode !== "none" &&
    input.parseMode.trim() !== ""
  ) {
    params.append("parse_mode", input.parseMode);
  }

  try {
    return await sendMessage(apiUrl, params, input.parseMode);
  } catch (error) {
    console.warn("[Telegram] Error sending message:", error);
    return {
      success: false,
      error: `Failed to send Telegram message: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * App entry point - fetches credentials and wraps with logging
 */
export async function sendTelegramMessageStep(
  input: SendTelegramMessageInput
): Promise<SendTelegramMessageResult> {
  "use step";

  const credentials = await fetchCredentials(input.integrationId);

  return withPluginMetrics(
    {
      pluginName: "telegram",
      actionName: "send-message",
      executionId: input._context?.executionId,
    },
    () => withStepLogging(input, () => stepHandler(input, credentials))
  );
}
sendTelegramMessageStep.maxRetries = 0;

export const _integrationType = "telegram";
