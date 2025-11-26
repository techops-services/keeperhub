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

    // Return markdown and metadata directly for easier access
    // e.g., {{Scrape.markdown}}, {{Scrape.metadata.title}}
    return {
      markdown: result.markdown,
      metadata: result.metadata,
    };
  } catch (error) {
    throw new Error(`Failed to scrape: ${getErrorMessage(error)}`);
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

    // Return web results directly for easier access
    // e.g., {{Search.web[0].title}}, {{Search.web[0].url}}
    return {
      web: result.web,
    };
  } catch (error) {
    throw new Error(`Failed to search: ${getErrorMessage(error)}`);
  }
}
