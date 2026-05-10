// HTML renderer (one of N implementations of schema/v2).
//
// Three-axis dispatch + reactive cells:
//   surface --(catalog)--> { kind: "encoding", binds: <encoding-name> }
//                           or { kind: "layout", binds: <layout-name> }
//
//   encoding renderers turn shape data into pixels (leaf).
//   layout renderers compose nested sections (recursive).
//   reactive cells (state/computed) propagate through `input` + `stat` and
//   any value field that uses {$bind: cell-name}.
//
// Adding a new surface = add catalog entry below + impl in encodings/layouts.
import './styles/main.scss'
import MarkdownIt from 'markdown-it'
import mermaid from 'mermaid'
import {
  initReactive, getCellSpec, getCell, setCell,
  subscribe, isBinding,
} from './reactive.js'

const md = new MarkdownIt({ html: false, linkify: true, breaks: false })

mermaid.initialize({
  startOnLoad: false,
  theme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'default',
  securityLevel: 'strict',
})

const root = document.getElementById('root')
const dataNode = document.getElementById('report-data')

let data
try {
  data = JSON.parse(dataNode.textContent)
} catch {
  data = { title: 'Empty Report', sections: [{ type: 'callout', kind: 'info', text: 'No data filled. Use `llm-report-html render data.json -o out.html`.' }] }
}

document.title = data.title || 'Report'

initReactive(data)

// ─── catalog: surface → (kind, binds) ────────────────────────────────────
// Mirror of schema/v2.json#/x-surface-catalog. Keep in sync.
const CATALOG = {
  // encoding surfaces (leaf)
  heading:    { kind: 'encoding', binds: 'heading' },
  paragraph:  { kind: 'encoding', binds: 'paragraph' },
  quote:      { kind: 'encoding', binds: 'quote' },
  code:       { kind: 'encoding', binds: 'code' },
  hr:         { kind: 'encoding', binds: 'divider' },
  list:       { kind: 'encoding', binds: 'list' },
  table:      { kind: 'encoding', binds: 'table' },
  timeline:   { kind: 'encoding', binds: 'timeline' },
  definition: { kind: 'encoding', binds: 'definition' },
  faq:        { kind: 'encoding', binds: 'faq' },
  callout:    { kind: 'encoding', binds: 'callout' },
  mermaid:    { kind: 'encoding', binds: 'mermaid' },
  diagram:    { kind: 'encoding', binds: 'diagram' },
  image:      { kind: 'encoding', binds: 'image' },
  input:      { kind: 'encoding', binds: 'input' },
  stat:       { kind: 'encoding', binds: 'stat' },
  // layout surfaces (container)
  details:    { kind: 'layout',   binds: 'accordion' },
  tabs:       { kind: 'layout',   binds: 'tabs' },
  columns:    { kind: 'layout',   binds: 'columns' },
  aside:      { kind: 'layout',   binds: 'aside' },
}

