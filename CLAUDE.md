# llm-report-html — contributor guide

This repo IS a skill. The folder `.claude/skills/llm-report-html/` is the primary deliverable; `cmd/`, `internal/`, `template/`, `recipes/` are the build infrastructure that produces it.

For Agent usage, read `.claude/skills/llm-report-html/SKILL.md` (regenerate with `make skill` if missing — generated artifacts are gitignored).

## Single source of truth

| Fact | Canonical home | Generators |
|---|---|---|
| Surface catalog + per-surface schema | `internal/schema/manifest.json` `surfaces` | `schema.json`, skill, CLI `schema --catalog`, generated HTML runtime catalog |
| Operator implementations | `template/src/operators.js` | — |
| Operator metadata | `internal/schema/manifest.json` `operators` | `schema.json`, skill, CLI `schema --operators` |
| Mistake catalog | `internal/schema/manifest.json` `presentationNotes` | `schema.json`, skill `mistakes.md` |
| Recipes | `recipes/*.json` (Go embed) | skill `assets/recipes/` (mirrored on `make skill`) |
| Skill framing / workflow | `internal/skill/templates/*.tmpl.md` | skill files |

Touch the canonical home, run `make`, all derived artifacts update.

## Build

```bash
make             # generate schema, build binary, populate skill folder
make schema      # regenerate internal/schema/schema.json from manifest
make skill       # only regenerate skill (after schema or template edits)
make test        # validate every recipe
make clean       # remove bin/ + generated skill artifacts
```

## When modifying the schema

1. Edit `internal/schema/manifest.json`
2. Run `make` to regenerate schema, rebuild binary, and regenerate skill
3. Run `make test` to confirm all recipes still validate
4. Run tests; semantic validation failures must block render

## When modifying the renderer

- HTML: `template/src/main.js` + `template/src/styles/`. Run `make` to regenerate the schema-derived runtime catalog, build Vite, and re-embed.

## When adding a recipe

1. Drop `recipes/<name>.json`
2. Add description in `recipes/recipes.go` `descriptions` map
3. `make skill` mirrors it into the skill assets

## When adding a JSONLogic operator

1. Implement in `template/src/operators.js`
2. Add metadata entry in `internal/schema/manifest.json` `operators` (schema + CLI consume this)
3. `make` to rebuild

## When adding a surface type

A bigger change. Touch:
- `internal/schema/manifest.json`: add one `surfaces.<type>` entry with strict fields and metadata
- `template/src/main.js`: add encoding or layout dispatch
- `template/src/styles/encodings/_<type>.scss` (or `layouts/`): visual treatment
- `make` to rebuild and regenerate skill

Schema validation catches shape errors. Semantic validation catches broken references and blocks render.
