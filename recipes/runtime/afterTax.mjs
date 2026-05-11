export default defineOperator({
  name: "afterTax",
  args: ["number", "number"],
  returns: "number",
  pure: true,
  tests: [
    { args: [360000, 43080], returns: 316920 }
  ],
  run(income, tax) {
    return Number(income) - Number(tax)
  }
})
