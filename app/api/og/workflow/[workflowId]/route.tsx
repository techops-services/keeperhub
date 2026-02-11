// start custom keeperhub code //
import { generateWorkflowOGImage } from "@/keeperhub/api/og/generate-og";

export async function GET(
  _request: Request,
  context: { params: Promise<{ workflowId: string }> }
): Promise<Response> {
  const { workflowId } = await context.params;
  return generateWorkflowOGImage(workflowId);
}
// end keeperhub code //
