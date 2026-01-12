/**
 * Test connection for AI Gateway integration
 * AI Gateway managed keys are tested through the Vercel API
 */
export async function testConnection(): Promise<{
  status: "success" | "error";
  message: string;
}> {
  // AI Gateway connections are validated through the Vercel API consent flow
  // No separate test needed as the managed key is created by Vercel
  return {
    status: "success",
    message: "AI Gateway connection is managed by Vercel",
  };
}
