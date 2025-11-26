/**
 * Code template for Firecrawl Search action
 * This is a string template used for code generation - keep as string export
 */
export default `import FirecrawlApp from '@mendable/firecrawl-js';

export async function firecrawlSearchStep(input: {
  query: string;
  limit?: number;
}) {
  "use step";

  const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });
  const result = await firecrawl.search(input.query, {
    limit: input.limit ? Number(input.limit) : undefined,
  });

  return {
    web: result.web,
  };
}`;
