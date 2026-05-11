# Composition: the 4 meta-questions

The skill enforces **4 non-skippable questions** before any JSON is written. They are not "design steps" — they are **gatekeepers**: each has a legal answer of "don't write this report".

This document elaborates each, gives good vs bad answers, and shows what surface choices fall out when each is answered well.

---

## Q1. PURPOSE — What does the reader do differently after reading?

The legal answers are: **decide X / stop Y / confirm Z / start doing W**.
The illegal (filler) answers: "be informed / learn about / understand the topic".

If the only honest answer is "be informed", the reader didn't need a report — they need 3 sentences. **Push back on the request** or shrink the deliverable.

### Examples

| Bad answer | Why it fails | Good answer |
|---|---|---|
| "Reader learns about WordPress" | Pure consumption; no behavior change | "Reader decides whether to keep using WP for new projects in 2026" |
| "Reader sees Q1 status" | Receipt, not action | "Reader prioritizes which two of five red areas to escalate" |
| "Reader understands tax brackets" | Information without commitment | "Reader can plug in their income and decide whether to defer bonus to next year" |

### What this drives

- **Strong PURPOSE** → opening `callout` summarizing the action being made possible
- **PURPOSE = decide between A/B** → `columns` of A and B with `callout` summarizing recommendation
- **PURPOSE = compute X for me** → `cells` + `input` + `stat` + JS operator module when logic is non-trivial
- **PURPOSE = stay informed** → reconsider; this might not need a report

---

## Q2. TENSION — What's contested, surprising, or decision-forcing?

Reports without tension are summaries. Summaries belong in plaintext / memo / chat. **The act of producing an HTML report implies the content has friction worth the visual investment.**

### Examples

| Bad ("no tension") | Good (tension is identified) |
|---|---|
| "WordPress has many users" | "WordPress is hated by developers but undefeatable in market share — why?" |
| "We shipped 5 features in Q1" | "Two features over-delivered, one missed badly; here's what to take from each" |
| "Tax brackets are complex" | "The 'right' bracket to land in depends on whether you take a bonus this year — interactively explorable below" |

### What this drives

- **Pro / con tension** → `columns` with two `callout`s, NOT sequential paragraphs
- **Counter-intuitive finding** → opening `callout` (`kind: "info"` or `"warn"`) leading the report
- **Multi-stakeholder tension** → `tabs` (developer view / business view / user view)
- **No tension found** → don't write a report

---

## Q3. STRONGEST × WEAKEST — The two sentences (separately!)

Forces epistemic honesty. Many drafts hide weakness in qualifications scattered across paragraphs. Pulling out the **single strongest claim** and the **single weakest link** separately exposes both.

### Examples

| Topic | STRONGEST (1 sentence) | WEAKEST (1 sentence) |
|---|---|---|
| WP popularity | "Six structural conditions intersect; alternatives that drop any one have failed" | "Market share data has ±1% monthly noise; the 'hire-ability' claim is anecdotal" |
| Q1 status | "Latency improved 30% across all P95 endpoints" | "Improvement attributed to caching but causation unverified — could be traffic mix" |
| Tax calculator | "Brackets reflect 2025 official rates" | "Provincial supplements not modeled; assumes single income source" |

### What this drives

- STRONGEST → **opening `callout` (`kind: "success"` or `"info"`)** with the claim verbatim
- WEAKEST → **`aside` or `callout` (`kind: "warn"`) at end** — visible but visually demoted
- Strongest and weakest both required — **not having a weakest is a sign of overclaiming**
- If WEAKEST is "I'm padding because I don't know" — stop and either research or shrink scope

---

## Q4. CUT TEST — Delete 80%, what 20% remains?

The 20% is your beat list. Most "long" reports become shorter ones with the same impact when this is done honestly.

### Examples

| Original draft | After cut test (the 20%) |
|---|---|
| 12 sections on "why WP popular" | 6 named conditions + 1 alternative-failure cross-check |
| 18 features in release notes | 3 game-changers + table of others |
| 25-step migration tutorial | 5 critical steps + FAQ for edge cases |

### What this drives

Once you have the 20% beats, surface choice **falls out** — there's almost no decision left to make:

| Beat shape | Surface |
|---|---|
| A number / metric | `stat` (in `columns` if multiple) |
| A comparison (A vs B) | `columns` with two `callout`s, or `table` |
| A sequence in time | `timeline` |
| A relation / process | `diagram` |
| A formula / derivation | `math` |
| A deep dive most readers skip | `details` (default folded) |
| An attributed claim | `quote` (with `by`) |
| Q & A pairs | `faq` |
| Term + explanation pairs (3+) | `definition` |
| A side-note that's true but not central | `aside` |
| A controlled what-if | `cells` + `input` + `stat` |

**5-surface floor**: if your draft ends up using fewer than 5 distinct surface types, you compressed too little — go back to Q4 and re-cut. Default to `paragraph` after `paragraph` is the markdown trap.

---

## Worked example: "Why is WordPress popular?"

| Question | Answer |
|---|---|
| **PURPOSE** | Reader decides whether to bet on WP for a new project in 2026 |
| **TENSION** | WP is technically dated yet undefeatable; competitors with cleaner stacks have failed; why? |
| **STRONGEST** | "Six structural conditions intersect (GPL, low-stack, dual ecosystem, back-compat, hosting, hiring); each alternative dropping any one failed" |
| **WEAKEST** | "Causation between the six conditions and dominance is correlational; can't run a counterfactual" |
| **CUT** | (1) market share stats → 4 stats in columns. (2) 6 conditions → `definition`. (3) failed alternatives → `tabs` per alternative. (4) honest caveats → `aside`. (5) recommendation → final `callout`. |

Resulting surfaces used: `callout` × 2, `stat` × 4, `columns`, `definition`, `tabs`, `aside`, `paragraph` (sparingly). 7+ surface types, no two adjacent `heading`+`paragraph` pairs.

Compare to the markdown-trap version (single `narrative-report` template copy): mostly `heading` + `paragraph` × 12, one `diagram`, one `table`. 5 surface types, but 24 sections. Visually flat. Same content, dramatically worse.

---

## Anti-patterns

- **"I don't know the answer to Q1 yet, I'll just write and figure it out"** → No. Stop. Either ask or push back.
- **"My PURPOSE is to demonstrate the tool"** → Then make a `recipe show calculator`-style demo, not a content report.
- **"I have tension but no weakness"** → You're overclaiming. Find one or you'll lose the reader.
- **"My CUT TEST returns ~95% of the original"** → You didn't compress; you justified. Try again, harsher.
- **"Surface choice still feels arbitrary after answering all 4"** → Re-read Q4's table; map each beat literally.

---

## When to re-run the worksheet mid-draft

If during writing you notice:
- Surface count dropping below 5 → re-do Q4
- Adding 3+ adjacent `heading`+`paragraph` pairs → re-do Q4 (those want to be `details` × N)
- A claim feeling shaky → re-do Q3 (move to `aside` or strengthen)
- "Why does the reader care about this paragraph" → re-do Q1; if still no answer, delete

The worksheet is iterative, not one-shot.
