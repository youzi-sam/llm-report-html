import { el, text } from './dom.js'

export function createLayouts(renderSection) {
  return {
    accordion: section => {
      const details = el('details', section.open ? { open: '' } : {})
      details.appendChild(el('summary', {}, [text(section.summary || 'Details')]))
      const body = el('div', { class: 'report-body' })
      appendSections(body, section.sections, renderSection)
      details.appendChild(body)
      return details
    },

    tabs: section => {
      const wrap = el('div', { class: 'tabs' })
      const headers = el('div', { class: 'tab-headers' })
      const panels = el('div', { class: 'tab-panels' })
      ;(section.items || []).forEach((item, index) => {
        const button = el('button', { class: 'tab-header' + (index === 0 ? ' active' : '') }, [text(item.label || `Tab ${index + 1}`)])
        const panel = el('div', { class: 'tab-panel' + (index === 0 ? ' active' : '') })
        appendSections(panel, item.sections, renderSection)
        button.onclick = () => {
          for (const header of headers.children) header.classList.remove('active')
          for (const childPanel of panels.children) childPanel.classList.remove('active')
          button.classList.add('active')
          panel.classList.add('active')
        }
        headers.appendChild(button)
        panels.appendChild(panel)
      })
      wrap.appendChild(headers)
      wrap.appendChild(panels)
      return wrap
    },

    columns: section => {
      const items = section.items || []
      const wrap = el('div', { class: 'columns', style: `--n:${items.length}` })
      for (const item of items) {
        const column = el('div', { class: 'column' })
        appendSections(column, item.sections, renderSection)
        wrap.appendChild(column)
      }
      return wrap
    },

    aside: section => {
      const aside = el('aside', { class: 'report-aside' })
      const body = el('div', { class: 'report-body' })
      if (section.title) body.appendChild(el('div', { class: 'report-aside-title' }, [text(section.title)]))
      appendSections(body, section.sections, renderSection)
      aside.appendChild(body)
      return aside
    },
  }
}

function appendSections(parent, sections = [], renderSection) {
  for (const section of sections || []) {
    const node = renderSection(section)
    if (node) parent.appendChild(node)
  }
}
