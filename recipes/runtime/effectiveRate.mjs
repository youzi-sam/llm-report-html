export default defineOperator({
  name: "effectiveRate",
  args: ["number", "number"],
  returns: "number",
  pure: true,
  tests: [
    { args: [360000, 43080], returns: 0.11966666666666667 },
    { args: [0, 0], returns: 0 }
  ],
  run(income, tax) {
    const value = Number(income)
    if (value === 0) return 0
    return Number(tax) / value
  }
})
