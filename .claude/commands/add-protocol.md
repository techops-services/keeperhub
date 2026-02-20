---
description: Add a new protocol plugin to KeeperHub from a spec file or protocol name
argument-hint: <spec-file-or-protocol-name>
---

<objective>
Add a new KeeperHub protocol plugin. $ARGUMENTS is either:
- A file path ending in `.md` (spec file, e.g., `specs/F-049-sky-protocol-plugin.md`) -- read and extract all protocol details from it
- A protocol name (e.g., "Aave", "Uniswap") -- interview the user for contracts, chains, and actions
- Empty -- ask the user what protocol to add

This command has deep knowledge of the KeeperHub protocol plugin system and creates protocol definition files that follow every convention exactly -- correct imports, defineProtocol shape, validation rules, chain IDs, ABI handling, and post-creation registration.
</objective>

<context>
Reference implementation (WETH): @keeperhub/protocols/weth.ts
Type definitions and defineProtocol API: @keeperhub/lib/protocol-registry.ts
Project conventions: @CLAUDE.md
Existing protocols: !`ls keeperhub/protocols/`
Docs plugin format reference: @docs/plugins/web3.md
Docs plugin nav: @docs/plugins/_meta.ts
Docs plugin overview: @docs/plugins/overview.md
</context>

<architecture>
CRITICAL: Follow these conventions EXACTLY. All protocol definitions go in `keeperhub/protocols/` (NOT `protocols/`).

FILE LOCATION: `keeperhub/protocols/{slug}.ts`

IMPORT (exact):
```typescript
import { defineProtocol } from "@/keeperhub/lib/protocol-registry";
```

EXPORT (exact):
```typescript
export default defineProtocol({...})
```

HOW IT WORKS (registration chain):
Protocol plugins are "meta-plugins" -- each .ts file in `keeperhub/protocols/` defines one protocol, and `pnpm discover-plugins` generates a barrel (`keeperhub/protocols/index.ts`) that imports + registers all of them. The barrel calls `registerProtocol(def)` and `registerIntegration(protocolToPlugin(def))` for each protocol. At server startup, `keeperhub/plugins/protocol/index.ts` imports this barrel as a side effect, which triggers registration. Each protocol slug becomes its own `IntegrationType` entry (e.g., `"weth"`, `"sky"`). The generic `protocol-read` and `protocol-write` step handlers route to the correct contract/function at runtime via a hidden `_protocolMeta` JSON field that's auto-injected into each action's config.

If ANY protocol definition fails validation, the entire import chain fails and the server won't start. This makes correct definitions critical.

COMPLETE defineProtocol() SHAPE:
```typescript
defineProtocol({
  name: string,           // Display name (e.g., "Sky Protocol")
  slug: string,           // kebab-case (e.g., "sky") -- matches filename without .ts
  description: string,    // One-line description of the protocol
  website?: string,       // Protocol website URL (optional)
  icon?: string,          // Path like "/protocols/sky.png" -- optional, default square icon shown if omitted

  contracts: Record<string, {
    label: string,
    addresses: Record<string, string>,  // chainId string -> 0x-prefixed hex address (exactly 42 chars)
    abi?: string,                       // OMIT for auto-fetch (recommended -- see ABI handling below)
  }>,

  actions: Array<{
    slug: string,           // kebab-case (e.g., "deposit-ssr", "get-balance")
    label: string,          // User-facing label (e.g., "Deposit USDS to Savings")
    description: string,    // What the action does (one sentence)
    type: "read" | "write", // read = view/pure functions, write = state-changing transactions
    contract: string,       // MUST exactly match a key in the contracts object above
    function: string,       // Exact Solidity function name (e.g., "deposit", "balanceOf")
    inputs: Array<{
      name: string,         // Exact Solidity parameter name
      type: string,         // MUST be a valid Solidity type: address, uint256, int256, bytes32, bool, string, bytes, uint8, etc.
      label: string,        // User-facing label shown in workflow builder
      default?: string,     // Default value as string (optional)
      decimals?: boolean | number,  // true = 18 decimals, number = specific decimals
    }>,
    outputs?: Array<{       // REQUIRED for read actions that return values. Omit for write actions.
      name: string,         // Output field name (used as {{NodeId.fieldName}} in templates)
      type: string,         // Solidity return type
      label: string,        // User-facing label
      decimals?: number,    // Decimal places for display
    }>,
  }>,
})
```