// ─── encodings ────────────────────────────────────────────────────────────
// Every encoding takes a section `s` whose binding fields are ALREADY
// resolved to literal values by the reactive wrapper. Encodings are pure:
// shape data → DOM. They never call subscribe() themselves. Exception:
// `input` is bidirectional (writes back to a cell) and bypasses the
// reactive wrapper — see SELF_REACTIVE below.
const encodings = {
  heading: s => {
    const tag = `h${Math.min(Math.max(s.level || 2, 1), 4)}`
    return el(tag, { id: slug(s.text) }, [text(String(s.text ?? ''))])
  },

  paragraph: s => htmlBlock(md.render(String(s.text ?? ''))),

  quote: s => {
    const bq = el('blockquote', {}, [])
    bq.appendChild(htmlBlock(md.renderInline(String(s.text ?? '')), 'p'))
    if (s.by) bq.appendChild(el('footer', {}, [text('— ' + s.by)]))
    return bq
  },

  code: s => {
    const pre = el('pre', {}, [])
    const code = el('code', { class: s.lang ? `lang-${s.lang}` : '' }, [text(s.code || '')])
    pre.appendChild(code)
    return pre
  },

  divider: () => el('hr', {}, []),

  list: s => {
    const tag = s.ordered ? 'ol' : 'ul'
    const list = el(tag, {}, [])
    for (const item of s.items || []) {
      const li = document.createElement('li')
      li.innerHTML = md.renderInline(typeof item === 'string' ? item : (item.text || ''))
      if (typeof item === 'object' && item.children) {
        const sub = encodings.list({ ordered: s.ordered, items: item.children })
        li.appendChild(sub)
      }
      list.appendChild(li)
    }
    return list
  },

  table: s => {
    const t = el('table', {}, [])
    if (s.columns) {
      const thead = el('thead', {}, [])
      const tr = el('tr', {}, [])
      for (const c of s.columns) tr.appendChild(el('th', {}, [text(c)]))
      thead.appendChild(tr)
      t.appendChild(thead)
    }
    const tbody = el('tbody', {}, [])
    for (const row of s.rows || []) {
      const tr = el('tr', {}, [])
      for (const cell of row) {
        const td = document.createElement('td')
        td.innerHTML = md.renderInline(String(cell ?? ''))
        tr.appendChild(td)
      }
      tbody.appendChild(tr)
    }
    t.appendChild(tbody)
    return t
  },

  timeline: s => {
    const ul = el('ul', { class: 'timeline' }, [])
    for (const item of s.items || []) {
      const li = document.createElement('li')
      li.appendChild(el('span', { class: 'date' }, [text(item.date || '')]))
      const span = document.createElement('span')
      span.innerHTML = md.renderInline(item.text || '')
      li.appendChild(span)
      ul.appendChild(li)
    }
    return ul
  },

  definition: s => {
    const dl = el('dl', { class: 'report-dl' }, [])
    for (const item of s.items || []) {
      dl.appendChild(el('dt', {}, [text(item.term || '')]))
      const dd = document.createElement('dd')
      dd.innerHTML = md.renderInline(item.def || '')
      dl.appendChild(dd)
    }
    return dl
  },

  faq: s => {
    const wrap = el('div', { class: 'faq' }, [])
    for (const item of s.items || []) {
      const d = el('details', {}, [])
      d.appendChild(el('summary', {}, [text('Q: ' + (item.q || ''))]))
      const a = document.createElement('div')
      a.innerHTML = md.render(item.a || '')
      d.appendChild(a)
      wrap.appendChild(d)
    }
    return wrap
  },

  callout: s => {
    const kind = s.kind || 'info'
    const c = el('div', { class: `callout ${kind}` }, [])
    if (s.title) c.appendChild(el('div', { class: 'callout-title' }, [text(String(s.title))]))
    const body = document.createElement('div')
    body.innerHTML = md.render(String(s.text ?? ''))
    c.appendChild(body)
    return c
  },

  mermaid: s => {
    const wrap = el('div', { class: 'mermaid-block' }, [])
    const id = 'm' + Math.random().toString(36).slice(2, 9)
    mermaid.render(id, s.code || '').then(({ svg }) => { wrap.innerHTML = svg })
      .catch(e => { wrap.innerHTML = `<div class="report-error">mermaid: ${e.message}</div>` })
    return wrap
  },

  // Structured diagram → translated to mermaid by kind, then rendered
  // through the same pipeline as the raw `mermaid` surface. AI never writes
  // mermaid DSL for kinds covered here.
  diagram: s => {
    const wrap = el('div', { class: 'mermaid-block' }, [])
    let code
    try {
      if (s.kind === 'flow')          code = flowToMermaid(s)
      else if (s.kind === 'sequence') code = sequenceToMermaid(s)
      else if (s.kind === 'quadrant') code = quadrantToMermaid(s)
      else if (s.kind === 'tree')     code = treeToMermaid(s)
      else if (s.kind === 'state')    code = stateToMermaid(s)
      else {
        wrap.innerHTML = `<div class="report-error">diagram: unknown kind "${s.kind}"</div>`
        return wrap
      }
    } catch (e) {
      wrap.innerHTML = `<div class="report-error">diagram: ${e.message}</div>`
      return wrap
    }
    const id = 'd' + Math.random().toString(36).slice(2, 9)
    mermaid.render(id, code).then(({ svg }) => { wrap.innerHTML = svg })
      .catch(e => { wrap.innerHTML = `<div class="report-error">mermaid: ${e.message}</div>` })
    return wrap
  },

  image: s => {
    const fig = el('figure', {}, [])
    const img = el('img', { src: s.src, alt: s.alt || '', style: 'max-width:100%;height:auto;border-radius:6px;' }, [])
    fig.appendChild(img)
    if (s.caption) fig.appendChild(el('figcaption', { style: 'color:var(--muted);font-size:.9em;text-align:center;margin-top:.4rem;' }, [text(s.caption)]))
    return fig
  },

  input: s => {
    const spec = getCellSpec(s.bind)
    if (!spec) return errorNode(`input.bind references undeclared state cell: ${s.bind}`)
    const wrap = el('div', { class: 'input-control' }, [])
    wrap.appendChild(el('label', { for: 'cell-' + s.bind }, [text(s.label || spec.label || s.bind)]))
    let input
    if (spec.type === 'number') {
      input = document.createElement('input')
      input.type = 'number'
      input.id = 'cell-' + s.bind
      input.value = getCell(s.bind)
      if (spec.min !== undefined)  input.min  = spec.min
      if (spec.max !== undefined)  input.max  = spec.max
      if (spec.step !== undefined) input.step = spec.step
      input.addEventListener('input', () => {
        const v = input.value === '' ? null : parseFloat(input.value)
        setCell(s.bind, Number.isFinite(v) ? v : 0)
      })
    } else if (spec.type === 'text') {
      input = document.createElement('input')
      input.type = 'text'
      input.id = 'cell-' + s.bind
      input.value = getCell(s.bind) ?? ''
      input.addEventListener('input', () => setCell(s.bind, input.value))
    } else if (spec.type === 'boolean') {
      input = document.createElement('input')
      input.type = 'checkbox'
      input.id = 'cell-' + s.bind
      input.checked = !!getCell(s.bind)
      input.addEventListener('change', () => setCell(s.bind, input.checked))
    } else if (spec.type === 'select') {
      input = document.createElement('select')
      input.id = 'cell-' + s.bind
      for (const opt of spec.options || []) {
        const o = el('option', { value: opt }, [text(opt)])
        if (getCell(s.bind) === opt) o.selected = true
        input.appendChild(o)
      }
      input.addEventListener('change', () => setCell(s.bind, input.value))
    } else {
      return errorNode(`input: unsupported cell type ${spec.type}`)
    }
    wrap.appendChild(input)
    return wrap
  },

  stat: s => {
    const wrap = el('div', { class: 'stat-card' }, [])
    if (s.label) wrap.appendChild(el('div', { class: 'stat-label' }, [text(s.label)]))
    const val = el('div', { class: 'stat-value' }, [])
    wrap.appendChild(val)
    const fmt = s.format || 'plain'
    const update = v => { val.textContent = formatValue(v, fmt) }
    if (isBinding(s.value)) subscribe(s.value.$bind, update)
    else update(s.value)
    return wrap
  },
}

