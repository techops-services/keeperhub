// start custom keeperhub code //
import { generateDefaultOGImage } from "@/keeperhub/api/og/generate-og";

export async function GET(): Promise<Response> {
  return await generateDefaultOGImage();
}
// end keeperhub code //
