// start custom keeperhub code //
import { generateProtocolOGImage } from "@/keeperhub/api/og/generate-og";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> }
): Promise<Response> {
  const { slug } = await context.params;
  return await generateProtocolOGImage(slug);
}
// end keeperhub code //
