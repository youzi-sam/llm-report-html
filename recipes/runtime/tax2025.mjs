const brackets = [
  [36000, 0.03, 0],
  [144000, 0.10, 2520],
  [300000, 0.20, 16920],
  [420000, 0.25, 31920],
  [660000, 0.30, 52920],
  [960000, 0.35, 85920],
  [99999999, 0.45, 181920]
]

export default defineOperator({
  name: "tax2025",
  args: ["number"],
  returns: "number",
  pure: true,
  tests: [
    { args: [300000], returns: 43080 },
    { args: [36000], returns: 1080 },
    { args: [0], returns: 0 }
  ],
  run(taxable) {
    const value = Number(taxable)
    for (const row of brackets) {
      const [ceiling, rate, deduction] = row
      if (value <= ceiling) return value * rate - deduction
    }
    const last = brackets[brackets.length - 1]
    return value * last[1] - last[2]
  }
})
