# Reactive cells

The top-level `cells` map turns a static report into a small interactive widget. JSON wires the cell graph; JS operator modules own non-trivial logic.

## Concepts

- **`cells.<name>` input** — user-editable cell. The user can type / pick / toggle this. Types: `number` / `text` / `boolean` / `select`.
- **`cells.<name>` computed** — derived cell. Its `expr` is typed IR: `{ "value": ... }`, `{ "cell": "name" }`, or `{ "call": "operator", "args": [...] }`.
- **`runtime.operators`** — relative paths to pure JS modules that export `defineOperator({ name, args, returns, pure, tests, run })`.
- **`{"$bind": "<name>"}`** — read a cell anywhere a value is expected (`stat.value`, `list.items`, `table.rows`, `image.src`, `details.open`, …).
- **`"…{$bind:name}…"`** — embed a cell value inside any text field (paragraph, callout, heading, summary, …).
- **`"if": <bool | {"$bind":"name"}>`** — conditionally render any section.

Cells live in **one global namespace per document**. Two interactive widgets in one report share the same cell space.

## Minimal example

```json
{
  "runtime": { "operators": ["./runtime/tax2025.mjs"] },
  "cells": {
    "income": { "kind": "input", "type": "number", "default": 1000, "min": 0 },
    "tax": {
      "kind": "computed",
      "type": "number",
      "expr": { "call": "tax2025", "args": [{ "cell": "income" }] }
    }
  },
  "sections": [
    { "type": "input", "bind": "income" },
    { "type": "stat", "label": "Tax", "value": {"$bind": "tax"}, "format": "currency" },
    { "type": "paragraph", "text": "income = {$bind:income}, tax = {$bind:tax}" }
  ]
}
```

## Where bindings work

| Field | Binding form | Example |
|---|---|---|
| `stat.value` | `{$bind}` | `"value": {"$bind": "tax"}` |
| Any text field | inline template | `"text": "Total: {$bind:total}"` |
| `list.items` / `table.rows` / `timeline.items` / etc. | whole-array `{$bind}` | `"items": {"$bind": "filtered"}` |
| `details.open` / `list.ordered` (booleans) | `{$bind}` | `"open": {"$bind": "expandAll"}` |
| `section.if` | `{$bind}` to any cell (truthy → render) | `"if": {"$bind": "showAdvanced"}` |
| `input.bind` | special — names an input cell to wire to | `"bind": "income"` |

## Operator module shape

```js
export default defineOperator({
  name: "tax2025",
  args: ["number"],
  returns: "number",
  pure: true,
  tests: [{ args: [1000], returns: 30 }],
  run(income) {
    return income * 0.03
  }
})
```

The render gate runs the tests and rejects forbidden browser APIs before inlining the module into the HTML.

## Filtering / mapping arrays

Put array logic in an operator module and bind the computed array.

```json
"cells": {
  "min_score": { "kind": "input", "type": "number", "default": 70 },
  "candidates": {
    "kind": "computed",
    "type": "array",
    "expr": { "call": "passingCandidates", "args": [{ "cell": "min_score" }] }
  }
}
```

## Composition limits (by design)

- No async / network / fetch
- No `localStorage` / persistent state
- No timers / animations
- No arbitrary JS inside JSON; JS is only allowed through validated operator modules

If you need any of those, this is the wrong tool — see `references/mistakes.md`.
