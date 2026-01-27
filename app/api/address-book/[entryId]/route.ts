/**
 * KeeperHub Address Book Entry API Route
 *
 * This is a thin wrapper that re-exports the actual implementation
 * from the keeperhub directory to maintain clean separation.
 */
export { DELETE, PATCH } from "@/keeperhub/api/address-book/[entryId]/route";
