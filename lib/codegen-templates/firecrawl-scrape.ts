/**
 * Code template for Firecrawl Scrape action
 * This is a string template used for code generation - keep as string export
 */
export default `import FirecrawlApp from '@mendable/firecrawl-js';

export async function firecrawlScrapeStep(input: {
  url: string;
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot')[];
}) {
  "use step";

  const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });
  const result = await firecrawl.scrape(input.url, {
    formats: input.formats || ['markdown'],
  });

  return {
    markdown: result.markdown,
    metadata: result.metadata,
  };
}`;
