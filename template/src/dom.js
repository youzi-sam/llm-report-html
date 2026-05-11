export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [key, value] of Object.entries(attrs)) {
    if (value === '' || value === true) node.setAttribute(key, '')
    else if (value != null && value !== false) node.setAttribute(key, value)
  }
  for (const child of children) node.appendChild(child)
  return node
}

export function text(value) {
  return document.createTextNode(value)
}

export function errorNode(message) {
  const node = document.createElement('div')
  node.className = 'report-error'
  node.textContent = message
  return node
}

export function slug(value) {
  return String(value || '').toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '')
}

export function formatValue(value, kind) {
  if (value === null || value === undefined || value === '') return ''
  const number = Number(value)
  switch (kind) {
    case 'currency':
      return Number.isFinite(number)
        ? '¥' + number.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
        : String(value)
    case 'percent':
      return Number.isFinite(number) ? (number * 100).toFixed(1) + '%' : String(value)
    case 'number':
      return Number.isFinite(number) ? number.toLocaleString('zh-CN') : String(value)
    default:
      return String(value)
  }
}
