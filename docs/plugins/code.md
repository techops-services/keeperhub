---
title: "Code Plugin"
description: "Execute custom JavaScript for data transformation, aggregation, and analysis within workflows."
---

# Code Plugin

Execute custom JavaScript in a sandboxed environment. No credentials required -- reference upstream node data directly in your code using template variables.

## Actions

| Action   | Description                                                   |
| -------- | ------------------------------------------------------------- |
| Run Code | Execute JavaScript with access to workflow data via templates |

## Run Code

Execute user-written JavaScript in a `node:vm` sandbox. The code runs in an async context, so `return` and `await` are available at the top level.

Template variables like `{{NodeName.field}}` are resolved by the workflow engine before execution -- the code receives the actual values inline. Type `@` in the editor to autocomplete available upstream node outputs.

**Inputs:**

- `code` (required) -- JavaScript to execute in a Monaco code editor with template variable support
- `timeout` (optional) -- Execution timeout in seconds (default: 30, max: 120)

**Outputs:** `success`, `result`, `logs`, `error`, `line`

- `result` -- The return value of the code
- `logs` -- Array of captured `console.log`, `console.warn`, `console.error` calls
- `line` -- Line number where an error occurred (if available)

**Available globals:**

- **I/O:** `console`, `fetch`
- **Core types:** `BigInt`, `JSON`, `Math`, `Date`, `Array`, `Object`, `String`, `Number`, `Boolean`, `RegExp`, `Symbol`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Promise`
- **Error types:** `Error`, `TypeError`, `RangeError`, `SyntaxError`, `ReferenceError`, `URIError`
- **Numeric/parsing:** `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `Infinity`, `NaN`
- **URI encoding:** `encodeURIComponent`, `decodeURIComponent`, `encodeURI`, `decodeURI`
- **Base64:** `atob`, `btoa`
- **Text encoding:** `TextEncoder`, `TextDecoder`
- **Binary/typed arrays:** `ArrayBuffer`, `SharedArrayBuffer`, `DataView`, `Uint8Array`, `Uint16Array`, `Uint32Array`, `Int8Array`, `Int16Array`, `Int32Array`, `Float32Array`, `Float64Array`, `BigInt64Array`, `BigUint64Array`
- **Fetch API:** `URL`, `URLSearchParams`, `Headers`, `Request`, `Response`, `AbortController`, `AbortSignal`
- **Utilities:** `structuredClone`, `Intl`, `crypto`

**Not available:** `require`, `import`, `process`, `fs`, `eval`, `Function` constructor, `setTimeout`, `setInterval`, or any Node.js built-in modules.

**When to use:** Aggregate event data across multiple sources, apply threshold-based anomaly detection, format complex alert payloads, perform custom math or data transformations that don't fit into a predefined node type.

**Example workflow:**
```
Event Trigger: Transfer events
  -> Query Events: get recent transfers
  -> Run Code:
       const events = {{QueryEvents.events}};
       const large = events.filter(e => e.value > 100);
       return { count: large.length, total: large.reduce((s, e) => s + e.value, 0) };
  -> Condition: {{RunCode.result.count}} > 0
  -> Discord: "{{RunCode.result.count}} large transfers totaling {{RunCode.result.total}}"
```

**Security note:** The sandbox uses `node:vm` which prevents accidental access to Node.js internals but is not a security boundary against determined attackers. This is appropriate for a self-hosted platform where users are authenticated team members. `maxRetries` is set to 0 (fail-safe).
