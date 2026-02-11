// start custom keeperhub code //
import { generateHubOGImage } from "@/keeperhub/api/og/generate-og";

export function GET(): Response {
  return generateHubOGImage();
}
// end keeperhub code //
