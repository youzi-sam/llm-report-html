---
name: llm-report-html
description: This skill should be used when the user wants a self-contained HTML report — briefing, KPI dashboard, status update, comparison, how-to tutorial, FAQ page, calculator, filtered list, or anything they will read in a browser, email, or paste in chat. The skill produces typed JSON and runs the local `llm-report-html` CLI to render a single self-contained `.html` file (feature-pruned renderer + data inlined). It NEVER reads the rendered HTML directly; use `extract` to recover source JSON. It enforces a 4-question composition worksheet BEFORE writing JSON, uses a curated surface catalog with strict JSON Schema validation, and provides JSONLogic operators for bounded interactivity instead of arbitrary code.
---

# llm-report-html

Render typed JSON to a self-contained, optionally interactive HTML report.

Rendered reports include:
- an automatic TOC from rendered `h2`-`h4` headings when there are at least two headings,
- a small top-right `JSON` disclosure that formats the embedded source JSON on demand,
- precompiled code highlighting for recognized `code.lang` values, without browser highlighter JS.

## When to invoke

Trigger on any request matching: briefing / executive summary / KPI dashboard / status report / comparison / pros-cons / how-to tutorial / FAQ / glossary / calculator / unit converter / interest or tax tool / filtered list / search UI. **Do not** use for plain Markdown, multi-page sites, or web apps with networking.

## Before writing JSON: answer these 4 questions

These are **non-skippable**. If you can't answer one in writing, EITHER ask the user (`AskUserQuestion`) OR the request doesn't merit this tool — say so.

```
1. PURPOSE
   读完这份报告，读者会做什么不同的事？
   Not "be informed" / "learn about X" — push to "decide X / stop Y / confirm Z".
   No answer → this report shouldn't exist; reply with 3 sentences instead.

2. TENSION
   What's contested, surprising, or decision-forcing?
   Pure summaries have no tension — Markdown is enough; this tool is overkill.
   No answer → don't write a report; you're padding.

3. STRONGEST × WEAKEST
   One sentence: your strongest claim.
   One sentence: where the evidence is thinnest.
   Strongest → opening `callout`. Weakest → `aside` or methodology `callout`.
   The weakest must be visible; never hidden.

4. CUT TEST
   Delete 80%. What 20% remains? That's your beats.
   Surface choice falls out automatically:
     a number / metric  → stat
     a comparison       → columns OR table
     a sequence in time → timeline
     a relation graph   → diagram
     deep-dive most readers skip → details
     attributed claim   → quote
     Q & A              → faq
     term + meaning     → definition
     contested point    → columns of pros/cons OR aside for counter-arg

If your final draft uses fewer than 5 surface types, you didn't compress — go back to step 4.
```

`references/composition.md` has worked examples (good answers vs bad) and anti-patterns.

## Workflow

```bash
llm-report-html validate my.json     # schema + semantic validation + warnings
llm-report-html render   my.json -o my.html
# Render opens the HTML by default. Add `--no-open` only for headless runs.
```

To modify an existing report: `extract → edit → render`. **Never `Read` the .html**; it embeds runtime packs and report data. Use `extract` for the source JSON slot.

```bash
llm-report-html extract  out.html -o doc.json
# edit doc.json
llm-report-html render   doc.json -o out.html
```

## Surface palette ({{ .SurfaceCount }} total)

Each line: name — when to pick → minimal field shape. For full per-surface examples and the "switch from / to" table, see `references/surfaces.md`.

**Content (leaf):**
{{ range .Encodings -}}
- `{{ .Name }}` — {{ .Usage }} → `{type:"{{ .Name }}"{{ range .Fields }}, {{ . }}{{ end }}}`
{{ end }}
**Container (recursive):**
{{ range .Layouts -}}
- `{{ .Name }}` — {{ .Usage }} → `{type:"{{ .Name }}"{{ range .Fields }}, {{ . }}{{ end }}}`
{{ end }}

Notes:
- `heading` sections automatically feed the TOC; use real heading hierarchy instead of fake bold paragraphs.
- `code.lang` is highlighted at render time when the language is recognized. Unknown languages render as escaped plain code.

## Reactive cells (optional, for interactivity)

Two top-level fields make a static report interactive without writing JS:

```json
"state":    { "x": { "type": "number", "default": 100 } },
"computed": { "y": { "*": [{"var": "x"}, 0.1] } },
```

Reference cells with `{"$bind": "name"}` (in `stat.value`, array fields, etc.) or inline templates `"text": "Result: {$bind:y}"`. Conditional sections via `"if": {"$bind": "flag"}`. Use curated JSONLogic operators (`progressive_bracket` / `lookup_table` / `format_currency` / …) — see `references/operators.md`.

Two case studies (read for technique; do NOT copy structure):
- `llm-report-html recipe show calculator` — state + computed + progressive_bracket
- `llm-report-html recipe show filtered-list` — array binding + section.if + scoped JSONLogic

## References (load on-demand)

- `references/composition.md` — worked examples of the 4 meta-questions; anti-patterns
- `references/surfaces.md` — switch-from-to table; full per-surface fields + examples
- `references/operators.md` — JSONLogic operator library
- `references/reactivity.md` — cells / bindings / conditionals / arrays
- `references/mistakes.md` — pitfalls (diagram ids, image src, …)
- `references/type-bindings.md` — TS / Python type generation from the schema

## Authoritative source

`llm-report-html schema --json` is the generated machine-readable contract. CLI usage: `llm-report-html -h`.
