import "server-only";

import FirecrawlApp from "@mendable/firecrawl-js";
import { fetchCredentials } from "../credential-fetcher";
import { getErrorMessage } from "../utils";

// --- Scrape ---

export async function firecrawlScrapeStep(input: {
  integrationId?: string;
  url: string;
  formats?: ("markdown" | "html" | "rawHtml" | "links" | "screenshot")[];
}) {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  const apiKey = credentials.FIRECRAWL_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "Firecrawl API Key is not configured.",
    };
  }

  try {
    const firecrawl = new FirecrawlApp({ apiKey });
    const result = await firecrawl.scrape(input.url, {
      formats: input.formats || ["markdown"],
    });

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: `Failed to scrape: ${getErrorMessage(error)}`,
    };
  }
}

// --- Search ---

export async function firecrawlSearchStep(input: {
  integrationId?: string;
  query: string;
  limit?: number;
  scrapeOptions?: {
    formats?: ("markdown" | "html" | "rawHtml" | "links" | "screenshot")[];
  };
}) {
  "use step";

  const credentials = input.integrationId
    ? await fetchCredentials(input.integrationId)
    : {};

  const apiKey = credentials.FIRECRAWL_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "Firecrawl API Key is not configured.",
    };
  }

  try {
    const firecrawl = new FirecrawlApp({ apiKey });
    const result = await firecrawl.search(input.query, {
      limit: input.limit ? Number(input.limit) : undefined,
      scrapeOptions: input.scrapeOptions,
    });

    return { success: true, data: result };
  } catch (error) {
    return {
      success: false,
      error: `Failed to search: ${getErrorMessage(error)}`,
    };
  }
}

