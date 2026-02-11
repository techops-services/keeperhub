// start custom keeperhub code //
// Replaces edge self-fetch approach with direct DB query.
// Original used: fetch(`${baseUrl}/api/workflows/${workflowId}`) on edge runtime
// which fails when external crawlers (Discord, Slack) hit it due to loopback/auth issues.
// New approach queries DB directly from Node.js runtime via keeperhub module.
import { generateWorkflowOGImage } from "@/keeperhub/api/og/workflow/generate-og-image";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workflowId: string }> }
): Promise<Response> {
  const { workflowId } = await context.params;
  return generateWorkflowOGImage(workflowId);
}
// end keeperhub code //
