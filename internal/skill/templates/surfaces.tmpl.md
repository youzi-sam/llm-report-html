# Surfaces

This document is generated from the report manifest via `schema.json`'s `x-surface-catalog` and per-section `$defs`. {{ .SurfaceCount }} surface types total.

## Picking a surface

| Need | Surface |
|---|---|
| Emphasize one sentence | `callout` (kind: info/warn/danger/success) — not `paragraph` |
| Bullet items | `list` |
| Term + explanation pairs | `definition` |
| Question + answer pairs | `faq` |
| Tabular data | `table` |
| Multiple views of same topic | `tabs` |
| Side-by-side comparison | `columns` |
| Fold-out detail | `details` |
| Side margin note | `aside` |
| Single big number | `stat` (can bind to a cell) |
| Diagram (flow / sequence / quadrant / tree / state / ER) | `diagram` |
| Image | `image` (src must be `https://…` or `data:…`) |
| Code block | `code` |
| Time-anchored events | `timeline` |
| User-typed input | `input` + a `state` cell |

## Switch from → to (anti-flat-markdown triggers)

These are the patterns that turn reports into walls of `heading + paragraph`. Each row says: **when you find yourself doing the LEFT, switch to the RIGHT** — that's how the surface palette earns its weight.

| When you find yourself … | Switch to | Why |
|---|---|---|
| Writing 5+ adjacent `heading` + `paragraph` pairs about variants of one topic ("条件 1, 条件 2, …") | `details` × N (default folded) **or** one `tabs` | Reader can scan the index, drill in only where relevant. Don't force linear reading. |
| Listing 3+ named items each with a 1-2 sentence explanation | `definition` | dl/dt/dd is denser, scannable, and visually flags the term. |
| Embedding numbers / metrics into prose ("43% 市场份额, 6 万插件") | `stat` cards in `columns` | KPI on first screen, prose for narrative. |
| Two parallel concepts (pros/cons, before/after, A vs B, free vs paid) | `columns` with two `callout`s **or** a 2-row `table` | Side-by-side beats sequential. |
| A long deep-dive that not every reader needs | `details` (default folded) | Reduces visual fatigue; preserves authoritativeness. |
| An anecdote, sidenote, caveat, methodology note | `aside` | Visually demoted; doesn't break the main flow. |
| An attributed quote | `quote` (with `by:`) | Renders as blockquote with attribution; better than italic paragraph. |
| Q & A pairs (3+) | `faq` | Each Q collapsible, scannable header. |
| Code / API call / config / regex / shell command | `code` (with `lang`) | Monospace, optional syntax highlighting; never inline backticks for >1 line. |
| Multi-perspective same content (developer view / user view / business view) | `tabs` | One topic, three lenses. |
| A predictive / interactive thing (calculator, converter, filter, what-if) | `state` + `computed` + `input` + `stat` | The user becomes a participant, not a reader. See `references/reactivity.md`. |
| A diagram of relationships / steps / states | `diagram` | Don't try to express it in prose or ASCII art. |
| Time-anchored events / version history / project milestones | `timeline` | Visually conveys ordering + spacing better than a numbered list. |
| Tabular data | `table` | But if the table is "name + one-line description" without other columns, use `definition` instead. |

A 1500-word report with **only `heading` + `paragraph` + 1 callout** uses 2 of the {{ .SurfaceCount }} surfaces. That's a smell. Aim for 6+ different types in any non-trivial report.

## Content surfaces (leaf)
{{ range .Encodings }}
### `{{ .Name }}`

{{ .Usage }}

Fields: {{ range $i, $f := .Fields }}{{ if $i }}, {{ end }}`{{ $f }}`{{ end }}

```json
{{ .Example }}
```
{{ end }}

## Container surfaces (recursive)
{{ range .Layouts }}
### `{{ .Name }}`

{{ .Usage }}

Fields: {{ range $i, $f := .Fields }}{{ if $i }}, {{ end }}`{{ $f }}`{{ end }}

```json
{{ .Example }}
```
{{ end }}

## Discovering more

- `llm-report-html schema --catalog` — terse table form
- `llm-report-html schema --example <name>` — single working snippet
- `llm-report-html schema --examples` — every surface's snippet
- `llm-report-html schema --json` — full machine-readable schema
