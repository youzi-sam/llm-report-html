# Type bindings

The schema is the single source of truth. External code that consumes this format should generate types from it, not transcribe by hand.

## TypeScript

```bash
llm-report-html schema --json | npx -y json-schema-to-typescript > types.d.ts
```

You get one `Document` interface plus per-surface `Section_Heading`, `Section_Callout`, `Section_Tabs`, etc., as a discriminated union on `type`. State / computed cells are `Record<string, ...>`.

## Python

```bash
llm-report-html schema --json > schema.json
datamodel-codegen --input schema.json --output models.py
```

You get pydantic-style models with the same per-surface union.

## Go

The Go side already imports from this repo's `internal/schema/` package. External Go consumers can:

```bash
llm-report-html schema --json > schema.json
# then use github.com/atombender/go-jsonschema or similar
```

## Validation in your own code

You don't need to reimplement validation. Pipe the document through the CLI:

```bash
cat my-report.json | llm-report-html validate
echo $?  # 0 = ok, 1 = invalid
```

Or invoke from Python / Node / etc. via subprocess.

## When the schema changes

Re-run the codegen step. The schema's `version` field signals breaking changes; `version` major bumps mean per-surface field changes.