VALIDATION RULES (enforced by defineProtocol at import time -- violations throw at startup):
- Protocol slug must match `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/` (kebab-case, start with letter)
- Action slugs must match the same pattern
- Contract addresses must match `/^0x[0-9a-fA-F]{40}$/` (exactly 42 chars, 0x prefix)
- Every `action.contract` value must reference an existing key in the `contracts` object
- At least one contract required
- At least one action required
- No duplicate action slugs

CHAIN IDs (numeric strings as object keys):
- `"1"` -- Ethereum Mainnet
- `"8453"` -- Base
- `"42161"` -- Arbitrum One
- `"10"` -- Optimism

ABI HANDLING:
- OMIT the `abi` field from all contract definitions (recommended)
- `resolveAbi()` auto-fetches from block explorers (Etherscan, BaseScan, Arbiscan) with 24h cache
- Proxy detection is automatic: EIP-1967, EIP-1822, EIP-2535 (Diamond) -- ABI follows the implementation
- Only provide inline `abi` if: contract is unverified on all explorers AND you have the ABI string
- Add a comment noting proxy status: `// Proxy -- ABI auto-resolved via abi-cache`

ICON HANDLING:
- Icon is fully optional -- if omitted, a default square protocol icon (`ProtocolIcon`) is displayed everywhere (Hub, workflow builder, etc.)
- If user provides an icon URL: download to `public/protocols/{slug}.png`, set `icon: "/protocols/{slug}.png"`
- If user provides a local image path: copy to `public/protocols/{slug}.png`, set `icon: "/protocols/{slug}.png"`
- If no icon provided: OMIT the `icon` field entirely from the definition -- do not set it to an empty string or null

ACTION GROUPING:
- Group related actions with comment headers in the actions array (improves readability)
- Examples: `// Savings`, `// Token Balances`, `// Approvals`, `// Converters`

OUTPUT FIELDS:
- All actions automatically get: `success` (boolean), `error` (string) -- do NOT define these
- Write actions automatically get: `transactionHash`, `transactionLink` -- do NOT define these
- Read actions: MUST define `outputs` array if the function returns values (e.g., balances, previews). Without outputs, return values are lost
- Write actions: NEVER define outputs for tx hash/link -- they are auto-added

INPUT FIELD AUTO-BEHAVIOR:
- Inputs with `type: "address"` automatically get address book UI support (popover with saved addresses)
- This is handled by `buildConfigFieldsFromAction()` setting `isAddressField: true` -- no manual config needed

CHAIN-ACTION AVAILABILITY:
- An action is only available on chains where its contract has an address
- For multi-contract protocols: verify each action's contract is deployed on all intended chains
- Example: Sky's DAI-USDS Converter exists only on Ethereum ("1"), so `convert-dai-to-usds` is Ethereum-only even if other Sky contracts exist on Base and Arbitrum

POST-CREATION STEPS (run in this exact order):
1. `pnpm discover-plugins` -- scans keeperhub/protocols/, generates keeperhub/protocols/index.ts, adds to lib/types/integration.ts
2. `pnpm check` -- lint check (Biome/Ultracite)
3. `pnpm type-check` -- TypeScript validation

