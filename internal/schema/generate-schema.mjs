import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const manifestSourceDir = resolve(here, 'manifest-src')
const manifestPath = resolve(here, 'manifest.json')
const schemaPath = resolve(here, 'schema.json')

const manifest = loadManifestSource()
const manifestBody = JSON.stringify(manifest, null, 2) + '\n'
const generated = buildSchema(manifest)
const schemaBody = JSON.stringify(generated, null, 2) + '\n'

if (process.argv.includes('--check')) {
  const currentManifest = readFileSync(manifestPath, 'utf8')
  const currentSchema = readFileSync(schemaPath, 'utf8')
  if (currentManifest !== manifestBody) {
    console.error('internal/schema/manifest.json is stale; run `make schema`.')
    process.exit(1)
  }
  if (currentSchema !== schemaBody) {
    console.error('internal/schema/schema.json is stale; run `make schema`.')
    process.exit(1)
  }
} else {
  writeFileSync(manifestPath, manifestBody)
  writeFileSync(schemaPath, schemaBody)
}

function loadManifestSource() {
  const base = readJson(resolve(manifestSourceDir, 'base.json'))
  return {
    ...base,
    surfaces: readNamedJsonDir(resolve(manifestSourceDir, 'surfaces')),
    defs: readNamedJsonDir(resolve(manifestSourceDir, 'defs')),
  }
}

function readNamedJsonDir(dir) {
  const entries = {}
  for (const file of readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    entries[basename(file, '.json')] = readJson(resolve(dir, file))
  }
  return entries
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
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
      runtime: {
        type: 'object',
        additionalProperties: false,
        properties: {
          operators: {
            type: 'array',
            items: {
              type: 'string',
              minLength: 1,
            },
            uniqueItems: true,
          },
        },
      },
      cells: {
        type: 'object',
        propertyNames: {
          pattern: '^[A-Za-z_][A-Za-z0-9_]*$',
        },
        additionalProperties: { $ref: '#/$defs/cell' },
      },
      sections: {
        type: 'array',
        minItems: 1,
        items: { $ref: '#/$defs/section' },
      },
    },
    $defs: defs,
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