// ─── layouts (containers) ────────────────────────────────────────────────
const layouts = {
  accordion: s => {
    const d = el('details', s.open ? { open: '' } : {}, [])
    d.appendChild(el('summary', {}, [text(s.summary || 'Details')]))
    const body = el('div', { class: 'report-body' }, [])
    for (const child of s.sections || []) {
      const c = renderSection(child)
      if (c) body.appendChild(c)
    }
    d.appendChild(body)
    return d
  },

  tabs: s => {
    const wrap = el('div', { class: 'tabs' }, [])
    const headers = el('div', { class: 'tab-headers' }, [])
    const panels = el('div', { class: 'tab-panels' }, [])
    const items = s.items || []
    items.forEach((item, i) => {
      const btn = el('button', { class: 'tab-header' + (i === 0 ? ' active' : '') }, [text(item.label || `Tab ${i + 1}`)])
      const panel = el('div', { class: 'tab-panel' + (i === 0 ? ' active' : '') }, [])
      for (const child of item.sections || []) {
        const c = renderSection(child)
        if (c) panel.appendChild(c)
      }
      btn.onclick = () => {
        for (const h of headers.children) h.classList.remove('active')
        for (const p of panels.children) p.classList.remove('active')
        btn.classList.add('active')
        panel.classList.add('active')
      }
      headers.appendChild(btn)
      panels.appendChild(panel)
    })
    wrap.appendChild(headers)
    wrap.appendChild(panels)
    return wrap
  },

  columns: s => {
    const items = s.items || []
    const wrap = el('div', { class: 'columns', style: `--n:${items.length}` }, [])
    for (const item of items) {
      const col = el('div', { class: 'column' }, [])
      for (const child of item.sections || []) {
        const c = renderSection(child)
        if (c) col.appendChild(c)
      }
      wrap.appendChild(col)
    }
    return wrap
  },

  aside: s => {
    const a = el('aside', { class: 'report-aside' }, [])
    const body = el('div', { class: 'report-body' }, [])
    if (s.title) body.appendChild(el('div', { class: 'report-aside-title' }, [text(s.title)]))
    for (const child of s.sections || []) {
      const c = renderSection(child)
      if (c) body.appendChild(c)
    }
    a.appendChild(body)
    return a
  },
}

