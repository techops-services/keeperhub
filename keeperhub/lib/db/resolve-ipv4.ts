import { resolve4, resolve6 } from "node:dns/promises";

export type DnsResolutionResult = {
  hasIPv4: boolean;
  hasIPv6: boolean;
  ipv6Only: boolean;
};

const IPV6_ONLY_ERROR =
  "The database host resolves only to an IPv6 address, which is not reachable from this environment. " +
  "If using Supabase, switch to the Session Pooler connection string " +
  "(found in your Supabase dashboard under Connect > Connection String > Session Pooler). " +
  "For other providers, use a hostname or IP address that supports IPv4.";

export function getIPv6OnlyErrorMessage(): string {
  return IPV6_ONLY_ERROR;
}

export async function checkHostDns(
  hostname: string
): Promise<DnsResolutionResult> {
  const [ipv4, ipv6] = await Promise.all([
    resolve4(hostname).catch(() => []),
    resolve6(hostname).catch(() => []),
  ]);

  return {
    hasIPv4: ipv4.length > 0,
    hasIPv6: ipv6.length > 0,
    ipv6Only: ipv6.length > 0 && ipv4.length === 0,
  };
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === ""
  );
}

export async function checkUrlForIPv6Only(
  url: string
): Promise<string | null> {
  try {
    const parsed = new URL(url);
    const { hostname } = parsed;

    if (isLocalHost(hostname)) {
      return null;
    }

    const result = await checkHostDns(hostname);

    if (result.ipv6Only) {
      return IPV6_ONLY_ERROR;
    }
  } catch {
    // URL parsing or DNS lookup failed - let the connection attempt handle it
  }

  return null;
}
