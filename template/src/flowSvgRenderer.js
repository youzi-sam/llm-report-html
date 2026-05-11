import { graphlib, layout } from '@dagrejs/dagre'
import {
  anchorEdgeToNodeShapes,
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

export function renderFlowSvg(s, palette = DEFAULT_PALETTE) {
  return renderSvgScene(flowToScene(layoutFlow(s), palette))
}

export function layoutFlow(s) {
  const nodes = s.nodes || []
  const edges = s.edges || []
  const nodeByID = new Map(nodes.map(node => [node.id, node]))

  for (const edge of edges) {
    if (!nodeByID.has(edge.from) || !nodeByID.has(edge.to)) {
      throw new Error(`flow edge references undeclared node: ${edge.from} -> ${edge.to}`)
    }
  }

  const dir = s.direction || 'LR'
  const metrics = new Map(nodes.map(node => [node.id, measureNode(node)]))
  const classes = deriveNodeClasses(nodes, edges)

  const graph = new graphlib.Graph({ multigraph: true })
  graph.setGraph({
    rankdir: dir,
    nodesep: 56,
    ranksep: 72,
    marginx: 16,
    marginy: 16,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    const size = metrics.get(node.id)
    graph.setNode(node.id, { width: size.width, height: size.height })
  }
  edges.forEach((edge, index) => {
    const label = String(edge.label || '')
    const labelSize = label ? measureEdgeLabel(label) : { width: 0, height: 0 }
    graph.setEdge(edge.from, edge.to, { ...edge, ...labelSize }, String(index))
  })

  layout(graph)

  const graphSize = graph.graph()
  const width = Math.ceil(graphSize.width || 0)
  const height = Math.ceil(graphSize.height || 0)
  const markerID = nextSvgID('flow-svg-arrow')
  const positionedNodes = new Map(nodes.map(node => {
    const point = graph.node(node.id)
    const size = metrics.get(node.id)
    return [node.id, {
      id: node.id,
      shape: node.shape || 'rect',
      x: point.x,
      y: point.y,
      width: size.width,
      height: size.height,
    }]
  }))
  return {
    width,
    height,
    markerID,
    nodes: nodes.map(node => ({
      node,
      point: graph.node(node.id),
      size: metrics.get(node.id),
      role: classes.get(node.id),
    })),
    edges: graph.edges().map(edgeRef => anchorEdgeToNodeShapes(graph.edge(edgeRef), positionedNodes)),
  }
}

export function flowToScene(layout, palette = DEFAULT_PALETTE) {
  return svgScene({
    class: 'flow-svg',
    width: layout.width,
    height: layout.height,
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    style: 'max-width: 100%;',
    role: 'graphics-document document',
    'aria-roledescription': 'flowchart',
  }, [
    arrowMarkerScene(layout.markerID, palette),
    sceneEl('g', { class: 'flow-svg-edges' }, layout.edges.map(edge => flowEdgeScene(edge, layout.markerID, palette))),
    sceneEl('g', { class: 'flow-svg-nodes' }, layout.nodes.map(node => flowNodeScene(node))),
  ])
}

function flowNodeScene({ node, point, size, role }) {
  return sceneEl('g', {
    class: `node flow-svg-node ${role}`,
    'data-node-id': node.id,
    'data-node-shape': node.shape || 'rect',
    transform: `translate(${point.x}, ${point.y})`,
  }, [
    nodeShapeScene(node.shape || 'rect', size),
    centeredTextScene(size.lines, { className: 'flow-svg-label', textColor: size.textColor }),
  ])
}

function flowEdgeScene(edge, markerID, palette) {
  return polylineEdgeScene(edge, {
    markerID,
    palette,
    groupClass: `edgePath flow-svg-edge ${edge.style || 'solid'}`,
    pathClass: `path flow-svg-link ${edge.style || 'solid'}`,
    labelGroupClass: 'edgeLabel flow-svg-edge-label',
    labelTextClass: 'flow-svg-edge-text',
  })
}

function deriveNodeClasses(nodes, edges) {
  const incoming = new Map(nodes.map(node => [node.id, 0]))
  const outgoing = new Map(nodes.map(node => [node.id, 0]))
  for (const edge of edges) {
    incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1)
    outgoing.set(edge.from, (outgoing.get(edge.from) || 0) + 1)
  }
  return new Map(nodes.map(node => {
    if ((incoming.get(node.id) || 0) === 0) return [node.id, 'start']
    if ((outgoing.get(node.id) || 0) === 0) return [node.id, 'terminal']
    if (node.shape === 'diamond') return [node.id, 'decision']
    if (node.shape === 'stadium' || node.shape === 'circle') return [node.id, 'milestone']
    return [node.id, 'step']
  }))
}

function measureNode(node) {
  return measureNodeLabel(String(node.label || ''), { shape: node.shape || 'rect' })
}