// ─── dispatch ────────────────────────────────────────────────────────────
// Encodings that manage their own reactivity (bidirectional or stateful DOM).
// These bypass the reactive wrapper and render once. They subscribe directly
// when needed.
const SELF_REACTIVE = new Set(['input'])

// Template literal pattern: text fields may contain `{$bind:cellName}`
// substrings that get replaced with current cell values during render.
const TEMPLATE_RE = /\{\$bind:(\w+)\}/g

// collectAllRefs walks a section's value tree and returns the set of cell
// names referenced by either {$bind:NAME} object form or "{$bind:NAME}"
// template substring. Skips nested-section fields (sections, items[].sections)
// since those children manage their own reactivity.
function collectAllRefs(node, refs = new Set(), parentKey = '') {
  if (parentKey === 'sections') return refs  // child sections handle themselves
  if (Array.isArray(node)) {
    for (const v of node) collectAllRefs(v, refs, parentKey)
    return refs
  }
  if (node && typeof node === 'object') {
    if (typeof node.$bind === 'string') {
      refs.add(node.$bind)
      return refs
    }
    for (const [k, v] of Object.entries(node)) collectAllRefs(v, refs, k)
    return refs
  }
  if (typeof node === 'string') {
    let m
    TEMPLATE_RE.lastIndex = 0
    while ((m = TEMPLATE_RE.exec(node)) !== null) refs.add(m[1])
  }
  return refs
}

// resolveAllBindings deep-clones a section, replacing {$bind:NAME} (object) and
// "{$bind:NAME}" (template substring) with current cell values. Skips
// "sections" arrays — children render themselves.
function resolveAllBindings(node, parentKey = '') {
  if (parentKey === 'sections') return node
  if (Array.isArray(node)) return node.map(v => resolveAllBindings(v, parentKey))
  if (node && typeof node === 'object') {
    if (typeof node.$bind === 'string') return getCell(node.$bind)
    const out = {}
    for (const [k, v] of Object.entries(node)) out[k] = resolveAllBindings(v, k)
    return out
  }
  if (typeof node === 'string') {
    return node.replace(TEMPLATE_RE, (_, name) => {
      const v = getCell(name)
      return v == null ? '' : String(v)
    })
  }
  return node
}

// resolveIf evaluates a section's optional `if` field (boolean or {$bind}).
function resolveIf(v) {
  if (v === undefined) return true
  if (typeof v === 'object' && typeof v?.$bind === 'string') return !!getCell(v.$bind)
  return !!v
}

function renderSection(s) {
  if (!s || typeof s !== 'object' || !s.type) return errorNode('section missing type')
  const entry = CATALOG[s.type]
  if (!entry) return errorNode('unknown surface type: ' + s.type)
  const fn = entry.kind === 'encoding' ? encodings[entry.binds] : layouts[entry.binds]
  if (!fn) return errorNode(`surface ${s.type} resolved to ${entry.kind}/${entry.binds} but no impl`)

  // Visibility: section.if (literal or {$bind})
  if (s.if !== undefined) {
    return wrapWithVisibility(s, () => renderInner(s, entry, fn))
  }
  return renderInner(s, entry, fn)
}

