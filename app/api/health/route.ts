/**
 * KeeperHub Health Check API Route
 *
 * This is a thin wrapper that re-exports the actual implementation
 * from the keeperhub directory to maintain clean separation.
 */
export { GET } from "@/keeperhub/api/health/route";
