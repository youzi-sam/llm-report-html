import { el, formatValue, text } from '../dom.js'
import { renderItems, renderRowsHTML, setTrustedHTML, setTrustedHTMLString } from '../renderData.js'

export function createDataEncodings({ reactive }) {
  const { isBinding, subscribe } = reactive
  return {
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
      for (const row of renderRowsHTML(section)) {
        const tr = el('tr')
        for (const cell of row) {
          const td = document.createElement('td')
          setTrustedHTMLString(td, cell)
          tr.appendChild(td)
        }
        tbody.appendChild(tr)
      }
      table.appendChild(tbody)
      return table
    },

    timeline: section => {
      const list = el('ul', { class: 'timeline' })
      for (const item of renderItems(section)) {
        const li = document.createElement('li')
        li.appendChild(el('span', { class: 'date' }, [text(item.date || '')]))
        const body = document.createElement('span')
        setTrustedHTML(body, item, 'textHtml')
        li.appendChild(body)
        list.appendChild(li)
      }
      return list
    },

    definition: section => {
      const list = el('dl', { class: 'report-dl' })
      for (const item of renderItems(section)) {
        list.appendChild(el('dt', {}, [text(item.term || '')]))
        const definition = document.createElement('dd')
        setTrustedHTML(definition, item, 'defHtml')
        list.appendChild(definition)
      }
      return list
    },

    faq: section => {
      const wrap = el('div', { class: 'faq' })
      for (const item of renderItems(section)) {
        const details = el('details')
        details.appendChild(el('summary', {}, [text('Q: ' + (item.q || ''))]))
        const answer = document.createElement('div')
        setTrustedHTML(answer, item, 'aHtml')
        details.appendChild(answer)
        wrap.appendChild(details)
      }
      return wrap
    },

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
}
