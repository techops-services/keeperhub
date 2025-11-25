/**
 * Executable step function for Generate Image action
 *
 * SECURITY PATTERN - External Secret Store:
 * Step fetches credentials using workflow ID reference
 */
import "server-only";

import type { ImageModelV2 } from "@ai-sdk/provider";
import { createGateway, experimental_generateImage as generateImage } from "ai";
import { fetchCredentials } from "../credential-fetcher";
import { getErrorMessageAsync } from "../utils";

type GenerateImageResult =
  | { success: true; base64: string }
  | { success: false; error: string };

export async function generateImageStep(input: {
  integrationId?: string;
  imageModel: ImageModelV2;
  imagePrompt: string;
}): Promise<GenerateImageResult> {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  const apiKey = credentials.AI_GATEWAY_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error:
        "AI_GATEWAY_API_KEY is not configured. Please add it in Project Integrations.",
    };
  }

  try {
    const gateway = createGateway({
      apiKey,
    });

    // biome-ignore lint/suspicious/noExplicitAny: AI gateway model ID is dynamic
    const modelId = (input.imageModel ?? "bfl/flux-2-pro") as any;
    const result = await generateImage({
      model: gateway.imageModel(modelId),
      prompt: input.imagePrompt,
      size: "1024x1024",
    });

    if (!result.image) {
      return {
        success: false,
        error: "Failed to generate image: No image returned",
      };
    }

    // Extract base64 string from the GeneratedFile object
    const base64 = result.image.base64;

    return { success: true, base64 };
  } catch (error) {
    // Extract meaningful error message from AI SDK errors
    const message = await getErrorMessageAsync(error);
    return {
      success: false,
      error: `Image generation failed: ${message}`,
    };
  }
}
