import { el, errorNode, formatValue, htmlBlock, slug, text } from './dom.js'

export function createEncodings({ diagramPalette, diagramRenderers, reactive }) {
  const { getCell, getCellSpec, isBinding, setCell, subscribe } = reactive
  const encodings = {
    heading: section => {
      const tag = `h${Math.min(Math.max(section.level || 2, 1), 4)}`
      return el(tag, { id: slug(section.text) }, [text(String(section.text ?? ''))])
    },

    paragraph: section => htmlBlock(section.__html ?? String(section.text ?? '')),

    quote: section => {
      const block = el('blockquote')
      block.appendChild(htmlBlock(section.__textHtml ?? String(section.text ?? ''), 'p'))
      if (section.by) block.appendChild(el('footer', {}, [text('— ' + section.by)]))
      return block
    },

    code: section => {
      const pre = el('pre', { class: 'code-block' })
      const classes = ['chroma']
      if (section.lang) classes.push(`lang-${section.lang}`)
      const code = el('code', { class: classes.join(' ') })
      if (section.__html) code.innerHTML = section.__html
      else code.textContent = section.code || ''
      pre.appendChild(code)
      return pre
    },

    divider: () => el('hr'),

    list: section => {
      const tag = section.ordered ? 'ol' : 'ul'
      const list = el(tag)
      for (const item of section.__items || section.items || []) list.appendChild(renderListItem(item, section.ordered))
      return list
    },

    table: section => {
      const table = el('table')
      if (section.columns) {
        const thead = el('thead')
        const tr = el('tr')
        for (const column of section.columns) tr.appendChild(el('th', {}, [text(column)]))
        thead.appendChild(tr)
        table.appendChild(thead)
      }
      const tbody = el('tbody')
      const rows = section.__rowsHtml || section.rows || []
      for (const row of rows) {
        const tr = el('tr')
        for (const cell of row) {
          const td = document.createElement('td')
          if (section.__rowsHtml) td.innerHTML = String(cell ?? '')
          else td.textContent = String(cell ?? '')
          tr.appendChild(td)
        }
        tbody.appendChild(tr)
      }
      table.appendChild(tbody)
      return table
    },

    timeline: section => {
      const list = el('ul', { class: 'timeline' })
      for (const item of section.__items || section.items || []) {
        const li = document.createElement('li')
        li.appendChild(el('span', { class: 'date' }, [text(item.date || '')]))
        const body = document.createElement('span')
        body.innerHTML = item.__textHtml ?? String(item.text || '')
        li.appendChild(body)
        list.appendChild(li)
      }
      return list
    },

    definition: section => {
      const list = el('dl', { class: 'report-dl' })
      for (const item of section.__items || section.items || []) {
        list.appendChild(el('dt', {}, [text(item.term || '')]))
        const definition = document.createElement('dd')
        definition.innerHTML = item.__defHtml ?? String(item.def || '')
        list.appendChild(definition)
      }
      return list
    },

    faq: section => {
      const wrap = el('div', { class: 'faq' })
      for (const item of section.__items || section.items || []) {
        const details = el('details')
        details.appendChild(el('summary', {}, [text('Q: ' + (item.q || ''))]))
        const answer = document.createElement('div')
        answer.innerHTML = item.__aHtml ?? String(item.a || '')
        details.appendChild(answer)
        wrap.appendChild(details)
      }
      return wrap
    },

    callout: section => {
      const node = el('div', { class: `callout ${section.kind || 'info'}` })
      if (section.title) node.appendChild(el('div', { class: 'callout-title' }, [text(String(section.title))]))
      const body = document.createElement('div')
      body.innerHTML = section.__html ?? String(section.text ?? '')
      node.appendChild(body)
      return node
    },

    diagram: section => {
      const wrap = el('div', { class: `diagram-block diagram-${section.kind || 'unknown'}` })
      const renderer = diagramRenderers[section.kind]
      if (!renderer) {
        wrap.innerHTML = `<div class="report-error">diagram: unknown kind "${section.kind}"</div>`
        return wrap
      }
      try {
        wrap.appendChild(renderer(section, diagramPalette))
      } catch (error) {
        wrap.innerHTML = `<div class="report-error">diagram: ${error.message}</div>`
      }
      return wrap
    },

    image: section => {
      const figure = el('figure')
      figure.appendChild(el('img', {
        src: section.src,
        alt: section.alt || '',
        style: 'max-width:100%;height:auto;border-radius:6px;',
      }))
      if (section.caption) {
        figure.appendChild(el('figcaption', {
          style: 'color:var(--muted);font-size:.9em;text-align:center;margin-top:.4rem;',
        }, [text(section.caption)]))
      }
      return figure
    },

    input: section => renderInput(section),

    stat: section => {
      const wrap = el('div', { class: 'stat-card' })
      if (section.label) wrap.appendChild(el('div', { class: 'stat-label' }, [text(section.label)]))
      const value = el('div', { class: 'stat-value' })
      wrap.appendChild(value)
      const update = next => { value.textContent = formatValue(next, section.format || 'plain') }
      if (isBinding(section.value)) subscribe(section.value.$bind, update)
      else update(section.value)
      return wrap
    },
  }

  return encodings
}

