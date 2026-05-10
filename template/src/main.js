// HTML renderer bootstrap. Section implementations live in encodings/layouts;
// this file wires the catalog, reactive runtime, and document host.
import './styles/main.scss'
import { CATALOG } from './generated/catalog.js'
import { createDiagramPalette } from './diagramPalette.js'
import { createEncodings } from './encodings.js'
import { createLayouts } from './layouts.js'
import { createSectionRenderer } from './sectionRenderer.js'
import * as reactive from './reactive.js'
import { renderERSvg } from './erSvgRenderer.js'
import { renderFlowSvg } from './flowSvgRenderer.js'
import { renderQuadrantSvg } from './quadrantSvgRenderer.js'
import { renderSequenceSvg } from './sequenceSvgRenderer.js'
import { renderStateSvg } from './stateSvgRenderer.js'
import { renderTreeSvg } from './treeSvgRenderer.js'

const diagramRenderers = {
  er: renderERSvg,
  flow: renderFlowSvg,
  quadrant: renderQuadrantSvg,
  sequence: renderSequenceSvg,
  state: renderStateSvg,
  tree: renderTreeSvg,
}

const root = document.getElementById('root')
const dataNode = document.getElementById('report-data')
const renderDataNode = document.getElementById('report-render-data')
const data = readReportData(renderDataNode)

document.title = data.title || 'Report'
reactive.initReactive(data)

const encodings = createEncodings({ diagramPalette: createDiagramPalette(), diagramRenderers, reactive })
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
      }],
    }
  }
}
