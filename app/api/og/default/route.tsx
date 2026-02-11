// start custom keeperhub code //
import { generateDefaultOGImage } from "@/keeperhub/api/og/default/generate-og-default";

export function GET(): Response {
  return generateDefaultOGImage();
}
// end keeperhub code //
