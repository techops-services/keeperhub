// start custom keeperhub code //
import { generateHubOGImage } from "@/keeperhub/api/og/generate-og";

export async function GET(): Promise<Response> {
  return await generateHubOGImage();
}
// end keeperhub code //
