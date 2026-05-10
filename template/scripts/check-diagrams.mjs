import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { countEREntities, countERRelationships, renderERSvg } from '../src/erSvgRenderer.js'
import { renderFlowSvg } from '../src/flowSvgRenderer.js'
import { countQuadrantItems, renderQuadrantSvg } from '../src/quadrantSvgRenderer.js'
import { countSequenceActors, countSequenceMessages, renderSequenceSvg } from '../src/sequenceSvgRenderer.js'
import { countStateEdges, countStateNodes, renderStateSvg } from '../src/stateSvgRenderer.js'
import { countTreeEdges, countTreeNodes, renderTreeSvg } from '../src/treeSvgRenderer.js'

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' })
global.window = dom.window
global.document = dom.window.document
global.DOMParser = dom.window.DOMParser
global.HTMLElement = dom.window.HTMLElement
global.SVGElement = dom.window.SVGElement

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const svgChecks = []

const svgBackends = {
  er: {
    render: renderERSvg,
    nodeSelector: '.er-svg-entity',
    edgeSelector: '.er-svg-edge',
    expectedNodes: countEREntities,
    expectedEdges: countERRelationships,
  },
  flow: {
    render: renderFlowSvg,
    nodeSelector: '.flow-svg-node',
    edgeSelector: '.flow-svg-edge',
    expectedNodes: section => (section.nodes || []).length,
    expectedEdges: section => (section.edges || []).length,
  },
  quadrant: {
    render: renderQuadrantSvg,
    nodeSelector: '.quadrant-svg-item',
    edgeSelector: '.quadrant-svg-edge',
    expectedNodes: countQuadrantItems,
    expectedEdges: () => 0,
  },
  sequence: {
    render: renderSequenceSvg,
    nodeSelector: '.sequence-svg-actor',
    edgeSelector: '.sequence-svg-message',
    expectedNodes: countSequenceActors,
    expectedEdges: countSequenceMessages,
  },
  state: {
    render: renderStateSvg,
    nodeSelector: '.state-svg-state',
    edgeSelector: '.state-svg-edge',
    expectedNodes: countStateNodes,
    expectedEdges: countStateEdges,
  },
  tree: {
    render: renderTreeSvg,
    nodeSelector: '.tree-svg-node',
    edgeSelector: '.tree-svg-edge',
    expectedNodes: section => countTreeNodes(section.root),
    expectedEdges: section => countTreeEdges(section.root),
  },
}

const manifest = readJson(resolve(repoRoot, 'internal/schema/manifest.json'))
collectManifestExamples(manifest)
collectReports(resolve(repoRoot, 'recipes'), 'recipe')
collectReports(resolve(repoRoot, 'template/fixtures'), 'fixture')

const failures = []
for (const check of svgChecks) {
  try {
    const backend = svgBackends[check.section.kind]
    const svg = backend.render(check.section)
    if (svg.tagName.toLowerCase() !== 'svg') throw new Error('renderer did not return svg')
    if (svg.querySelectorAll(backend.nodeSelector).length !== backend.expectedNodes(check.section)) {
      throw new Error('rendered node count does not match input node count')
    }
    if (backend.edgeSelector && svg.querySelectorAll(backend.edgeSelector).length !== backend.expectedEdges(check.section)) {
      throw new Error('rendered edge count does not match input edge count')
    }
  } catch (e) {
    failures.push({ ...check, error: e?.message || String(e), code: JSON.stringify(check.section, null, 2) })
  }
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`diagram parse failed: ${failure.source}`)
    console.error(failure.error)
    console.error(failure.code)
  }
  process.exit(1)
}

console.log(`diagram-check ok (${svgChecks.length} svg sources)`)

function collectManifestExamples(m) {
  for (const [name, surface] of Object.entries(m.surfaces || {})) {
    for (const [i, example] of (surface.examples || []).entries()) {
      collectSection({ type: name, ...example }, `manifest.surfaces.${name}.examples[${i}]`)
    }
  }
  for (const [name, def] of Object.entries(m.defs || {})) {
    for (const [i, example] of (def.examples || []).entries()) {
      collectSection(example, `manifest.defs.${name}.examples[${i}]`)
    }
  }
}

function collectReports(dir, kind) {
  for (const file of readdirSync(dir).filter(name => name.endsWith('.json')).sort()) {
    const doc = readJson(resolve(dir, file))
    for (const [i, section] of (doc.sections || []).entries()) {
      collectSection(section, `${kind}.${file}.sections[${i}]`)
    }
  }
}

function collectSection(section, source) {
  if (!section || typeof section !== 'object') return
  if (section.type === 'diagram') {
    if (svgBackends[section.kind]) {
      svgChecks.push({ source, section })
    } else {
      failures.push({ source, error: `unknown diagram kind "${section.kind}"`, code: JSON.stringify(section, null, 2) })
    }
  }
  if (Array.isArray(section.sections)) {
    section.sections.forEach((child, i) => collectSection(child, `${source}.sections[${i}]`))
  }
  if (Array.isArray(section.items)) {
    section.items.forEach((item, i) => {
      if (Array.isArray(item?.sections)) {
        item.sections.forEach((child, j) => collectSection(child, `${source}.items[${i}].sections[${j}]`))
      }
    })
  }
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}
