import { el, slug, text } from '../dom.js'
import { renderChildren, renderItems, setTrustedHTML, trustedHTMLBlock } from '../renderData.js'

export function createTextEncodings() {
  return {
    heading: section => {
      const tag = `h${Math.min(Math.max(section.level || 2, 1), 4)}`
      return el(tag, { id: slug(section.text) }, [text(String(section.text ?? ''))])
    },

    paragraph: section => trustedHTMLBlock(section, 'html'),

    quote: section => {
      const block = el('blockquote')
      block.appendChild(trustedHTMLBlock(section, 'textHtml', 'p'))
      if (section.by) block.appendChild(el('footer', {}, [text('— ' + section.by)]))
      return block
    },

    code: section => {
      const pre = el('pre', { class: 'code-block' })
      const classes = ['ch-chroma']
      if (section.lang) classes.push(`lang-${section.lang}`)
      const code = el('code', { class: classes.join(' ') })
      setTrustedHTML(code, section, 'html')
      pre.appendChild(code)
      return pre
    },

    math: section => {
      const block = el('div', { class: 'math-block' })
      setTrustedHTML(block, section, 'html')
      return block
    },

    divider: () => el('hr'),

    list: section => {
      const tag = section.ordered ? 'ol' : 'ul'
      const list = el(tag)
      for (const item of renderItems(section)) list.appendChild(renderListItem(item, section.ordered))
      return list
    },

    callout: section => {
      const node = el('div', { class: `callout ${section.kind || 'info'}` })
      if (section.title) node.appendChild(el('div', { class: 'callout-title' }, [text(String(section.title))]))
      node.appendChild(trustedHTMLBlock(section, 'html'))
      return node
    },
  }
}

function renderListItem(item, ordered) {
  const li = document.createElement('li')
  if (!item || typeof item !== 'object') {
    li.textContent = String(item ?? '')
    return li
  }
  setTrustedHTML(li, item, 'html')
  const children = renderChildren(item)
  if (children.length > 0) {
    const tag = ordered ? 'ol' : 'ul'
    const nested = el(tag)
    for (const child of children) nested.appendChild(renderListItem(child, ordered))
    li.appendChild(nested)
  }
  return li
}
