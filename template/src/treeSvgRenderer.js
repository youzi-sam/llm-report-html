import { graphlib, layout } from '@dagrejs/dagre'
import {
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

export function renderTreeSvg(s, palette = DEFAULT_PALETTE) {
  return renderSvgScene(treeToScene(layoutTree(s), palette))
}

export function layoutTree(s) {
  if (!s.root) throw new Error('tree diagram requires root')

  const { nodes, edges } = flattenTree(s.root)
  const metrics = new Map(nodes.map(node => [node.id, measureTreeNode(node)]))

  const graph = new graphlib.Graph()
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 36,
    ranksep: 78,
    marginx: 16,
    marginy: 16,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const node of nodes) {
    const size = metrics.get(node.id)
    graph.setNode(node.id, { width: size.width, height: size.height })
  }
  for (const edge of edges) graph.setEdge(edge.from, edge.to, edge)

  layout(graph)

  const graphSize = graph.graph()
  const width = Math.ceil(graphSize.width || 0)
  const height = Math.ceil(graphSize.height || 0)
  const markerID = nextSvgID('tree-svg-arrow')
  return {
    width,
    height,
    markerID,
    nodes: nodes.map(node => ({
      node,
      point: graph.node(node.id),
      size: metrics.get(node.id),
    })),
    edges: graph.edges().map(edgeRef => graph.edge(edgeRef)),
  }
}

export function treeToScene(layout, palette = DEFAULT_PALETTE) {
  return svgScene({
    class: 'tree-svg',
    width: layout.width,
    height: layout.height,
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    style: 'max-width: 100%;',
    role: 'graphics-document document',
    'aria-roledescription': 'tree',
  }, [
    arrowMarkerScene(layout.markerID, palette),
    sceneEl('g', { class: 'tree-svg-edges' }, layout.edges.map(edge => treeEdgeScene(edge, layout.markerID, palette))),
    sceneEl('g', { class: 'tree-svg-nodes' }, layout.nodes.map(node => treeNodeScene(node))),
  ])
}

export function countTreeNodes(root) {
  if (!root) return 0
  return 1 + (root.children || []).reduce((sum, child) => sum + countTreeNodes(child), 0)
}

export function countTreeEdges(root) {
  if (!root) return 0
  return (root.children || []).reduce((sum, child) => sum + 1 + countTreeEdges(child), 0)
}

function flattenTree(root) {
  const nodes = []
  const edges = []
  let seq = 0

  function visit(raw, depth, parentID = '') {
    const children = Array.isArray(raw?.children) ? raw.children : []
    const node = {
      id: `T${seq++}`,
      label: String(raw?.label || ''),
      depth,
      hasChildren: children.length > 0,
    }
    nodes.push(node)
    if (parentID) edges.push({ from: parentID, to: node.id })
    for (const child of children) visit(child, depth + 1, node.id)
  }

  visit(root, 0)
  return { nodes, edges }
}

function treeNodeScene({ node, point, size }) {
  const role = node.depth === 0 ? 'root' : node.hasChildren ? 'branch' : 'leaf'
  return sceneEl('g', {
    class: `node tree-svg-node ${role} depth-${node.depth}`,
    transform: `translate(${point.x}, ${point.y})`,
  }, [
    nodeShapeScene(size.shape, size),
    centeredTextScene(size.lines, { className: 'tree-svg-label', textColor: size.textColor }),
  ])
}

function treeEdgeScene(edge, markerID, palette) {
  return polylineEdgeScene(edge, {
    markerID,
    palette,
    groupClass: 'edgePath tree-svg-edge solid',
    pathClass: 'path tree-svg-link solid',
    labelGroupClass: 'edgeLabel tree-svg-edge-label',
    labelTextClass: 'tree-svg-edge-text',
  })
}

function measureTreeNode(node) {
  const shape = node.depth === 0 || node.hasChildren ? 'round' : 'rect'
  const size = measureNodeLabel(node.label, {
    shape,
    maxWeight: node.depth === 0 ? 20 : 16,
    paddingX: node.depth === 0 ? 46 : 36,
    paddingY: 26,
    minWidth: node.depth === 0 ? 132 : 108,
    minHeight: 50,
  })
  return { ...size, shape }
}
