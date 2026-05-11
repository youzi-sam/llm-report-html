import { graphlib, layout } from '@dagrejs/dagre'
import {
  measureEdgeLabel,
  measureLine,
  nextSvgID,
} from './diagramSvgPrimitives.js'
import {
  arrowMarkerScene,
  polylineEdgeScene,
  renderSvgScene,
  sceneEl,
  sceneText,
  svgScene,
} from './diagramSvgScene.js'

const DEFAULT_PALETTE = {
  line: '#777775',
}

export function renderERSvg(s, palette = DEFAULT_PALETTE) {
  return renderSvgScene(erToScene(layoutER(s), palette))
}

export function layoutER(s) {
  const entities = s.entities || []
  if (entities.length === 0) throw new Error('ER diagram requires entities')

  const entityByID = new Map(entities.map(entity => [entity.id, entity]))
  for (const relationship of s.relationships || []) {
    if (!entityByID.has(relationship.from) || !entityByID.has(relationship.to)) {
      throw new Error(`ER relationship references undeclared entity: ${relationship.from} -> ${relationship.to}`)
    }
  }

  const metrics = new Map(entities.map(entity => [entity.id, measureEntity(entity)]))
  const graph = new graphlib.Graph({ multigraph: true })
  graph.setGraph({
    rankdir: 'LR',
    nodesep: 48,
    ranksep: 86,
    marginx: 18,
    marginy: 18,
  })
  graph.setDefaultEdgeLabel(() => ({}))

  for (const entity of entities) {
    const size = metrics.get(entity.id)
    graph.setNode(entity.id, { width: size.width, height: size.height })
  }
  ;(s.relationships || []).forEach((relationship, index) => {
    const label = relationshipLabel(relationship)
    graph.setEdge(relationship.from, relationship.to, {
      ...relationship,
      label,
      ...measureEdgeLabel(label),
    }, String(index))
  })

  layout(graph)

  const graphSize = graph.graph()
  const width = Math.ceil(graphSize.width || 0)
  const height = Math.ceil(graphSize.height || 0)
  const markerID = nextSvgID('er-svg-arrow')
  return {
    width,
    height,
    markerID,
    edges: graph.edges().map(edgeRef => graph.edge(edgeRef)),
    entities: entities.map(entity => ({
      entity,
      point: graph.node(entity.id),
      size: metrics.get(entity.id),
    })),
  }
}

export function erToScene(layout, palette = DEFAULT_PALETTE) {
  return svgScene({
    class: 'er-svg',
    width: layout.width,
    height: layout.height,
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    style: 'max-width: 100%;',
    role: 'graphics-document document',
    'aria-roledescription': 'entity relationship diagram',
  }, [
    arrowMarkerScene(layout.markerID, palette),
    sceneEl('g', { class: 'er-svg-edges' }, layout.edges.map(edge => erEdgeScene(edge, layout.markerID, palette))),
    sceneEl('g', { class: 'er-svg-entities' }, layout.entities.map(entity => entityScene(entity))),
  ])
}

export function countEREntities(s) {
  return (s.entities || []).length
}

export function countERRelationships(s) {
  return (s.relationships || []).length
}

