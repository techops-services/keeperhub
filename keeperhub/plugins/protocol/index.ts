/**
 * Protocol Plugin Shell
 *
 * Protocol integrations are dynamically generated from protocol definitions
 * in keeperhub/protocols/. Each protocol becomes its own IntegrationPlugin
 * via protocolToPlugin() in keeperhub/lib/protocol-registry.ts.
 *
 * Registration happens in scripts/discover-plugins.ts, NOT here.
 * This directory exists so that:
 * 1. discover-plugins detects `protocol` as a plugin directory
 * 2. Step files (protocol-read, protocol-write) have a canonical home
 */
export { ProtocolIcon } from "./icon";
