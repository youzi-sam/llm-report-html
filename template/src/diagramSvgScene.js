import {
  renderArrowMarker,
  renderCenteredText,
  renderNodeShape,
  renderPolylineEdge,
  svgEl,
} from './diagramSvgPrimitives.js'

export function svgScene(attrs, children = []) {
  return { kind: 'element', tag: 'svg', attrs, children }
}

export function sceneEl(tag, attrs = {}, children = []) {
  return { kind: 'element', tag, attrs, children }
}

export function sceneText(tag, attrs = {}, value = '') {
  return { kind: 'textElement', tag, attrs, value }
}

export function sceneTextNode(value) {
  return { kind: 'textNode', value }
}

export function arrowMarkerScene(markerID, palette) {
  return { kind: 'arrowMarker', markerID, palette }
}

export function nodeShapeScene(shape, size) {
  return { kind: 'nodeShape', shape, size }
}

export function centeredTextScene(lines, opts = {}) {
  return { kind: 'centeredText', lines, opts }
}

export function polylineEdgeScene(edge, opts = {}) {
  return { kind: 'polylineEdge', edge, opts }
}

export function renderSvgScene(scene) {
  return renderSceneNode(scene)
}

function renderSceneNode(node) {
  if (!node) return null
  if (globalThis.Node && node instanceof Node) return node
  switch (node.kind) {
    case 'element': {
      const element = svgEl(node.tag, node.attrs || {})
      appendSceneChildren(element, node.children)
      return element
    }
    case 'textElement': {
      const element = svgEl(node.tag, node.attrs || {})
      element.textContent = node.value == null ? '' : String(node.value)
      return element
    }
    case 'textNode':
      return document.createTextNode(node.value == null ? '' : String(node.value))
    case 'arrowMarker':
      return renderArrowMarker(node.markerID, node.palette)
    case 'nodeShape':
      return renderNodeShape(node.shape, node.size)
    case 'centeredText':
      return renderCenteredText(node.lines, node.opts)
    case 'polylineEdge':
      return renderPolylineEdge(node.edge, node.opts)
    default:
      throw new Error(`unknown SVG scene node kind: ${node.kind}`)
  }
}

function appendSceneChildren(element, children = []) {
  for (const child of children || []) {
    const rendered = renderSceneNode(child)
    if (rendered) element.appendChild(rendered)
  }
}
