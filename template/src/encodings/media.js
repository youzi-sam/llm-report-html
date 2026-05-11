import { el, errorNode, text } from '../dom.js'

export function createMediaEncodings({ diagramPalette, diagramRenderers }) {
  return {
    diagram: section => {
      const wrap = el('div', { class: `diagram-block diagram-${section.kind || 'unknown'}` })
      const renderer = diagramRenderers[section.kind]
      if (!renderer) {
        wrap.appendChild(errorNode(`diagram: unknown kind "${section.kind}"`))
        return wrap
      }
      wrap.appendChild(renderer(section, diagramPalette))
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
  }
}