function renderInner(s, entry, fn) {
  // Self-reactive encodings (input) and all layouts handle their own
  // reactivity manually. Bulk-rerender would lose interactive state or
  // child reactivity setup.
  if (entry.kind !== 'encoding' || SELF_REACTIVE.has(s.type)) {
    return safeInvoke(fn, s)
  }

  // Reactive-encoding path: scan all binding refs once, subscribe, rerender.
  const refs = collectAllRefs(s)
  if (refs.size === 0) return safeInvoke(fn, s)

  const wrap = el('div', { class: 'reactive-section' }, [])
  wrap.style.display = 'contents'
  const update = () => {
    const next = safeInvoke(fn, resolveAllBindings(s))
    wrap.replaceChildren(next)
  }
  refs.forEach(name => subscribe(name, update))
  return wrap
}

function wrapWithVisibility(s, renderFn) {
  const ifVal = s.if
  if (typeof ifVal !== 'object' || ifVal === null || typeof ifVal.$bind !== 'string') {
    // Static literal — evaluate once, return rendered or null.
    return resolveIf(ifVal) ? renderFn() : null
  }
  // Reactive: wrap in placeholder, toggle on cell change.
  const wrap = el('div', { class: 'reactive-if' }, [])
  wrap.style.display = 'contents'
  let cached = null
  const update = (val) => {
    if (val) {
      if (!cached) cached = renderFn()
      wrap.replaceChildren(cached)
    } else {
      wrap.replaceChildren()
    }
  }
  subscribe(ifVal.$bind, update)
  return wrap
}

function safeInvoke(fn, s) {
  try { return fn(s) } catch (e) { return errorNode(`${s.type} render: ${e.message}`) }
}

function render(doc, host) {
  if (doc.title) host.appendChild(el('h1', {}, [text(doc.title)]))
  if (doc.subtitle || doc.author || doc.date) {
    const meta = el('div', { class: 'report-meta' }, [])
    const parts = []
    if (doc.subtitle) parts.push(doc.subtitle)
    if (doc.author) parts.push(`by ${doc.author}`)
    if (doc.date) parts.push(doc.date)
    meta.textContent = parts.join(' · ')
    host.appendChild(meta)
  }
  for (const s of doc.sections || []) {
    const node = renderSection(s)
    if (node) host.appendChild(node)
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────
function el(tag, attrs, children) {
  const n = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === '' || v === true) n.setAttribute(k, '')
    else if (v != null && v !== false) n.setAttribute(k, v)
  }
  for (const c of children || []) n.appendChild(c)
  return n
}
function text(s) { return document.createTextNode(s) }
function htmlBlock(html, tag = 'div') {
  const n = document.createElement(tag)
  n.innerHTML = html
  return n
}

