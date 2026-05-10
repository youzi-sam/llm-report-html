# Common mistakes

These are valid-against-schema-but-broken patterns that this tool deliberately catches early via strict validation, lint, or runtime renderer behavior.

## Schema-driven (auto-detected)
{{ range .PresentationNotes }}
### {{ .Title }}

{{ .Body }}
{{ end }}

## Workflow mistakes

### Reading the rendered .html file

Reports embed the renderer + bundled JS (mermaid, JSONLogic, the dispatcher). Total ~3 MB. **Reading the file with `Read` / `cat` / `head` overflows agent context** and corrupts the conversation.

To recover the source JSON from a rendered file:
```bash
llm-report-html extract out.html -o doc.json
```
This pulls only the data slot (~10 KB) — the bundle stays unread.

### Editing the rendered HTML directly

Don't try to "patch" a string in the .html. Always `extract → edit JSON → render`.

### Adding fields not in the schema

The schema is `additionalProperties: false`. The validator rejects any field not in the per-surface `$defs`. Workaround attempts (e.g., adding a `note: "…"` next to `text:`) fail validation; do not bypass — the renderer will produce worse output on rejected data.

### Trying to write inline JS or `<script>` tags

This tool deliberately bounds expressiveness:
- For computation: use cells + JSONLogic + curated operators (`schema --operators`).
- For new visual elements: choose from existing surfaces; don't invent.

If those don't suffice, the request likely doesn't fit this tool — it wants a different deliverable.

## Lint warnings (also auto-detected)

Lint is run as part of `validate`; pass `--strict` to make warnings fatal.

- **unused-cell** — declared in `state` or `computed` but never read by any section
- **undeclared-cell** — `{$bind:X}` or `input.bind` references a cell that doesn't exist in `state` or `computed`
- **cycle** — computed cell A depends on B which depends on A (renderer can't break the loop)
- **trivial-layout** — `tabs` or `columns` with only 1 item; you probably want a different surface
- **empty-container** — `details` or `aside` with no nested sections
