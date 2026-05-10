import { renderERSvg } from '../erSvgRenderer.js'
import { renderFlowSvg } from '../flowSvgRenderer.js'
import { renderStateSvg } from '../stateSvgRenderer.js'
import { renderTreeSvg } from '../treeSvgRenderer.js'

globalThis.LRH_DIAGRAMS = globalThis.LRH_DIAGRAMS || {}
globalThis.LRH_DIAGRAMS.er = renderERSvg
globalThis.LRH_DIAGRAMS.flow = renderFlowSvg
globalThis.LRH_DIAGRAMS.state = renderStateSvg
globalThis.LRH_DIAGRAMS.tree = renderTreeSvg
