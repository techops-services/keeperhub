/**
 * KeeperHub RPC Preferences API Route
 *
 * This is a thin wrapper that re-exports the actual implementation
 * from the keeperhub directory to maintain clean separation.
 */
// biome-ignore lint/performance/noBarrelFile: Intentional re-export for Next.js routing
export { GET } from "@/keeperhub/api/user/rpc-preferences/route";
