# Runtime operator modules

Use JS operator modules when JSON cell wiring is not enough. JSON should describe the report and cell dependency graph; business logic belongs in ordinary JS with a contract and tests.

## Contract

```js
export default defineOperator({
  name: "tax2025",
  args: ["number"],
  returns: "number",
  pure: true,
  tests: [
    { args: [1000], returns: 30 }
  ],
  run(income) {
    return income * 0.03
  }
})
```

Allowed contract types: `number`, `text`, `boolean`, `array`, `object`, `any`.

The renderer rejects modules that use network, storage, timers, random, `Date`, DOM globals, imports, or secondary exports. Tests must pass before the operator is inlined into the HTML.

## Using operators in cells

```json
{
  "runtime": { "operators": ["./runtime/tax2025.mjs"] },
  "cells": {
    "income": { "kind": "input", "type": "number", "default": 360000 },
    "tax": {
      "kind": "computed",
      "type": "number",
      "expr": { "call": "tax2025", "args": [{ "cell": "income" }] }
    }
  }
}
```

## When operators don't suffice

If pure operators cannot express the interaction because it needs async, remote data, timers, persistent state, DOM mutation, or user sessions, this is the wrong deliverable. Build an app, script, or notebook instead.

## Run-time discovery

```bash
llm-report-html schema --operators
```