function entityScene({ entity, point, size }) {
  const x = -size.width / 2
  const y = -size.height / 2
  const bottom = y + size.height
  const typeRight = x + size.columns.type
  const nameRight = typeRight + size.columns.name
  const children = [
    sceneEl('path', {
      class: 'er-svg-entity-frame',
      d: rectPath(x, y, size.width, size.height),
    }),
    sceneEl('path', {
      class: 'er-svg-entity-header',
      d: rectPath(x, y, size.width, size.headerHeight),
    }),
    sceneEl('line', {
      class: 'er-svg-row-divider',
      x1: x,
      y1: y + size.headerHeight,
      x2: x + size.width,
      y2: y + size.headerHeight,
    }),
    sceneEl('line', {
      class: 'er-svg-column-divider',
      x1: typeRight,
      y1: y + size.headerHeight,
      x2: typeRight,
      y2: bottom,
    }),
    sceneEl('line', {
      class: 'er-svg-column-divider',
      x1: nameRight,
      y1: y + size.headerHeight,
      x2: nameRight,
      y2: bottom,
    }),
    sceneText('text', {
      class: 'er-svg-entity-title',
      x: 0,
      y: y + size.headerHeight / 2,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    }, entity.label || entity.id),
  ]

  ;(entity.attributes || []).forEach((attribute, index) => {
    const rowY = y + size.headerHeight + index * size.rowHeight
    if (index > 0) {
      children.push(sceneEl('line', {
        class: 'er-svg-row-divider',
        x1: x,
        y1: rowY,
        x2: x + size.width,
        y2: rowY,
      }))
    }
    children.push(sceneText('text', {
      class: 'er-svg-attribute er-svg-attribute-type',
      x: x + size.columns.type / 2,
      y: rowY + size.rowHeight / 2,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
    }, attribute.type || 'string'))
    children.push(sceneText('text', {
      class: 'er-svg-attribute er-svg-attribute-name',
      x: typeRight + 14,
      y: rowY + size.rowHeight / 2,
      'dominant-baseline': 'middle',
    }, attribute.name || ''))
    if (attribute.key) {
      children.push(sceneText('text', {
        class: 'er-svg-attribute er-svg-attribute-key',
        x: nameRight + size.columns.key / 2,
        y: rowY + size.rowHeight / 2,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
      }, attribute.key))
    }
  })

  return sceneEl('g', {
    class: 'node er-svg-entity',
    transform: `translate(${point.x}, ${point.y})`,
  }, children)
}

function erEdgeScene(edge, markerID, palette) {
  return polylineEdgeScene(edge, {
    markerID,
    palette,
    groupClass: `edgePath er-svg-edge ${edge.style || 'solid'}`,
    pathClass: `path er-svg-link ${edge.style || 'solid'}`,
    labelGroupClass: 'edgeLabel er-svg-edge-label',
    labelTextClass: 'er-svg-edge-text',
  })
}

function measureEntity(entity) {
  const title = entity.label || entity.id
  const rows = entity.attributes || []
  const columns = measureAttributeColumns(rows)
  const tableWidth = columns.type + columns.name + columns.key
  const titleWidth = measureLine(title) + 56
  const headerHeight = 38
  const rowHeight = 34
  const width = Math.max(180, tableWidth, titleWidth)
  if (width > tableWidth) columns.name += width - tableWidth
  return {
    width,
    height: headerHeight + Math.max(1, rows.length) * rowHeight,
    headerHeight,
    rowHeight,
    columns,
  }
}

function measureAttributeColumns(rows) {
  const maxType = Math.max(...rows.map(row => measureLine(row.type || 'string')), measureLine('string'))
  const maxName = Math.max(...rows.map(row => measureLine(row.name || '')), measureLine('field'))
  const maxKey = Math.max(...rows.map(row => measureLine(row.key || '')), measureLine('PK'))
  return {
    type: Math.max(74, maxType + 32),
    name: Math.max(112, maxName + 44),
    key: Math.max(48, maxKey + 28),
  }
}

function rectPath(x, y, width, height) {
  const right = x + width
  const bottom = y + height
  return `M ${x} ${y} H ${right} V ${bottom} H ${x} Z`
}

function relationshipLabel(relationship) {
  return `${cardinalityLabel(relationship.fromCardinality || 'one')} ${relationship.label} ${cardinalityLabel(relationship.toCardinality || 'zero_or_more')}`
}

function cardinalityLabel(value) {
  return {
    zero_or_one: '0..1',
    one: '1',
    zero_or_more: '0..*',
    one_or_more: '1..*',
  }[value] || value
}
