# llm-report-html — contributor guide

This repo IS a skill. The folder `.claude/skills/llm-report-html/` is the primary deliverable; `cmd/`, `internal/`, `template/`, `recipes/` are the build infrastructure that produces it.

For Agent usage, read `.claude/skills/llm-report-html/SKILL.md` (regenerate with `make skill` if missing — generated artifacts are gitignored).

## Single source of truth

| Fact | Canonical home | Generators |
|---|---|---|
| Surface catalog | `internal/schema/schema.json` `x-surface-catalog` + `$defs/section.<type>` | skill, CLI `schema --catalog` |
| Operator implementations | `template/src/operators.js` | — |
| Operator metadata | `internal/schema/schema.json` `x-jsonlogic-operators` | skill, CLI `schema --operators` |
| Mistake catalog | `internal/schema/schema.json` `x-presentation-notes` | skill `mistakes.md` |
| Recipes | `recipes/*.json` (Go embed) | skill `assets/recipes/` (mirrored on `make skill`) |
| Skill framing / workflow | `internal/skill/templates/*.tmpl.md` | skill files |

Touch the canonical home, run `make skill`, all derived docs update.

## Build

```bash
make             # build binary + populate skill folder
make skill       # only regenerate skill (after schema or template edits)
make test        # validate every recipe
make clean       # remove bin/ + generated skill artifacts
```

## When modifying the schema

1. Edit `internal/schema/schema.json`
2. Run `make` to rebuild binary AND regenerate skill
3. Run `make test` to confirm all recipes still validate
4. Manually verify lint warnings on representative recipes

## When modifying the renderer

- HTML: `template/src/main.js` + `template/src/styles/`. Run `cd template && npx vite build`, then `make` to re-embed.
- Markdown: `internal/render/markdown/`. Both renderers must handle every surface — markdown degrades gracefully when needed (tabs → linear sections; array bindings → placeholder).

## When adding a recipe

1. Drop `recipes/<name>.json`
2. Add description in `recipes/recipes.go` `descriptions` map
3. `make skill` mirrors it into the skill assets

## When adding a JSONLogic operator

1. Implement in `template/src/operators.js`
2. Add metadata entry in `internal/schema/schema.json` `x-jsonlogic-operators` (the generator + CLI consume this)
3. `make` to rebuild

## When adding a surface type

A bigger change. Touch:
- `internal/schema/schema.json`: add `$defs/section.<type>` with strict fields + add to `x-surface-catalog`
- `template/src/main.js`: add encoding or layout dispatch
- `internal/render/markdown/markdown.go`: add the same handling
- `template/src/styles/encodings/_<type>.scss` (or `layouts/`): visual treatment
- `make` to rebuild and regenerate skill

The strict schema validator catches most mistakes; lint catches semantic ones.