WETH REFERENCE (canonical example -- 4 chains, 3 actions):
```typescript
import { defineProtocol } from "@/keeperhub/lib/protocol-registry";

export default defineProtocol({
  name: "WETH",
  slug: "weth",
  description: "Wrapped Ether -- wrap ETH to WETH (ERC-20) and unwrap back to ETH",
  website: "https://weth.io",
  icon: "/protocols/weth.png",

  contracts: {
    weth: {
      label: "WETH Contract",
      addresses: {
        // Ethereum Mainnet
        "1": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        // Base
        "8453": "0x4200000000000000000000000000000000000006",
        // Arbitrum One
        "42161": "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        // Optimism
        "10": "0x4200000000000000000000000000000000000006",
      },
      // ABI omitted -- resolved automatically via abi-cache
    },
  },

  actions: [
    {
      slug: "wrap",
      label: "Wrap ETH",
      description: "Wrap native ETH into WETH (ERC-20). Send ETH value with the transaction.",
      type: "write",
      contract: "weth",
      function: "deposit",
      inputs: [],
    },
    {
      slug: "unwrap",
      label: "Unwrap WETH",
      description: "Unwrap WETH back to native ETH",
      type: "write",
      contract: "weth",
      function: "withdraw",
      inputs: [{ name: "wad", type: "uint256", label: "Amount (wei)" }],
    },
    {
      slug: "balance-of",
      label: "Get Balance",
      description: "Check WETH balance of an address",
      type: "read",
      contract: "weth",
      function: "balanceOf",
      inputs: [{ name: "account", type: "address", label: "Wallet Address" }],
      outputs: [
        {
          name: "balance",
          type: "uint256",
          label: "WETH Balance (wei)",
          decimals: 18,
        },
      ],
    },
  ],
});
```

F-049 SKY SPEC AS EXAMPLE (what a spec file looks like):
The spec at `specs/F-049-sky-protocol-plugin.md` defines 7 contracts (sUSDS, USDS, DAI, SKY, DAI-USDS Converter, MKR-SKY Converter) and 14 actions across Ethereum, Base, and Arbitrum. It shows how to handle multi-contract, multi-chain protocols with proxy contracts. Use this as the gold standard for complex, multi-contract, multi-chain protocol specs.

WHAT HAPPENS AUTOMATICALLY AFTER REGISTRATION (no manual work needed):
- Protocol card appears in the Hub Protocols tab (`/hub`)
- Shareable detail page at `/hub/protocol/{slug}` with OG image generation
- Protocol actions appear in the workflow builder node palette
- API endpoint at `/api/protocols/{slug}` returns protocol JSON
- Protocol actions appear in `/api/mcp/schemas` for AI workflow generation
- Address-type input fields get address book popover in the UI
</architecture>

<process>
1. PARSE $ARGUMENTS
   - If $ARGUMENTS ends with `.md` and the file exists: read it, extract protocol name, contracts, addresses, chains, and actions
   - If $ARGUMENTS is a protocol name string: research the protocol, then proceed to step 2 to gather details
   - If $ARGUMENTS is empty: ask the user what protocol they want to add, then proceed to step 2

2. GATHER PROTOCOL INFORMATION (skip fields that came from spec file)
   - Protocol name and slug (derive slug as kebab-case from name)
   - Description (one line)
   - Website URL (optional)
   - Icon source: URL to download, local file path, or skip (generic icon used)
   - Which chains to support (Ethereum "1", Base "8453", Arbitrum "42161", Optimism "10")
   - For each contract:
     - Key name (camelCase, e.g., `sUsds`, `daiUsdsConverter`)
     - Display label
     - Address per chain (verify format: 0x + 40 hex chars)
     - Is it a proxy? (note in comment, but omit abi field either way)
   - For each action:
     - Slug (kebab-case)
     - Label (user-facing)
     - Description (one sentence)
     - Type: "read" or "write"
     - Contract key (must match a key in contracts)
     - Function name (exact Solidity name)
     - Inputs array (name, type, label; add decimals for token amounts)
     - Outputs array (for read actions that return values)

3. VALIDATE BEFORE WRITING
   - All slugs are kebab-case (lowercase, letters/digits/hyphens, starts with letter)
   - All addresses are valid: 42 chars total, start with 0x, followed by 40 hex chars
   - Every action.contract value matches an existing contract key
   - No duplicate action slugs
   - At least 1 contract and 1 action
   - All input types are valid Solidity types (address, uint256, int256, bytes32, bool, string, bytes, uint8, uint16, etc.) -- invalid types cause runtime ABI encoding failures
   - For multi-chain protocols: verify each action's contract has addresses on all intended chains (actions are only available on chains where their contract is deployed)
   - Read actions that return values MUST have an `outputs` array defined
   - Protocol slug must not collide with existing plugin type names (check `lib/types/integration.ts`)

4. HANDLE ICON (if provided)
   - If URL: `curl -o public/protocols/{slug}.png "{url}"`
   - If local path: `cp {path} public/protocols/{slug}.png`
   - Set `icon: "/protocols/{slug}.png"` in the definition
   - If skipped: omit the `icon` field entirely

