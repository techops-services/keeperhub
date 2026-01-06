/**
 * KeeperHub RPC Preferences Chain API Route
 *
 * This is a thin wrapper that re-exports the actual implementation
 * from the keeperhub directory to maintain clean separation.
 */
// biome-ignore format: keep on single line for noBarrelFile suppression to work
// biome-ignore lint/performance/noBarrelFile: Intentional re-export for Next.js routing
export { DELETE, GET, PUT } from "@/keeperhub/api/user/rpc-preferences/[chainId]/route";
