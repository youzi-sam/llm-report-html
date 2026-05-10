import { measureLine, wrapLabel } from './diagramSvgPrimitives.js'
import { renderSvgScene, sceneEl, sceneText, sceneTextNode, svgScene } from './diagramSvgScene.js'

const WIDTH = 760
const HEIGHT = 500
const PAD = {
  left: 78,
  right: 42,
  top: 56,
  bottom: 74,
}

export function renderQuadrantSvg(s) {
  return renderSvgScene(quadrantToScene(layoutQuadrant(s)))
}

export function layoutQuadrant(s) {
  const items = s.items || []
  const plot = {
    x: PAD.left,
    y: PAD.top,
    width: WIDTH - PAD.left - PAD.right,
    height: HEIGHT - PAD.top - PAD.bottom,
  }
  const midX = plot.x + plot.width / 2
  const midY = plot.y + plot.height / 2
  return {
    width: WIDTH,
    height: HEIGHT,
    title: s.title || '',
    axes: s.axes || {},
    quadrants: s.quadrants || {},
    plot,
    midX,
    midY,
    items: layoutItems(items, plot),
  }
}

export function quadrantToScene(layout) {
  const children = []
  if (layout.title) children.push(textAt(layout.title, WIDTH / 2, 24, 'quadrant-svg-title'))
  children.push(sceneEl('g', { class: 'quadrant-svg-regions' }, [
    region('q2', layout.plot.x, layout.plot.y, layout.plot.width / 2, layout.plot.height / 2),
    region('q1', layout.midX, layout.plot.y, layout.plot.width / 2, layout.plot.height / 2),
    region('q3', layout.plot.x, layout.midY, layout.plot.width / 2, layout.plot.height / 2),
    region('q4', layout.midX, layout.midY, layout.plot.width / 2, layout.plot.height / 2),
  ]))
  children.push(sceneEl('g', { class: 'quadrant-svg-grid' }, [
    sceneEl('rect', {
      class: 'quadrant-svg-frame',
      x: layout.plot.x,
      y: layout.plot.y,
      width: layout.plot.width,
      height: layout.plot.height,
    }),
    sceneEl('line', { x1: layout.midX, y1: layout.plot.y, x2: layout.midX, y2: layout.plot.y + layout.plot.height }),
    sceneEl('line', { x1: layout.plot.x, y1: layout.midY, x2: layout.plot.x + layout.plot.width, y2: layout.midY }),
  ]))
  children.push(quadrantLabelsScene(layout.quadrants, layout.plot))
  children.push(axesScene(layout.axes, layout.plot))
  children.push(sceneEl('g', { class: 'quadrant-svg-item-labels' }, layout.items.map(item => itemScene(item).label)))
  children.push(sceneEl('g', { class: 'quadrant-svg-points' }, layout.items.map(item => itemScene(item).point)))
  return svgScene({
    class: 'quadrant-svg',
    width: layout.width,
    height: layout.height,
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    style: 'max-width: 100%;',
    role: 'graphics-document document',
    'aria-roledescription': 'quadrant chart',
  }, children)
}

export function countQuadrantItems(s) {
  return (s.items || []).length
}

function region(name, x, y, width, height) {
  return sceneEl('rect', {
    class: `quadrant-svg-region ${name}`,
    x,
    y,
    width,
    height,
  })
}

function quadrantLabelsScene(q, plot) {
  const insetX = 18
  const insetY = 24
  const labels = [
    ['q1', q.q1, plot.x + plot.width - insetX, plot.y + insetY, 'end'],
    ['q2', q.q2, plot.x + insetX, plot.y + insetY, 'start'],
    ['q3', q.q3, plot.x + insetX, plot.y + plot.height - insetY, 'start'],
    ['q4', q.q4, plot.x + plot.width - insetX, plot.y + plot.height - insetY, 'end'],
  ]
  return sceneEl('g', { class: 'quadrant-svg-quadrant-labels' }, labels
    .filter(([, label]) => label)
    .map(([name, label, x, y, anchor]) => textAt(label, x, y, `quadrant-svg-quadrant-label ${name}`, { anchor })))
}

function axesScene(axes, plot) {
  const children = []
  const x = axes.x || {}
  const y = axes.y || {}
  if (x.low) children.push(textAt(x.low, plot.x, plot.y + plot.height + 34, 'quadrant-svg-axis-label low', { anchor: 'start' }))
  if (x.high) children.push(textAt(x.high, plot.x + plot.width, plot.y + plot.height + 34, 'quadrant-svg-axis-label high', { anchor: 'end' }))
  if (x.label) children.push(textAt(x.label, plot.x + plot.width / 2, plot.y + plot.height + 58, 'quadrant-svg-axis-label main'))

  if (y.low) children.push(textAt(y.low, plot.x - 16, plot.y + plot.height, 'quadrant-svg-axis-label low', { anchor: 'end' }))
  if (y.high) children.push(textAt(y.high, plot.x - 16, plot.y + 5, 'quadrant-svg-axis-label high', { anchor: 'end' }))
  if (y.label) {
    children.push(textAt(y.label, 22, plot.y + plot.height / 2, 'quadrant-svg-axis-label main', { rotate: -90 }))
  }
  return sceneEl('g', { class: 'quadrant-svg-axis-labels' }, children)
}

