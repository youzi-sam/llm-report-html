export function trustedHTMLBlock(owner, key, tag = 'div') {
  const node = document.createElement(tag)
  setTrustedHTML(node, owner, key)
  return node
}

export function setTrustedHTML(node, owner, key) {
  node.innerHTML = trustedHTML(owner, key)
}

export function setTrustedHTMLString(node, value) {
  node.innerHTML = String(value ?? '')
}

export function trustedHTML(owner, key) {
  const value = owner?.render?.[key]
  if (typeof value !== 'string') throw new Error(`missing render.${key}`)
  return value
}

export function renderItems(owner) {
  const items = owner?.render?.items
  if (!Array.isArray(items)) throw new Error('missing render.items')
  return items
}

export function renderChildren(owner) {
  const children = owner?.render?.children
  return Array.isArray(children) ? children : []
}

export function renderRowsHTML(owner) {
  const rows = owner?.render?.rowsHtml
  if (!Array.isArray(rows)) throw new Error('missing render.rowsHtml')
  return rows
}
