/**
 * Test Endpoint Wrapper
 *
 * This is a thin wrapper that re-exports the actual implementation
 * from the keeperhub directory to maintain clean separation.
 */
export { GET, POST } from "@/keeperhub/api/test/trigger-errors/route";
