// Curated JSONLogic operators that match common Agent intents.
// Each operator collapses what would be 5-15 lines of nested logic into
// a single high-level call.
//
// Adding a new operator: register here + add metadata in schema/v2.json
// under x-jsonlogic-operators (so `llm-report-html schema --operators` lists it).

export function registerOperators(jsonLogic) {

  // ── progressive_bracket(value, [[ceiling, rate, deduction], ...]) ──────
  //   For tiered/progressive lookups (tax brackets, shipping tiers, etc.)
  //   Example: { "progressive_bracket": [{"var":"income"},
  //               [[36000,0.03,0], [144000,0.10,2520], ...]] }
  jsonLogic.add_operation('progressive_bracket', (value, brackets) => {
    if (!Array.isArray(brackets)) return null
    const v = Number(value)
    if (!Number.isFinite(v)) return null
    for (const row of brackets) {
      const [ceiling, rate, deduction = 0] = row
      if (v <= ceiling) return v * rate - deduction
    }
    // Last bracket has no ceiling — apply final rate
    const last = brackets[brackets.length - 1]
    if (last) {
      const [, rate, deduction = 0] = last
      return v * rate - deduction
    }
    return 0
  })

  // ── lookup_table(key, [[match, result], ..., [null, default]]) ─────────
  //   VLOOKUP-style discrete lookup. Last row with null match is the default.
  jsonLogic.add_operation('lookup_table', (key, table) => {
    if (!Array.isArray(table)) return null
    let dflt = null
    for (const row of table) {
      const [match, result] = row
      if (match === null) { dflt = result; continue }
      if (match === key) return result
    }
    return dflt
  })

  // ── clamp(value, min, max) ─────────────────────────────────────────────
  jsonLogic.add_operation('clamp', (value, min, max) => {
    const v = Number(value)
    if (!Number.isFinite(v)) return null
    return Math.min(Math.max(v, Number(min)), Number(max))
  })

  // ── round(value, digits=0) ─────────────────────────────────────────────
  jsonLogic.add_operation('round', (value, digits) => {
    const v = Number(value)
    if (!Number.isFinite(v)) return null
    const d = Number(digits) || 0
    const k = 10 ** d
    return Math.round(v * k) / k
  })

  // ── format_currency(value, symbol='¥', digits=2) ───────────────────────
  jsonLogic.add_operation('format_currency', (value, symbol, digits) => {
    const v = Number(value)
    if (!Number.isFinite(v)) return ''
    return (symbol || '¥') + v.toLocaleString('zh-CN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits == null ? 2 : Number(digits),
    })
  })

  // ── format_percent(value, digits=1) ────────────────────────────────────
  //   Multiplies by 100 (so 0.15 → "15.0%").
  jsonLogic.add_operation('format_percent', (value, digits) => {
    const v = Number(value)
    if (!Number.isFinite(v)) return ''
    return (v * 100).toFixed(digits == null ? 1 : Number(digits)) + '%'
  })

  // ── format_date(value, fmt='YYYY-MM-DD') ───────────────────────────────
  //   Accepts ISO date string or millisecond timestamp.
  //   Tokens: YYYY MM DD HH mm ss
  jsonLogic.add_operation('format_date', (value, fmt) => {
    if (value == null || value === '') return ''
    const d = new Date(value)
    if (isNaN(d.getTime())) return String(value)
    const pad = n => String(n).padStart(2, '0')
    const tokens = {
      YYYY: d.getFullYear(),
      MM:   pad(d.getMonth() + 1),
      DD:   pad(d.getDate()),
      HH:   pad(d.getHours()),
      mm:   pad(d.getMinutes()),
      ss:   pad(d.getSeconds()),
    }
    return (fmt || 'YYYY-MM-DD').replace(/YYYY|MM|DD|HH|mm|ss/g, t => tokens[t])
  })

  // ── date_diff_days(a, b) ───────────────────────────────────────────────
  //   Whole-day difference between two dates (a - b).
  jsonLogic.add_operation('date_diff_days', (a, b) => {
    const da = new Date(a), db = new Date(b)
    if (isNaN(da.getTime()) || isNaN(db.getTime())) return null
    return Math.floor((da - db) / 86400000)
  })

}