// Translate structured `diagram.flow` → mermaid flowchart DSL. Always
// quotes labels (`["text"]`) so brackets / colons / Chinese / arrows in
// label text don't break the parse.
function flowToMermaid(s) {
  const dir = s.direction || 'LR'
  const lines = [`flowchart ${dir}`]
  const SHAPES = {
    rect:    ['["',  '"]'],
    round:   ['("',  '")'],
    stadium: ['(["', '"])'],
    diamond: ['{"',  '"}'],
    circle:  ['(("', '"))'],
  }
  const esc = v => String(v ?? '').replace(/"/g, '&quot;')
  for (const n of s.nodes || []) {
    const [open, close] = SHAPES[n.shape || 'rect'] || SHAPES.rect
    lines.push(`  ${n.id}${open}${esc(n.label)}${close}`)
  }
  for (const e of s.edges || []) {
    const arrow = e.style === 'dotted' ? '-.->'
                : e.style === 'thick'  ? '==>'
                : '-->'
    if (e.label) lines.push(`  ${e.from} ${arrow}|"${esc(e.label)}"| ${e.to}`)
    else         lines.push(`  ${e.from} ${arrow} ${e.to}`)
  }
  return lines.join('\n')
}

// Translate structured `diagram.sequence` → mermaid sequenceDiagram DSL.
// Actors get aliases (A0, A1, …) so non-ASCII names with spaces don't
// collide with the participant declaration syntax.
function sequenceToMermaid(s) {
  const lines = ['sequenceDiagram']
  const alias = new Map()
  ;(s.actors || []).forEach((a, i) => {
    const id = 'A' + i
    alias.set(a, id)
    const name = String(a).replace(/"/g, '&quot;')
    lines.push(`  participant ${id} as ${name}`)
  })
  for (const m of s.messages || []) {
    const from = alias.get(m.from) ?? m.from
    const to   = alias.get(m.to)   ?? m.to
    const arrow = m.style === 'dashed' ? '-->>' : '->>'
    const text = String(m.text ?? '').replace(/[\r\n]+/g, ' ')
    lines.push(`  ${from}${arrow}${to}: ${text}`)
  }
  return lines.join('\n')
}

// Translate `diagram.quadrant` → mermaid quadrantChart. Strings are quoted
// so spaces / colons / Chinese in axis labels and item names are safe.
function quadrantToMermaid(s) {
  const lines = ['quadrantChart']
  const esc = v => String(v ?? '').replace(/"/g, '&quot;')
  if (s.title) lines.push(`  title ${esc(s.title)}`)
  const ax = s.axes?.x || {}
  const ay = s.axes?.y || {}
  if (ax.low && ax.high) lines.push(`  x-axis "${esc(ax.low)}" --> "${esc(ax.high)}"`)
  else if (ax.label)     lines.push(`  x-axis "${esc(ax.label)}"`)
  if (ay.low && ay.high) lines.push(`  y-axis "${esc(ay.low)}" --> "${esc(ay.high)}"`)
  else if (ay.label)     lines.push(`  y-axis "${esc(ay.label)}"`)
  const q = s.quadrants || {}
  if (q.q1) lines.push(`  quadrant-1 ${esc(q.q1)}`)
  if (q.q2) lines.push(`  quadrant-2 ${esc(q.q2)}`)
  if (q.q3) lines.push(`  quadrant-3 ${esc(q.q3)}`)
  if (q.q4) lines.push(`  quadrant-4 ${esc(q.q4)}`)
  const clamp = v => Math.min(1, Math.max(0, Number(v) || 0))
  for (const item of s.items || []) {
    lines.push(`  "${esc(item.label)}": [${clamp(item.x)}, ${clamp(item.y)}]`)
  }
  return lines.join('\n')
}

// Translate `diagram.tree` → mermaid mindmap. Indentation drives
// hierarchy; root uses circle shape `((label))`.
function treeToMermaid(s) {
  const lines = ['mindmap']
  const sanitize = v => String(v ?? '').replace(/[\r\n]+/g, ' ')
  function walk(node, depth) {
    const indent = '  '.repeat(depth + 1)
    const label = sanitize(node?.label)
    if (depth === 0) lines.push(`${indent}root((${label}))`)
    else             lines.push(`${indent}${label}`)
    for (const c of node?.children || []) walk(c, depth + 1)
  }
  if (s.root) walk(s.root, 0)
  return lines.join('\n')
}

// Translate `diagram.state` → mermaid stateDiagram-v2. Distinct labels are
// emitted via `state "label" as id`; `[*]` is reserved for initial/final.
function stateToMermaid(s) {
  const lines = ['stateDiagram-v2']
  const esc = v => String(v ?? '').replace(/"/g, '&quot;').replace(/[\r\n]+/g, ' ')
  for (const st of s.states || []) {
    if (st.label && st.label !== st.id) {
      lines.push(`  state "${esc(st.label)}" as ${st.id}`)
    }
  }
  if (s.initial) lines.push(`  [*] --> ${s.initial}`)
  for (const t of s.transitions || []) {
    if (t.label) lines.push(`  ${t.from} --> ${t.to}: ${esc(t.label)}`)
    else         lines.push(`  ${t.from} --> ${t.to}`)
  }
  for (const f of s.final || []) {
    lines.push(`  ${f} --> [*]`)
  }
  return lines.join('\n')
}
function errorNode(msg) {
  const d = document.createElement('div')
  d.className = 'report-error'
  d.textContent = msg
  return d
}
function slug(s) {
  return String(s || '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '')
}

function formatValue(v, kind) {
  if (v === null || v === undefined || v === '') return ''
  const n = Number(v)
  switch (kind) {
    case 'currency': return Number.isFinite(n)
      ? '¥' + n.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
      : String(v)
    case 'percent':  return Number.isFinite(n) ? (n * 100).toFixed(1) + '%' : String(v)
    case 'number':   return Number.isFinite(n) ? n.toLocaleString('zh-CN') : String(v)
    default:         return String(v)
  }
}

render(data, root)
