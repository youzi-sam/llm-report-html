import { graphlib, layout } from '@dagrejs/dagre'
import {
  measureEdgeLabel,
  measureNodeLabel,
  nextSvgID,
} from './diagramSvgPrimitives.js'
import {
  arrowMarkerScene,
  centeredTextScene,
  nodeShapeScene,
  polylineEdgeScene,
  renderSvgScene,
  sceneEl,
  svgScene,
} from './diagramSvgScene.js'

const DEFAULT_PALETTE = {
  line: '#777775',
}

export function renderStateSvg(s, palette = DEFAULT_PALETTE) {
  return renderSvgScene(stateToScene(layoutState(s), palette))
}

export function layoutState(s) {
  const states = s.states || []
  if (states.length === 0) throw new Error('state diagram requires states')

  const stateByID = new Map(states.map(state => [state.id, state]))
  const finalIDs = s.final || []
  if (s.initial && !stateByID.has(s.initial)) throw new Error(`state initial references undeclared state: ${s.initial}`)
  for (const id of finalIDs) {
    if (!stateByID.has(id)) throw new Error(`state final references undeclared state: ${id}`)
  }
  for (const transition of s.transitions || []) {
    if (!stateByID.has(transition.from) || !stateByID.has(transition.to)) {
      throw new Error(`state transition references undeclared state: ${transition.from} -> ${transition.to}`)
    }
  }

  const graph = new graphlib.Graph({ multigraph: true })
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 46,
    ranksep: 74,
    marginx: 18,
    marginy: 18,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  const metrics = new Map()
  for (const state of states) {
    const size = measureNodeLabel(state.label || state.id, {
      shape: 'round',
      maxWeight: 16,
      paddingX: 38,
      paddingY: 26,
      minWidth: 112,
      minHeight: 50,
    })
    metrics.set(state.id, size)
    graph.setNode(state.id, { width: size.width, height: size.height })
  }

  if (s.initial) graph.setNode('__initial', { width: 24, height: 24 })
  finalIDs.forEach(id => graph.setNode(finalNodeID(id), { width: 28, height: 28 }))

  let edgeSeq = 0
  if (s.initial) graph.setEdge('__initial', s.initial, edgeData({}), String(edgeSeq++))
  ;(s.transitions || []).forEach(transition => {
    graph.setEdge(transition.from, transition.to, edgeData(transition), String(edgeSeq++))
  })
  finalIDs.forEach(id => graph.setEdge(id, finalNodeID(id), edgeData({}), String(edgeSeq++)))

  layout(graph)

  const graphSize = graph.graph()
  const width = Math.ceil(graphSize.width || 0)
  const height = Math.ceil(graphSize.height || 0)
  const markerID = nextSvgID('state-svg-arrow')
  return {
    width,
    height,
    markerID,
    edges: graph.edges().map(edgeRef => graph.edge(edgeRef)),
    initial: s.initial ? graph.node('__initial') : null,
    states: states.map(state => ({
      state,
      point: graph.node(state.id),
      size: metrics.get(state.id),
    })),
    finals: finalIDs.map(id => graph.node(finalNodeID(id))),
  }
}

export function stateToScene(layout, palette = DEFAULT_PALETTE) {
  return svgScene({
    class: 'state-svg',
    width: layout.width,
    height: layout.height,
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    style: 'max-width: 100%;',
    role: 'graphics-document document',
    'aria-roledescription': 'state diagram',
  }, [
    arrowMarkerScene(layout.markerID, palette),
    sceneEl('g', { class: 'state-svg-edges' }, layout.edges.map(edge => stateEdgeScene(edge, layout.markerID, palette))),
    sceneEl('g', { class: 'state-svg-nodes' }, [
      layout.initial ? initialNodeScene(layout.initial) : null,
      ...layout.states.map(state => stateNodeScene(state)),
      ...layout.finals.map(point => finalNodeScene(point)),
    ].filter(Boolean)),
  ])
}

export function countStateNodes(s) {
  return (s.states || []).length
}

export function countStateEdges(s) {
  return (s.transitions || []).length + (s.initial ? 1 : 0) + (s.final || []).length
}

function edgeData(edge) {
  const label = String(edge.label || '')
  const labelSize = label ? measureEdgeLabel(label) : { width: 0, height: 0 }
  return { ...edge, ...labelSize }
}

function stateNodeScene({ state, point, size }) {
  return sceneEl('g', {
    class: 'node state-svg-node state-svg-state',
    transform: `translate(${point.x}, ${point.y})`,
  }, [
    nodeShapeScene('round', size),
    centeredTextScene(size.lines, { className: 'state-svg-label' }),
  ])
}

function initialNodeScene(point) {
  return sceneEl('g', {
    class: 'node state-svg-node state-svg-pseudo initial',
    transform: `translate(${point.x}, ${point.y})`,
  }, [
    sceneEl('circle', { cx: 0, cy: 0, r: 8 }),
  ])
}

function finalNodeScene(point) {
  return sceneEl('g', {
    class: 'node state-svg-node state-svg-pseudo final',
    transform: `translate(${point.x}, ${point.y})`,
  }, [
    sceneEl('circle', { class: 'state-svg-final-outer', cx: 0, cy: 0, r: 11 }),
    sceneEl('circle', { class: 'state-svg-final-inner', cx: 0, cy: 0, r: 6 }),
  ])
}

function stateEdgeScene(edge, markerID, palette) {
  return polylineEdgeScene(edge, {
    markerID,
    palette,
    groupClass: 'edgePath state-svg-edge solid',
    pathClass: 'path state-svg-link solid',
    labelGroupClass: 'edgeLabel state-svg-edge-label',
    labelTextClass: 'state-svg-edge-text',
  })
}

function finalNodeID(id) {
  return `__final_${id}`
}