function renderListItem(item, ordered) {
  const li = document.createElement('li')
  if (typeof item === 'string') {
    li.textContent = item
    return li
  }
  if (!item || typeof item !== 'object') {
    li.textContent = String(item ?? '')
    return li
  }
  if (item.__html) li.innerHTML = item.__html
  else li.textContent = item.text || ''
  const children = item.__children || item.children
  if (Array.isArray(children) && children.length > 0) {
    const tag = ordered ? 'ol' : 'ul'
    const nested = el(tag)
    for (const child of children) nested.appendChild(renderListItem(child, ordered))
    li.appendChild(nested)
  }
  return li
}

function renderInput(section) {
  const spec = getCellSpec(section.bind)
  if (!spec) return errorNode(`input.bind references undeclared state cell: ${section.bind}`)
  const wrap = el('div', { class: 'input-control' })
  wrap.appendChild(el('label', { for: 'cell-' + section.bind }, [text(section.label || spec.label || section.bind)]))
  let input
  if (spec.type === 'number') {
    input = document.createElement('input')
    input.type = 'number'
    input.id = 'cell-' + section.bind
    input.value = getCell(section.bind)
    if (spec.min !== undefined) input.min = spec.min
    if (spec.max !== undefined) input.max = spec.max
    if (spec.step !== undefined) input.step = spec.step
    input.addEventListener('input', () => {
      const value = input.value === '' ? null : parseFloat(input.value)
      setCell(section.bind, Number.isFinite(value) ? value : 0)
    })
  } else if (spec.type === 'text') {
    input = document.createElement('input')
    input.type = 'text'
    input.id = 'cell-' + section.bind
    input.value = getCell(section.bind) ?? ''
    input.addEventListener('input', () => setCell(section.bind, input.value))
  } else if (spec.type === 'boolean') {
    input = document.createElement('input')
    input.type = 'checkbox'
    input.id = 'cell-' + section.bind
    input.checked = !!getCell(section.bind)
    input.addEventListener('change', () => setCell(section.bind, input.checked))
  } else if (spec.type === 'select') {
    input = document.createElement('select')
    input.id = 'cell-' + section.bind
    for (const option of spec.options || []) {
      const node = el('option', { value: option }, [text(option)])
      if (getCell(section.bind) === option) node.selected = true
      input.appendChild(node)
    }
    input.addEventListener('change', () => setCell(section.bind, input.value))
  } else {
    return errorNode(`input: unsupported cell type ${spec.type}`)
  }
  wrap.appendChild(input)
  return wrap
}