function itemScene(item) {
  const { x, y, labelBox, lines } = item
  const point = sceneEl('g', {
    class: 'quadrant-svg-item',
    transform: `translate(${x}, ${y})`,
  }, [
    sceneEl('circle', { class: 'quadrant-svg-point', cx: 0, cy: 0, r: 5.5 }),
  ])

  const labelGroup = sceneEl('g', {
    class: 'quadrant-svg-item-label-group',
    transform: `translate(${labelBox.x}, ${labelBox.y})`,
  }, [
    sceneEl('text', {
    class: 'quadrant-svg-item-label',
    x: labelBox.width / 2,
    y: 13,
    'text-anchor': 'middle',
    }, lines.map((line, lineIndex) => sceneEl('tspan', {
      x: labelBox.width / 2,
      dy: lineIndex === 0 ? 0 : 15,
    }, [sceneTextNode(line)]))),
  ])
  return { label: labelGroup, point }
}

function layoutItems(items, plot) {
  const placed = []
  return (items || []).map(raw => {
    const x = plot.x + clamp01(raw.x) * plot.width
    const y = plot.y + (1 - clamp01(raw.y)) * plot.height
    const lines = wrapLabel(String(raw.label || ''), 14)
    const labelBox = chooseLabelBox({
      x,
      y,
      width: Math.max(...lines.map(line => measureLine(line, 7.2)), 18),
      height: lines.length * 15,
      plot,
      placed,
    })
    placed.push(labelBox)
    return { ...raw, x, y, lines, labelBox }
  })
}

function chooseLabelBox(model) {
  const candidates = labelCandidates(model)
  let best = candidates[0]
  for (const candidate of candidates) {
    if (labelScore(candidate, model) < labelScore(best, model)) best = candidate
  }
  return best
}

function labelCandidates({ x, y, width, height, plot }) {
  const gap = 10
  const paddedWidth = width + 2
  const paddedHeight = height + 2
  const raw = [
    { x: x - paddedWidth / 2, y: y + gap, width: paddedWidth, height: paddedHeight, rank: 0 },
    { x: x - paddedWidth / 2, y: y - gap - paddedHeight, width: paddedWidth, height: paddedHeight, rank: 1 },
    { x: x + gap, y: y - paddedHeight / 2, width: paddedWidth, height: paddedHeight, rank: 2 },
    { x: x - gap - paddedWidth, y: y - paddedHeight / 2, width: paddedWidth, height: paddedHeight, rank: 3 },
    { x: x + gap, y: y + gap, width: paddedWidth, height: paddedHeight, rank: 4 },
    { x: x - gap - paddedWidth, y: y + gap, width: paddedWidth, height: paddedHeight, rank: 5 },
    { x: x + gap, y: y - gap - paddedHeight, width: paddedWidth, height: paddedHeight, rank: 6 },
    { x: x - gap - paddedWidth, y: y - gap - paddedHeight, width: paddedWidth, height: paddedHeight, rank: 7 },
  ]
  return raw.map(candidate => clampLabelBox(candidate, plot))
}

function clampLabelBox(box, plot) {
  const inset = 8
  const minX = plot.x + inset
  const minY = plot.y + inset
  const maxX = plot.x + plot.width - inset - box.width
  const maxY = plot.y + plot.height - inset - box.height
  const x = Math.min(Math.max(box.x, minX), maxX)
  const y = Math.min(Math.max(box.y, minY), maxY)
  return { ...box, x, y, shift: Math.abs(x - box.x) + Math.abs(y - box.y) }
}

function labelScore(box, { x, y, placed }) {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const distance = Math.hypot(cx - x, cy - y)
  const overlap = placed.reduce((sum, other) => sum + overlapArea(box, other), 0)
  return box.rank * 4 + distance + box.shift * 5 + overlap * 0.8
}

function overlapArea(a, b) {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return x * y
}

function textAt(value, x, y, className, opts = {}) {
  const {
    anchor = 'middle',
    rotate = 0,
  } = opts
  const attrs = {
    class: className,
    x,
    y,
    'text-anchor': anchor,
  }
  if (rotate) attrs.transform = `rotate(${rotate} ${x} ${y})`
  return sceneText('text', attrs, String(value))
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0))
}
