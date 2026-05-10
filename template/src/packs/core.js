import '../styles/main.scss'
import { CATALOG } from '../generated/catalog.js'
import { createDiagramPalette } from '../diagramPalette.js'
import { createEncodings } from '../encodings.js'
import { createLayouts } from '../layouts.js'
import { createSectionRenderer } from '../sectionRenderer.js'

const root = document.getElementById('root')
const sourceDataNode = document.getElementById('report-data')
const data = readReportData(document.getElementById('report-render-data'))
const reactive = globalThis.LRH_REACTIVE || staticReactive()
const diagramRenderers = globalThis.LRH_DIAGRAMS || {}

document.title = data.title || 'Report'
installSourceJSONControl(document.getElementById('source-json-control'), sourceDataNode)
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

function installSourceJSONControl(control, dataNode) {
  if (!control || !dataNode) return
  const pre = control.querySelector('pre')
  if (!pre) return
  let rendered = false
  control.addEventListener('toggle', () => {
    if (!control.open || rendered) return
    pre.textContent = prettySourceJSON(dataNode.textContent || '')
    rendered = true
  })
}

function prettySourceJSON(source) {
  try {
    return JSON.stringify(JSON.parse(source), null, 2)
  } catch {
    return source
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
