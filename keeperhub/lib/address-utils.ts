/**
 * Truncates an Ethereum address for display purposes.
 * If the address is shorter than or equal to the maxLength, returns it unchanged.
 * Otherwise, returns a truncated version showing the first 6 characters and last 4 characters.
 *
 * @param address - The Ethereum address to truncate
 * @param maxLength - Maximum length before truncation (default: 10)
 * @returns The truncated address in the format "0x1234...5678" or the original address if it's short enough
 */
export function truncateAddress(address: string, maxLength = 10): string {
  if (address.length <= maxLength) {
    return address;
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
