# Reactive cells

Two top-level fields turn a static report into a small interactive widget without any JS code.

## Concepts

- **`state.<name>`** — input cell. The user can type / pick / toggle this. Types: `number` / `text` / `boolean` / `select`.
- **`computed.<name>`** — derived cell, written as a [JSONLogic](https://jsonlogic.com) expression. Reference other cells with `{"var":"name"}`.
- **`{"$bind": "<name>"}`** — read a cell anywhere a value is expected (`stat.value`, `list.items`, `table.rows`, `image.src`, `details.open`, …).
- **`"…{$bind:name}…"`** — embed a cell value inside any text field (paragraph, callout, heading, summary, …).
- **`"if": <bool | {"$bind":"name"}>`** — conditionally render any section.

Cells live in **one global namespace per document**. Two interactive widgets in one report share the same cell space.

## Minimal example

```json
{
  "state":    { "x": { "type": "number", "default": 100, "min": 0 } },
  "computed": { "y": { "*": [{"var": "x"}, 0.1] } },
  "sections": [
    { "type": "input", "bind": "x" },
    { "type": "stat",  "label": "Result", "value": {"$bind": "y"}, "format": "currency" },
    { "type": "paragraph", "text": "x = {$bind:x}, y = {$bind:y}" },
    { "type": "callout", "kind": "info", "text": "advanced", "if": {"$bind": "x"} }
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
| `input.bind` | special — names the state cell to wire to | `"bind": "income"` |

## Filtering / mapping arrays

JSONLogic's scoped operators (`map`, `filter`, `reduce`, `all`, `some`, `none`) open a new variable scope. Inside, `{"var":"x"}` reads a field of the current item; `{"var":"../y"}` reaches up to the parent scope.

```json
"computed": {
  "filtered": {
    "filter": [
      [{"name":"Alice","score":92}, {"name":"Bob","score":58}],
      { ">=": [{"var": "score"}, {"var": "../min_score"}] }
    ]
  }
}
```

## Markdown degradation

When you render with `--target md`, reactive cells degrade gracefully:
- Templated text fields substitute state defaults; computed cells render as `<name>` placeholders.
- Array bindings become empty (markdown is static).
- `if` evaluates against state defaults; uncertain → show.

## Composition limits (by design)

- No async / network / fetch
- No `localStorage` / persistent state
- No timers / animations
- No arbitrary JS

If you need any of those, this is the wrong tool — see `references/mistakes.md`.
