import "server-only";

import { withPluginMetrics } from "@/keeperhub/lib/metrics/instrumentation/plugin";
import { fetchCredentials } from "@/lib/credential-fetcher";
import { type StepInput, withStepLogging } from "@/lib/steps/step-handler";
import { getErrorMessage } from "@/lib/utils";
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
};

export type SendTelegramMessageInput = StepInput &
  SendTelegramMessageCoreInput & {
    integrationId: string;
  };

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
    console.error("[Telegram] No bot token provided in integration");
    return {
      success: false,
      error:
        "Telegram bot token is required. Please configure it in the integration settings.",
    };
  }

  if (!input.chatId) {
    console.error("[Telegram] No chat ID provided");
    return {
      success: false,
      error: "Chat ID is required. Please provide a valid chat ID.",
    };
  }

  if (!input.message) {
    console.error("[Telegram] No message provided");
    return {
      success: false,
      error: "Message text is required.",
    };
  }

  try {
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: input.chatId,
        text: input.message,
      }),
    });

    const data = (await response
      .json()
      .catch(() => ({}))) as TelegramApiResponse;

    if (!(response.ok && data.ok)) {
      console.error("[Telegram] API error:", data);
      return {
        success: false,
        error:
          data.description ||
          `HTTP ${response.status}: Failed to send Telegram message`,
      };
    }

    console.log("[Telegram] Message sent successfully");

    return {
      success: true,
      messageId: data.result?.message_id || 0,
    };
  } catch (error) {
    console.error("[Telegram] Error sending message:", error);
    return {
      success: false,
      error: `Failed to send Telegram message: ${getErrorMessage(error)}`,
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
