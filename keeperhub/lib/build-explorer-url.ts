/**
 * Build block explorer URL for an address.
 * Client-safe; mirrors logic from @/lib/explorer getAddressUrl.
 */
export function buildAddressUrl(
  explorerUrl: string | null,
  explorerAddressPath: string | null,
  address: string
): string | null {
  if (!(explorerUrl && explorerAddressPath)) {
    return null;
  }
  const path = explorerAddressPath.replace("{address}", address);
  return `${explorerUrl}${path}`;
}
