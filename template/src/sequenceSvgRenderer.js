import {
  measureLine,
  nextSvgID,
  wrapLabel,
} from './diagramSvgPrimitives.js'
import {
  arrowMarkerScene,
  renderSvgScene,
  sceneEl,
  sceneText,
  sceneTextNode,
  svgScene,
} from './diagramSvgScene.js'

const DEFAULT_PALETTE = {
  line: '#777775',
}

export function renderSequenceSvg(s, palette = DEFAULT_PALETTE) {
  return renderSvgScene(sequenceToScene(layoutSequence(s), palette))
}

export function layoutSequence(s) {
  const actors = s.actors || []
  if (actors.length === 0) throw new Error('sequence diagram requires actors')

  const actorSet = new Set(actors)
  for (const message of s.messages || []) {
    if (!actorSet.has(message.from) || !actorSet.has(message.to)) {
      throw new Error(`sequence message references undeclared actor: ${message.from} -> ${message.to}`)
    }
  }

  const actorWidths = actors.map(actor => Math.max(104, measureLine(actor, 7.4) + 42))
  const lane = Math.max(150, Math.max(...actorWidths) + 42)
  const left = 72
  const top = 28
  const actorHeight = 42
  const messageTop = 110
  const rowHeight = 54
  const bottom = 42
  const width = left * 2 + Math.max(0, actors.length - 1) * lane
  const height = messageTop + (s.messages || []).length * rowHeight + bottom
  const markerID = nextSvgID('sequence-svg-arrow')
  const xByActor = new Map(actors.map((actor, index) => [actor, left + index * lane]))

  return {
    width,
    height,
    markerID,
    top,
    actorHeight,
    actors: actors.map((actor, index) => ({
      label: actor,
      x: xByActor.get(actor),
      y: top,
      width: actorWidths[index],
      height: actorHeight,
    })),
    lifelines: actors.map(actor => ({
      x: xByActor.get(actor),
      y1: top + actorHeight,
      y2: height - 20,
    })),
    messages: (s.messages || []).map((message, index) => ({
      ...message,
      fromX: xByActor.get(message.from),
      toX: xByActor.get(message.to),
      y: messageTop + index * rowHeight,
    })),
  }
}

export function sequenceToScene(layout, palette = DEFAULT_PALETTE) {
  return svgScene({
    class: 'sequence-svg',
    width: layout.width,
    height: layout.height,
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    style: 'max-width: 100%;',
    role: 'graphics-document document',
    'aria-roledescription': 'sequence diagram',
  }, [
    arrowMarkerScene(layout.markerID, palette),
    sceneEl('g', { class: 'sequence-svg-lifelines' }, layout.lifelines.map(line => sceneEl('line', {
      class: 'sequence-svg-lifeline',
      x1: line.x,
      y1: line.y1,
      x2: line.x,
      y2: line.y2,
    }))),
    sceneEl('g', { class: 'sequence-svg-messages' }, layout.messages.map(message => messageScene(message, layout.markerID, palette))),
    sceneEl('g', { class: 'sequence-svg-actors' }, layout.actors.map(actor => actorScene(actor))),
  ])
}

export function countSequenceMessages(s) {
  return (s.messages || []).length
}

export function countSequenceActors(s) {
  return (s.actors || []).length
}

function actorScene(actor) {
  return sceneEl('g', {
    class: 'sequence-svg-actor',
    transform: `translate(${actor.x}, ${actor.y})`,
  }, [
    sceneEl('rect', {
    x: -actor.width / 2,
    y: 0,
    width: actor.width,
    height: actor.height,
    rx: 8,
    ry: 8,
    }),
    sceneText('text', {
    class: 'sequence-svg-actor-label',
    x: 0,
    y: actor.height / 2,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    }, actor.label),
  ])
}

function messageScene(message, markerID, palette) {
  const fromX = message.fromX
  const toX = message.toX
  const y = message.y
  const dashed = message.style === 'dashed'
  if (fromX === toX) {
    const loopWidth = 54
    const loopHeight = 26
    return sceneEl('g', { class: `sequence-svg-message ${dashed ? 'dashed' : 'solid'}` }, [
      sceneEl('path', {
      class: 'path sequence-svg-message-line self',
      d: `M ${fromX} ${y} L ${fromX + loopWidth} ${y} L ${fromX + loopWidth} ${y + loopHeight} L ${fromX} ${y + loopHeight}`,
      fill: 'none',
      stroke: palette.line || DEFAULT_PALETTE.line,
      'marker-end': `url(#${markerID})`,
      }),
      labelScene(message.text, fromX + loopWidth / 2, y - 12),
    ])
  }

  return sceneEl('g', { class: `sequence-svg-message ${dashed ? 'dashed' : 'solid'}` }, [
    sceneEl('path', {
    class: 'path sequence-svg-message-line',
    d: `M ${fromX} ${y} L ${toX} ${y}`,
    fill: 'none',
    stroke: palette.line || DEFAULT_PALETTE.line,
    'marker-end': `url(#${markerID})`,
    }),
    labelScene(message.text, (fromX + toX) / 2, y - 12),
  ])
}

function labelScene(text, x, y) {
  const lines = wrapLabel(String(text || ''), 22)
  const width = Math.max(34, Math.max(...lines.map(line => measureLine(line, 7.4))) + 16)
  const height = lines.length * 16 + 8
  const startY = -((lines.length - 1) * 16) / 2
  return sceneEl('g', {
    class: 'edgeLabel sequence-svg-message-label',
    transform: `translate(${x}, ${y})`,
  }, [
    sceneEl('rect', {
    class: 'labelBackground',
    x: -width / 2,
    y: -height / 2,
    width,
    height,
    rx: 4,
    ry: 4,
    }),
    sceneEl('text', {
    class: 'sequence-svg-message-text',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    }, lines.map((line, index) => sceneEl('tspan', { x: 0, y: startY + index * 16 }, [sceneTextNode(line)]))),
  ])
}
