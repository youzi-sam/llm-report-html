import { el, errorNode, text } from './dom.js'

const SELF_REACTIVE = new Set(['input'])
const TEMPLATE_RE = /\{\$bind:(\w+)\}/g

export function createSectionRenderer({ catalog, encodings, createLayouts, reactive }) {
  const { getCell, subscribe } = reactive
  const layouts = createLayouts(renderSection)

  function renderSection(section) {
    if (!section || typeof section !== 'object' || !section.type) return errorNode('section missing type')
    const entry = catalog[section.type]
    if (!entry) return errorNode('unknown surface type: ' + section.type)
    const fn = entry.kind === 'encoding' ? encodings[entry.binds] : layouts[entry.binds]
    if (!fn) return errorNode(`surface ${section.type} resolved to ${entry.kind}/${entry.binds} but no impl`)

    if (section.if !== undefined) {
      return wrapWithVisibility(section, () => renderInner(section, entry, fn))
    }
    return renderInner(section, entry, fn)
  }

  return {
    renderSection,
    renderDocument(doc, host) {
      if (doc.title) host.appendChild(el('h1', {}, [text(doc.title)]))
      if (doc.subtitle || doc.author || doc.date) {
        const meta = el('div', { class: 'report-meta' })
        const parts = []
        if (doc.subtitle) parts.push(doc.subtitle)
        if (doc.author) parts.push(`by ${doc.author}`)
        if (doc.date) parts.push(doc.date)
        meta.textContent = parts.join(' · ')
        host.appendChild(meta)
      }
      for (const section of doc.sections || []) {
        const node = renderSection(section)
        if (node) host.appendChild(node)
      }
    },
  }

  function renderInner(section, entry, fn) {
    if (entry.kind !== 'encoding' || SELF_REACTIVE.has(section.type)) {
      return invoke(fn, section)
    }

    const refs = collectAllRefs(section)
    if (refs.size === 0) return invoke(fn, section)

    const wrap = el('div', { class: 'reactive-section' })
    wrap.style.display = 'contents'
    const update = () => {
      const next = invoke(fn, resolveAllBindings(section))
      wrap.replaceChildren(next)
    }
    refs.forEach(name => subscribe(name, update))
    return wrap
  }

  function wrapWithVisibility(section, renderFn) {
    const ifVal = section.if
    if (typeof ifVal !== 'object' || ifVal === null || typeof ifVal.$bind !== 'string') {
      return resolveIf(ifVal) ? renderFn() : null
    }
    const wrap = el('div', { class: 'reactive-if' })
    wrap.style.display = 'contents'
    let cached = null
    const update = value => {
      if (value) {
        if (!cached) cached = renderFn()
        wrap.replaceChildren(cached)
      } else {
        wrap.replaceChildren()
      }
    }
    subscribe(ifVal.$bind, update)
    return wrap
  }

  function invoke(fn, section) {
    const node = safeInvoke(fn, section)
    bindTextPlaceholders(node)
    return node
  }

  function bindTextPlaceholders(root) {
    if (!root || typeof root.querySelectorAll !== 'function') return
    for (const node of root.querySelectorAll('[data-bind-text]')) {
      const name = node.getAttribute('data-bind-text')
      if (!name) continue
      subscribe(name, value => {
        node.textContent = value == null ? '' : String(value)
      })
    }
  }

  function resolveAllBindings(node, parentKey = '') {
    if (parentKey === 'sections') return node
    if (Array.isArray(node)) return node.map(value => resolveAllBindings(value, parentKey))
    if (node && typeof node === 'object') {
      if (typeof node.$bind === 'string') return getCell(node.$bind)
      const out = {}
      for (const [key, value] of Object.entries(node)) out[key] = resolveAllBindings(value, key)
      return out
    }
    if (typeof node === 'string') {
      return node.replace(TEMPLATE_RE, (_, name) => {
        const value = getCell(name)
        return value == null ? '' : String(value)
      })
    }
    return node
  }

  function resolveIf(value) {
    if (value === undefined) return true
    if (typeof value === 'object' && typeof value?.$bind === 'string') return !!getCell(value.$bind)
    return !!value
  }
}

function collectAllRefs(node, refs = new Set(), parentKey = '') {
  if (parentKey === 'sections') return refs
  if (Array.isArray(node)) {
    for (const value of node) collectAllRefs(value, refs, parentKey)
    return refs
  }
  if (node && typeof node === 'object') {
    if (typeof node.$bind === 'string') {
      refs.add(node.$bind)
      return refs
    }
    for (const [key, value] of Object.entries(node)) collectAllRefs(value, refs, key)
    return refs
  }
  if (typeof node === 'string') {
    let match
    TEMPLATE_RE.lastIndex = 0
    while ((match = TEMPLATE_RE.exec(node)) !== null) refs.add(match[1])
  }
  return refs
}

function safeInvoke(fn, section) {
  try {
    return fn(section)
  } catch (error) {
    return errorNode(`${section.type} render: ${error.message}`)
  }
}
