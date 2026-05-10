# JSONLogic operators

Use these instead of nested if/else. Each operator collapses many lines of conditional logic into a single high-level call.

These operators are curated for common Agent intents. They register in `template/src/operators.js` and are documented in `internal/schema/manifest.json` `operators`.

## Catalog
{{ range .Operators }}
### `{{ .Name }}({{ range $i, $a := .Args }}{{ if $i }}, {{ end }}{{ $a }}{{ end }})`

{{ .Doc }}

```json
{{ .Example }}
```
{{ end }}

## Using operators in `computed`

```json
{
  "state":    { "income": { "type": "number", "default": 360000 } },
  "computed": {
    "tax": { "progressive_bracket": [
      {"var": "income"},
      [[36000, 0.03, 0], [144000, 0.10, 2520], [300000, 0.20, 16920]]
    ]}
  }
}
```

## When operators don't suffice

If high-level operators + JSONLogic together still can't express what you need, **stop and rethink the report shape** — chances are the user wants a different deliverable (a real web app, a script, a notebook), not arbitrary code in a static HTML report. This tool deliberately bounds expressiveness.

## Run-time discovery

```bash
llm-report-html schema --operators
```
