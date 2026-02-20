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
Existing protocols: !`ls /Users/skp/Dev/TechOps\ Services/keeperhub/keeperhub/protocols/`
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

COMPLETE defineProtocol() SHAPE:
```typescript
defineProtocol({
  name: string,           // Display name (e.g., "Sky Protocol")
  slug: string,           // kebab-case (e.g., "sky") -- matches filename without .ts
  description: string,    // One-line description of the protocol
  website?: string,       // Protocol website URL (optional)
  icon?: string,          // Path like "/protocols/sky.png" -- OMIT if no custom icon

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
      type: string,         // Solidity type (address, uint256, bytes32, bool, etc.)
      label: string,        // User-facing label shown in workflow builder
      default?: string,     // Default value as string (optional)
      decimals?: boolean | number,  // true = 18 decimals, number = specific decimals
    }>,
    outputs?: Array<{
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
- If user provides an icon URL: download to `public/protocols/{slug}.png`, set `icon: "/protocols/{slug}.png"`
- If user provides a local image path: copy to `public/protocols/{slug}.png`, set `icon: "/protocols/{slug}.png"`
- If no icon: OMIT the `icon` field entirely -- a generic protocol icon is used automatically

ACTION GROUPING:
- Group related actions with comment headers in the actions array (improves readability)
- Examples: `// Savings`, `// Token Balances`, `// Approvals`, `// Converters`

OUTPUT FIELDS (automatic -- do NOT define in protocol):
- All actions automatically have: `success` (boolean), `error` (string)
- Write actions automatically have: `transactionHash`, `transactionLink`
- Read actions: add `outputs` array for return values (e.g., balances, previews)

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
The spec at `specs/F-049-sky-protocol-plugin.md` defines 7 contracts (sUSDS, USDS, DAI, SKY, DAI-USDS Converter, MKR-SKY Converter) and 14 actions across Ethereum, Base, and Arbitrum. It shows how to handle multi-contract, multi-chain protocols with proxy contracts.
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

7. VERIFY REGISTRATION
   - Confirm `{slug}` appears as an import in `keeperhub/protocols/index.ts`
   - Confirm `{slug}` appears in the `IntegrationType` union in `lib/types/integration.ts`
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
</success_criteria>
