# Common mistakes

These are valid-against-schema-but-broken patterns that this tool deliberately catches early via semantic validation, presentation warnings, or runtime renderer behavior.

## Schema-driven (auto-detected)
{{ range .PresentationNotes }}
### {{ .Title }}

{{ .Body }}
{{ end }}

## Workflow mistakes

### Reading the rendered .html file

Reports embed feature-selected runtime packs, CSS, render data, and the source JSON slot. **Do not read the rendered HTML with `Read` / `cat` / `head`**; use `extract`.

To recover the source JSON from a rendered file:
```bash
llm-report-html extract out.html -o doc.json
```
This pulls only the source JSON slot — runtime packs stay unread.

The rendered HTML also has a small top-right `JSON` disclosure for browser viewing. That is for human inspection, not for agent editing.

### Editing the rendered HTML directly

Don't try to "patch" a string in the .html. Always `extract → edit JSON → render`.

### Adding fields not in the schema

The schema is `additionalProperties: false`. The validator rejects any field not in the per-surface `$defs`. Workaround attempts (e.g., adding a `note: "…"` next to `text:`) fail validation; do not bypass — the renderer will produce worse output on rejected data.

### Trying to write inline JS or `<script>` tags

This tool deliberately bounds expressiveness:
- For computation: use cells + JSONLogic + curated operators (`schema --operators`).
- For new visual elements: choose from existing surfaces; don't invent.

If those don't suffice, the request likely doesn't fit this tool — it wants a different deliverable.

### Empty-text callout used as a colored section heading

`callout` is a **labeled boxed message**. Its body lives in the `text` field (markdown — bullet lists, paragraphs, bold, etc. all work inside). It is NOT a "colored heading widget".

Anti-pattern (passes validation but renders visually broken — content escapes the callout box):

```json
{"type": "callout", "kind": "success", "title": "功绩", "text": ""},
{"type": "list",    "items": [...]}
```

The sibling `list` renders **outside** the callout's bordered container — orphaned bullets below an empty colored bar.

Correct patterns:
- Put bullets inside the callout's `text` as markdown: `"text": "- item 1\n- item 2\n- item 3"`.
- For a "pros vs cons" comparison, use `columns` of two callouts, each with bullets in its own `text`.
- If you only want a tinted section header without a body, use a normal `heading` — don't co-opt callout.

### Raw diagram DSL

Do not write raw diagram DSL. Use structured `diagram` with `kind: flow|sequence|quadrant|tree|state|er`; the renderer owns the SVG backend.

Backend matrix:
- SVG-backed: `flow`, `sequence`, `quadrant`, `tree`, `state`, `er`

Diagram kinds are rendered and geometry-checked by the repo test gate.

Unsupported diagram grammars (Sankey, C4, class diagrams, etc.) are unsupported states, not escape hatches. Add a first-class `diagram.kind` before using them.

### Diagram typography

Do not add per-report font-size fields or fake small text by inserting extra line breaks. Diagram typography is renderer-owned through `--diagram-font-size`, `--diagram-font-size-small`, and `--diagram-label-line-height`; structured JSON owns only semantic content.

### Fake headings

Do not use bold paragraphs as section titles. Use `heading`; the rendered report builds its TOC from real `h2`-`h4` headings.

### Code highlighting expectations

Use `code.lang` for recognized languages (`go`, `javascript`, `typescript`, `python`, `json`, etc.). Unknown languages render as escaped plain code; do not fake highlighting with inline HTML.

## Semantic validation errors

These block both `validate` and `render`.

- **undeclared-cell** — `{$bind:X}` or `input.bind` references a cell that doesn't exist in `state` or `computed`
- **input-bind-kind** — `input.bind` references a computed cell; inputs can only write to `state`
- **cycle** — computed cell A depends on B which depends on A (renderer can't break the loop)
- **undeclared-node** — `diagram.flow` / `diagram.state` references a node id not declared in the corresponding node array

## Presentation warnings

These are printed by `validate` but do not block render.

- **unused-cell** — declared in `state` or `computed` but never read by any section
- **trivial-layout** — `tabs` or `columns` with only 1 item; you probably want a different surface
- **empty-container** — `details` or `aside` with no nested sections
- **empty-callout** — `callout` with empty `text`; almost always means content was placed as a sibling and escapes the box (see "Empty-text callout" above)