5. CREATE PROTOCOL DEFINITION FILE
   - Write to `keeperhub/protocols/{slug}.ts`
   - Follow exact WETH pattern: import, then export default defineProtocol({...})
   - Add inline comments for chain names (// Ethereum Mainnet, // Base, etc.)
   - Add comment for proxy contracts: `// Proxy -- ABI auto-resolved via abi-cache`
   - Group actions by category with comment headers (// Savings, // Token Balances, etc.)

6. REGISTER AND VALIDATE
   - Run `pnpm discover-plugins` -- confirm no errors, confirm protocol slug appears in output
   - Run `pnpm check` -- if lint errors appear, fix them (block statements, top-level regex, etc.)
   - Run `pnpm type-check` -- if type errors appear, fix them
   - If errors persist after fixing, re-run the relevant check (not all checks)

7. CREATE DOCUMENTATION PAGE
   - Create `docs/plugins/{slug}.md` following the same structure as existing plugin docs (see `docs/plugins/web3.md` for format)
   - Frontmatter: `title: "{name} Protocol"`, `description: "..."` summarizing the protocol's purpose and supported chains
   - Content structure:
     a. H1 heading: `# {name} Protocol`
     b. One-paragraph overview: what the protocol does, which chains it supports, whether credentials are needed (write actions require wallet)
     c. Actions table: columns for Action, Type (Read/Write), Credentials, Description
     d. For EACH action: an H2 section with:
        - **Inputs:** list of input fields with types
        - **Outputs:** list of output fields (for read actions; write actions auto-include success/transactionHash/transactionLink/error)
        - **When to use:** one-sentence guidance
        - Optional example workflow snippet showing the action in a realistic pipeline
     e. A "Supported Chains" section listing each chain with the contracts deployed on it
   - Add the protocol to `docs/plugins/_meta.ts` nav (insert alphabetically among existing entries, using format `{slug}: "{name}"`)
   - Add a row to the plugins overview table in `docs/plugins/overview.md` under Available Plugins (category: "Protocol", credentials: "Wallet (for writes)")

8. VERIFY REGISTRATION
   - Confirm `{slug}` appears as an import in `keeperhub/protocols/index.ts`
   - Confirm `{slug}` appears in the `IntegrationType` union in `lib/types/integration.ts`
   - Confirm `docs/plugins/{slug}.md` exists with correct frontmatter and action sections
   - Confirm `docs/plugins/_meta.ts` includes the `{slug}` entry
   - Confirm `docs/plugins/overview.md` table includes the protocol row
   - Report: protocol name, slug, number of contracts, number of actions, chains supported
</process>

<verification>
Before completing, verify:
- `keeperhub/protocols/{slug}.ts` exists with valid `defineProtocol()` call
- `pnpm discover-plugins` ran without errors
- Protocol slug appears in `keeperhub/protocols/index.ts` (auto-generated barrel)
- Protocol type appears in `lib/types/integration.ts` IntegrationType union
- `pnpm check` passes with zero lint errors
- `pnpm type-check` passes with zero type errors
- `docs/plugins/{slug}.md` exists with frontmatter, actions table, per-action sections, and supported chains
- `docs/plugins/_meta.ts` includes the `{slug}` entry
- `docs/plugins/overview.md` plugins table includes the protocol row
- No emojis in any created files
</verification>

<success_criteria>
- Protocol definition file at `keeperhub/protocols/{slug}.ts` follows exact WETH pattern
- All validation rules pass at import time (slugs, addresses, contract refs)
- `pnpm discover-plugins` registers the protocol in generated registries
- `pnpm check` and `pnpm type-check` pass with zero errors
- Protocol appears in both `keeperhub/protocols/index.ts` and `lib/types/integration.ts`
- Protocol card appears in the Hub Protocols tab (visible in UI)
- Protocol actions appear in workflow builder node palette
- Documentation page at `docs/plugins/{slug}.md` with actions table and per-action details
- Protocol listed in `docs/plugins/overview.md` table and `docs/plugins/_meta.ts` nav
</success_criteria>
