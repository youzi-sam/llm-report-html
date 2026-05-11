const scores = [
  { name: "Alice", score: 92 },
  { name: "Bob", score: 78 },
  { name: "Cathy", score: 65 },
  { name: "Dan", score: 88 },
  { name: "Eve", score: 71 },
  { name: "Frank", score: 54 }
]

export default defineOperator({
  name: "passingCount",
  args: ["number"],
  returns: "number",
  pure: true,
  tests: [
    { args: [70], returns: 4 },
    { args: [90], returns: 1 }
  ],
  run(minScore) {
    const threshold = Number(minScore)
    return scores.filter(row => row.score >= threshold).length
  }
})
