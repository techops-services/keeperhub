// start custom keeperhub code //
import { generateDefaultOGImage } from "@/keeperhub/api/og/generate-og";

export function GET(): Response {
  return generateDefaultOGImage();
}
// end keeperhub code //
