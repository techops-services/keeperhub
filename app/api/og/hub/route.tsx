// start custom keeperhub code //
import { generateHubOGImage } from "@/keeperhub/api/og/hub/generate-og-hub";

export function GET(): Response {
  return generateHubOGImage();
}
// end keeperhub code //
