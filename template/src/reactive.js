// Reactive runtime — turns the document's state + computed cells into a
// dependency graph with topological recompute on input changes.
//
// API:
//   initReactive(doc)            — read state/computed, init values, build graph
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
// Higher-level binding resolution (template strings, deep object walking)
// lives in template/src/sectionRenderer.js. Earlier per-encoding binding
// helpers (bindTextField, resolveValue, hasTextBindings) were retired with
// that refactor.
import jsonLogic from 'json-logic-js'
import { registerOperators } from './operators.js'

registerOperators(jsonLogic)

const state = Object.create(null)
const formulas = Object.create(null)
const cellSpecs = Object.create(null)
const dependents = new Map()   // cellName -> Set<dependentName>
const subscribers = new Map()  // cellName -> Set<fn>

export function initReactive(doc) {
  // 1. seed input cells with defaults
  for (const [name, spec] of Object.entries(doc.state || {})) {
    cellSpecs[name] = spec
    state[name] = spec.default
  }
  // 2. record formulas + dependency edges
  for (const [name, formula] of Object.entries(doc.computed || {})) {
    formulas[name] = formula
    for (const dep of collectVars(formula)) {
      if (!dependents.has(dep)) dependents.set(dep, new Set())
      dependents.get(dep).add(name)
    }
  }
  // 3. initial fixed-point compute
  recomputeAll()
}

function collectVars(expr, out = new Set()) {
  if (Array.isArray(expr)) { for (const x of expr) collectVars(x, out); return out }
  if (expr && typeof expr === 'object') {
    if ('var' in expr) {
      const v = expr.var
      const name = Array.isArray(v) ? v[0] : v
      if (typeof name === 'string') out.add(name.split('.')[0])
      return out
    }
    for (const v of Object.values(expr)) collectVars(v, out)
  }
  return out
}

function recomputeAll() {
  // Repeated pass; converges in #computed iterations or fewer for any
  // acyclic dep graph. Cycle protection: bound iterations.
  for (let i = 0; i < Object.keys(formulas).length + 2; i++) {
    let changed = false
    for (const [name, formula] of Object.entries(formulas)) {
      const next = safeApply(formula)
      if (state[name] !== next) { state[name] = next; changed = true }
    }
    if (!changed) break
  }
}

function safeApply(formula) {
  try { return jsonLogic.apply(formula, state) }
  catch (e) {
    console.warn('jsonLogic apply failed', formula, e)
    return null
  }
}

export function setCell(name, value) {
  if (state[name] === value) return
  state[name] = value
  notify(name)
  // cascade to dependents
  const seen = new Set()
  function recurse(n) {
    if (seen.has(n)) return
    seen.add(n)
    for (const d of dependents.get(n) || []) {
      const next = safeApply(formulas[d])
      if (state[d] !== next) {
        state[d] = next
        notify(d)
      }
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
