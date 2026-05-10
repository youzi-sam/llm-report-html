const SVG_NS = 'http://www.w3.org/2000/svg'
let nextID = 0

const DEFAULT_PALETTE = {
  line: '#777775',
}

export function nextSvgID(prefix) {
  return `${prefix}-${nextID++}`
}

export function svgEl(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) element.setAttribute(key, String(value))
  }
  return element
}

export function renderArrowMarker(markerID, palette = DEFAULT_PALETTE) {
  const defs = svgEl('defs')
  const marker = svgEl('marker', {
    id: markerID,
    class: 'marker',
    viewBox: '0 0 10 10',
    refX: '9',
    refY: '5',
    markerWidth: '8',
    markerHeight: '8',
    orient: 'auto-start-reverse',
  })
  marker.appendChild(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: palette.line || DEFAULT_PALETTE.line }))
  defs.appendChild(marker)
  return defs
}

export function renderNodeShape(shape, size) {
  const x = -size.width / 2
  const y = -size.height / 2
  if (shape === 'diamond') {
    return svgEl('polygon', {
      points: `0,${y} ${size.width / 2},0 0,${size.height / 2} ${x},0`,
    })
  }
  if (shape === 'circle') {
    const r = Math.max(size.width, size.height) / 2
    return svgEl('circle', { cx: 0, cy: 0, r })
  }
  const radius = shape === 'round' ? 8 : shape === 'stadium' ? size.height / 2 : 4
  return svgEl('rect', {
    x,
    y,
    width: size.width,
    height: size.height,
    rx: radius,
    ry: radius,
  })
}

export function renderCenteredText(lines, opts = {}) {
  const {
    className = 'diagram-svg-label',
    lineHeight = 18,
    textColor = null,
  } = opts
  const textNode = svgEl('text', {
    class: className,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
  })
  const startY = -((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, index) => {
    const tspan = svgEl('tspan', { x: 0, y: startY + index * lineHeight })
    tspan.textContent = line
    textNode.appendChild(tspan)
  })
  if (textColor) textNode.setAttribute('style', `fill: ${textColor};`)
  return textNode
}

export function renderPolylineEdge(edge, opts = {}) {
  const {
    markerID,
    palette = DEFAULT_PALETTE,
    groupClass = 'edgePath diagram-svg-edge',
    pathClass = 'path diagram-svg-link',
    labelGroupClass = 'edgeLabel diagram-svg-edge-label',
    labelTextClass = 'diagram-svg-edge-text',
    labelBackgroundClass = 'labelBackground',
  } = opts
  const group = svgEl('g', { class: groupClass })
  const pathAttrs = {
    class: pathClass,
    d: pathFromPoints(edge.points || []),
    fill: 'none',
    stroke: palette.line || DEFAULT_PALETTE.line,
  }
  if (markerID) pathAttrs['marker-end'] = `url(#${markerID})`
  group.appendChild(svgEl('path', pathAttrs))
  if (edge.label) {
    group.appendChild(renderEdgeLabel(edge, {
      groupClass: labelGroupClass,
      textClass: labelTextClass,
      backgroundClass: labelBackgroundClass,
    }))
  }
  return group
}

export function renderEdgeLabel(edge, opts = {}) {
  const {
    groupClass = 'edgeLabel diagram-svg-edge-label',
    textClass = 'diagram-svg-edge-text',
    backgroundClass = 'labelBackground',
  } = opts
  const group = svgEl('g', {
    class: groupClass,
    transform: `translate(${edge.x || 0}, ${edge.y || 0})`,
  })
  const width = Math.max(24, Number(edge.width) || 0)
  const height = Math.max(18, Number(edge.height) || 0)
  group.appendChild(svgEl('rect', {
    class: backgroundClass,
    x: -width / 2,
    y: -height / 2,
    width,
    height,
    rx: 4,
    ry: 4,
  }))
  const label = svgEl('text', {
    class: textClass,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
  })
  label.textContent = String(edge.label)
  group.appendChild(label)
  return group
}

export function pathFromPoints(points) {
  if (points.length === 0) return ''
  const [first, ...rest] = points
  return [`M ${first.x} ${first.y}`, ...rest.map(point => `L ${point.x} ${point.y}`)].join(' ')
}

export function measureNodeLabel(label, opts = {}) {
  const {
    shape = 'rect',
    maxWeight = 18,
    charWidth = 7.4,
    lineHeight = 18,
    paddingX = 48,
    paddingY = 30,
    minWidth = 112,
    minHeight = 54,
  } = opts
  const lines = wrapLabel(String(label || ''), maxWeight)
  const textWidth = Math.max(...lines.map(line => measureLine(line, charWidth)), 1)
  const textHeight = lines.length * lineHeight
  let width = Math.max(minWidth, textWidth + paddingX)
  let height = Math.max(minHeight, textHeight + paddingY)
  if (shape === 'diamond') {
    width = Math.max(width * 1.35, height * 1.9)
    height = Math.max(height * 1.45, width * 0.52)
  } else if (shape === 'circle') {
    const diameter = Math.max(width, height)
    width = diameter
    height = diameter
  }
  return { width, height, lines, textColor: null }
}

export function measureEdgeLabel(label, charWidth = 7.4) {
  return {
    width: measureLine(String(label), charWidth) + 18,
    height: 22,
  }
}

export function wrapLabel(label, maxWeight = 18) {
  const result = []
  for (const rawLine of String(label || '').split(/\r?\n/)) {
    const words = rawLine.split(/(\s+)/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const candidate = line + word
      if (line && visualWeight(candidate) > maxWeight) {
        result.push(line.trimEnd())
        line = word.trimStart()
      } else {
        line = candidate
      }
    }
    if (line) result.push(line.trim())
  }
  return result.length ? result : ['']
}

export function measureLine(line, charWidth = 7.4) {
  return Math.ceil(visualWeight(line) * charWidth)
}

export function visualWeight(line) {
  let width = 0
  for (const char of [...String(line || '')]) {
    if (/\s/.test(char)) width += 0.45
    else if (/[\u4e00-\u9fff\uff00-\uffef]/.test(char)) width += 1.75
    else width += 1
  }
  return width
}
