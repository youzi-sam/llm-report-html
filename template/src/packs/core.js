import '../styles/main.scss'
import { CATALOG } from '../generated/catalog.js'
import { createDiagramPalette } from '../diagramPalette.js'
import { createEncodings } from '../encodings.js'
import { createLayouts } from '../layouts.js'
import { createSectionRenderer } from '../sectionRenderer.js'

const root = document.getElementById('root')
const data = readReportData(document.getElementById('report-render-data'))
const reactive = globalThis.LRH_REACTIVE || staticReactive()
const diagramRenderers = globalThis.LRH_DIAGRAMS || {}

document.title = data.title || 'Report'
reactive.initReactive(data)

const encodings = createEncodings({
  diagramPalette: createDiagramPalette(),
  diagramRenderers,
  reactive,
})

const { renderDocument } = createSectionRenderer({
  catalog: CATALOG,
  encodings,
  createLayouts,
  reactive,
})

renderDocument(data, root)
installTOC(root)

function readReportData(node) {
  try {
    return JSON.parse(node.textContent)
  } catch {
    return {
      title: 'Empty Report',
      sections: [{
        type: 'callout',
        kind: 'info',
        text: 'No data filled. Use `llm-report-html render data.json -o out.html`.',
        render: {
          html: '<p>No data filled. Use <code>llm-report-html render data.json -o out.html</code>.</p>\n',
        },
      }],
    }
  }
}

function installTOC(host) {
  let nav = null
  let scheduled = false
  const observer = new MutationObserver(records => {
    if (records.some(record => !record.target.closest?.('.report-toc'))) schedule()
  })
  const schedule = () => {
    if (scheduled) return
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      rebuild()
    })
  }
  const rebuild = () => {
    const headings = [...host.querySelectorAll('h2,h3,h4')]
      .filter(heading => !heading.closest('.report-toc'))
    if (headings.length < 2) {
      if (nav) nav.remove()
      nav = null
      return
    }
    ensureHeadingIDs(headings)
    if (!nav) {
      nav = document.createElement('nav')
      nav.className = 'report-toc'
      insertTOC(host, nav)
    }
    renderTOC(nav, headings)
  }
  rebuild()
  observer.observe(host, { childList: true, subtree: true, characterData: true })
}

function insertTOC(host, nav) {
  const meta = host.querySelector('.report-meta')
  if (meta) {
    meta.after(nav)
    return
  }
  const title = host.querySelector('h1')
  if (title) title.after(nav)
  else host.prepend(nav)
}

function renderTOC(nav, headings) {
  nav.replaceChildren()
  const details = document.createElement('details')
  details.open = true
  const summary = document.createElement('summary')
  summary.textContent = '目录'
  const list = document.createElement('ol')
  for (const heading of headings) {
    const item = document.createElement('li')
    item.className = `toc-${heading.tagName.toLowerCase()}`
    const link = document.createElement('a')
    link.href = `#${heading.id}`
    link.textContent = heading.textContent || heading.id
    item.appendChild(link)
    list.appendChild(item)
  }
  details.append(summary, list)
  nav.appendChild(details)
}

function ensureHeadingIDs(headings) {
  const used = new Set()
  for (const heading of headings) {
    let id = heading.id
    if (!id || used.has(id)) {
      id = uniqueID(slug(heading.textContent) || 'section', used)
      heading.id = id
    }
    used.add(id)
  }
}

function uniqueID(base, used) {
  let id = base
  let index = 2
  while (used.has(id) || document.getElementById(id)) {
    id = `${base}-${index}`
    index++
  }
  return id
}

function slug(value) {
  return String(value || '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '')
}

function staticReactive() {
  const inactive = () => { throw new Error('reactive runtime not loaded') }
  return {
    initReactive() {},
    getCell: inactive,
    getCellSpec: inactive,
    setCell: inactive,
    subscribe: inactive,
    isBinding(value) {
      return !!(value && typeof value === 'object' && typeof value.$bind === 'string')
    },
  }
}
