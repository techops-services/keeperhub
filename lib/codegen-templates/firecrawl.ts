/**
 * Code template for Firecrawl actions
 * This is a string template used for code generation - keep as string export
 */
export default `import FirecrawlApp from '@mendable/firecrawl-js';

export async function firecrawlStep(input: {
  apiKey: string;
  url?: string;
  query?: string;
  mode: 'scrape' | 'search';
  formats?: string[];
  limit?: number;
}) {
  "use step";
  
  const app = new FirecrawlApp({ apiKey: input.apiKey });
  
  if (input.mode === 'scrape' && input.url) {
    const result = await app.scrape(input.url, {
      formats: (input.formats as any) || ['markdown'],
    });
    return result;
  }
  
  if (input.mode === 'search' && input.query) {
    const result = await app.search(input.query, {
      limit: input.limit,
      scrapeOptions: {
        formats: (input.formats as any) || ['markdown'],
      },
    });
    return result;
  }
  
  throw new Error(\`Invalid Firecrawl mode: \${input.mode}\`);
}`;
