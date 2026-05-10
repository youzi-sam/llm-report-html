import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const manifestPath = resolve(here, 'manifest.json')
const schemaPath = resolve(here, 'schema.json')

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const generated = buildSchema(manifest)
const body = JSON.stringify(generated, null, 2) + '\n'

if (process.argv.includes('--check')) {
  const current = readFileSync(schemaPath, 'utf8')
  if (current !== body) {
    console.error('internal/schema/schema.json is stale; run `make schema`.')
    process.exit(1)
  }
} else {
  writeFileSync(schemaPath, body)
}

function buildSchema(m) {
  const surfaceNames = Object.keys(m.surfaces)
  const surfaceCatalog = Object.fromEntries(surfaceNames.map(name => {
    const s = m.surfaces[name]
    return [name, {
      kind: s.kind,
      binds: s.binds,
      fields: s.fields || [],
      usage: s.usage,
    }]
  }))

  const defs = {
    section: buildSectionUnion(surfaceNames),
  }
  for (const name of surfaceNames) {
    defs[`section.${name}`] = buildSectionDef(name, m.surfaces[name])
  }
  for (const [name, def] of Object.entries(m.defs || {})) {
    defs[name] = def
  }

  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    title: m.schema.title,
    version: m.schema.version,
    description: m.schema.description,
    'x-surface-catalog': surfaceCatalog,
    'x-presentation-notes': m.presentationNotes || {},
    type: 'object',
    additionalProperties: false,
    required: ['sections'],
    properties: {
      title: { type: 'string' },
      subtitle: { type: 'string' },
      author: { type: 'string' },
      date: { type: 'string' },
      state: {
        type: 'object',
        additionalProperties: { $ref: '#/$defs/state.cell' },
      },
      computed: {
        type: 'object',
        additionalProperties: true,
      },
      sections: {
        type: 'array',
        minItems: 1,
        items: { $ref: '#/$defs/section' },
      },
    },
    $defs: defs,
    'x-jsonlogic-operators': m.operators || {},
  }
}

function buildSectionUnion(surfaceNames) {
  return {
    type: 'object',
    required: ['type'],
    properties: {
      type: { enum: surfaceNames },
    },
    allOf: surfaceNames.map(name => ({
      if: {
        properties: {
          type: { const: name },
        },
        required: ['type'],
      },
      then: { $ref: `#/$defs/section.${name}` },
    })),
  }
}

function buildSectionDef(name, surface) {
  const schema = structuredClone(surface.schema || {})
  const out = {
    ...schema,
    required: ['type', ...(schema.required || [])],
    properties: {
      type: { const: name },
      ...(schema.properties || {}),
    },
  }
  if (surface.examples) {
    out.examples = surface.examples.map(example => ({ type: name, ...example }))
  }
  return out
}
