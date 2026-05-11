import { el, errorNode, text } from '../dom.js'

export function createInteractiveEncodings({ reactive }) {
  const { getCell, getCellSpec, setCell } = reactive
  return {
    input: section => renderInput(section, { getCell, getCellSpec, setCell }),
  }
}

function renderInput(section, cells) {
  const { getCell, getCellSpec, setCell } = cells
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
