export default defineOperator({
  name: "taxableIncome",
  args: ["number", "number"],
  returns: "number",
  pure: true,
  tests: [
    { args: [360000, 60000], returns: 300000 },
    { args: [50000, 60000], returns: 0 }
  ],
  run(income, deduction) {
    return Math.max(Number(income) - Number(deduction), 0)
  }
})
