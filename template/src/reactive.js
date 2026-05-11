// Reactive runtime — turns the document's cells into a
// dependency graph with topological recompute on input changes.
//
// API:
//   initReactive(doc)            — read cells, init values, build graph
//   getCell(name)                — current value
//   getCellSpec(name)            — input cell schema (type, min, max, ...)
//   setCell(name, value)         — write input; cascades to dependents + DOM
//   subscribe(name, fn)          — register DOM-update callback for a cell
//   isBinding(v)                 — is value an {$bind: ...} reference?
//
// Design: cells live in a single global namespace. Layout containers do NOT
// scope cells. If two calculators share the same report, they share the same
// cell namespace.
//
const state = Object.create(null)
const formulas = Object.create(null)
const cellSpecs = Object.create(null)
const dependents = new Map()   // cellName -> Set<dependentName>
const subscribers = new Map()  // cellName -> Set<fn>
const operators = globalThis.LRH_OPERATORS || Object.create(null)

export function initReactive(doc) {
  reset()
  for (const [name, spec] of Object.entries(doc.cells || {})) {
    if (spec.kind === 'input') {
      cellSpecs[name] = spec
      state[name] = spec.default
    } else if (spec.kind === 'computed') {
      formulas[name] = spec.expr
    }
  }
  for (const [name, expr] of Object.entries(formulas)) {
    for (const dep of collectCellRefs(expr)) {
      ensureDependents(dep).add(name)
    }
  }
  recomputeAll()
}

function reset() {
  clearObject(state)
  clearObject(formulas)
  clearObject(cellSpecs)
  dependents.clear()
  subscribers.clear()
}

function clearObject(target) {
  for (const key of Object.keys(target)) delete target[key]
}

function ensureDependents(name) {
  if (!dependents.has(name)) dependents.set(name, new Set())
  return dependents.get(name)
}

function collectCellRefs(expr, out = new Set()) {
  if (Array.isArray(expr)) {
    for (const item of expr) collectCellRefs(item, out)
    return out
  }
  if (expr && typeof expr === 'object') {
    if (typeof expr.cell === 'string') out.add(expr.cell)
    if (Array.isArray(expr.args)) {
      for (const arg of expr.args) collectCellRefs(arg, out)
    }
  }
  return out
}

function recomputeAll() {
  const cache = new Set()
  for (const name of Object.keys(formulas)) {
    computeCell(name, cache, new Set())
  }
}

function computeCell(name, cache = new Set(), stack = new Set()) {
  if (!(name in formulas)) return state[name]
  if (cache.has(name)) return state[name]
  if (stack.has(name)) throw new Error(`cells.${name}: dependency cycle`)
  stack.add(name)
  for (const dep of collectCellRefs(formulas[name])) {
    if (dep in formulas) computeCell(dep, cache, stack)
  }
  try {
    state[name] = evaluateExpr(formulas[name])
  } catch (e) {
    throw new Error(`cells.${name}.expr: ${e.message}`)
  }
  stack.delete(name)
  cache.add(name)
  return state[name]
}

function evaluateExpr(expr) {
  if (!expr || typeof expr !== 'object') return undefined
  if (Object.prototype.hasOwnProperty.call(expr, 'value')) return expr.value
  if (typeof expr.cell === 'string') return state[expr.cell]
  if (typeof expr.call === 'string') {
    const op = operators[expr.call]
    if (typeof op !== 'function') throw new Error(`operator ${expr.call} is not registered`)
    const args = Array.isArray(expr.args) ? expr.args.map(evaluateExpr) : []
    return op(...args)
  }
  return undefined
}

export function setCell(name, value) {
  if (!cellSpecs[name]) throw new Error(`setCell requires an input cell: ${name}`)
  if (state[name] === value) return
  state[name] = value
  notify(name)
  const seen = new Set()
  function recurse(n) {
    if (seen.has(n)) return
    seen.add(n)
    for (const d of dependents.get(n) || []) {
      const prev = state[d]
      const next = computeCell(d, new Set(), new Set())
      if (prev !== next) notify(d)
      recurse(d)
    }
  }
  recurse(name)
}

function notify(name) {
  const subs = subscribers.get(name)
  if (subs) for (const fn of subs) fn(state[name])
}

export function subscribe(name, fn) {
  if (!subscribers.has(name)) subscribers.set(name, new Set())
  subscribers.get(name).add(fn)
  fn(state[name])
}

export function getCell(name) { return state[name] }
export function getCellSpec(name) { return cellSpecs[name] }

export function isBinding(v) {
  return !!(v && typeof v === 'object' && typeof v.$bind === 'string')
}
