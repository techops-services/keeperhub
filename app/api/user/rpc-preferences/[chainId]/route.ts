/**
 * KeeperHub RPC Preferences Chain API Route
 *
 * This is a thin wrapper that re-exports the actual implementation
 * from the keeperhub directory to maintain clean separation.
 */
export {
  DELETE,
  GET,
  PUT,
} from "@/keeperhub/api/user/rpc-preferences/[chainId]/route";
