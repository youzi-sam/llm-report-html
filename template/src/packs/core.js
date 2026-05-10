import '../styles/main.scss'
import { CATALOG } from '../generated/catalog.js'
import { createDiagramPalette } from '../diagramPalette.js'
import { createEncodings } from '../encodings.js'
import { createLayouts } from '../layouts.js'
import { createSectionRenderer } from '../sectionRenderer.js'

const root = document.getElementById('root')
const data = readReportData(document.getElementById('report-render-data'))
const reactive = globalThis.LRH_REACTIVE || staticReactive()
const diagramRenderers = globalThis.LRH_DIAGRAMS || {}

document.title = data.title || 'Report'
reactive.initReactive(data)

const encodings = createEncodings({
  diagramPalette: createDiagramPalette(),
  diagramRenderers,
  reactive,
})

const { renderDocument } = createSectionRenderer({
  catalog: CATALOG,
  encodings,
  createLayouts,
  reactive,
})

renderDocument(data, root)

function readReportData(node) {
  try {
    return JSON.parse(node.textContent)
  } catch {
    return {
      title: 'Empty Report',
      sections: [{
        type: 'callout',
        kind: 'info',
        text: 'No data filled. Use `llm-report-html render data.json -o out.html`.',
        __html: '<p>No data filled. Use <code>llm-report-html render data.json -o out.html</code>.</p>\n',
      }],
    }
  }
}

function staticReactive() {
  const inactive = () => { throw new Error('reactive runtime not loaded') }
  return {
    initReactive() {},
    getCell: inactive,
    getCellSpec: inactive,
    setCell: inactive,
    subscribe: inactive,
    isBinding(value) {
      return !!(value && typeof value === 'object' && typeof value.$bind === 'string')
    },
  }
}
