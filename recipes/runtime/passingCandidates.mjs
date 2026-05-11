const scores = [
  { name: "Alice", score: 92 },
  { name: "Bob", score: 78 },
  { name: "Cathy", score: 65 },
  { name: "Dan", score: 88 },
  { name: "Eve", score: 71 },
  { name: "Frank", score: 54 }
]

export default defineOperator({
  name: "passingCandidates",
  args: ["number"],
  returns: "array",
  pure: true,
  tests: [
    { args: [80], returns: ["Alice — 92 分", "Dan — 88 分"] },
    { args: [95], returns: [] }
  ],
  run(minScore) {
    const threshold = Number(minScore)
    return scores
      .filter(row => row.score >= threshold)
      .map(row => `${row.name} — ${row.score} 分`)
  }
})
