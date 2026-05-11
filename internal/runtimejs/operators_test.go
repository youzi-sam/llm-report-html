package runtimejs

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCompileOperatorModule(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "tax2025.mjs"), `const rate = 0.03
export default defineOperator({
  name: "tax2025",
  args: ["number"],
  returns: "number",
  pure: true,
  tests: [{ args: [1000], returns: 30 }],
  run(income) {
    return income * rate
  }
})`)
	doc := `{
  "runtime": { "operators": ["./tax2025.mjs"] },
  "cells": {
    "income": { "kind": "input", "type": "number", "default": 1000 },
    "tax": { "kind": "computed", "type": "number", "expr": { "call": "tax2025", "args": [{ "cell": "income" }] } }
  },
  "sections": [{ "type": "stat", "label": "Tax", "value": { "$bind": "tax" } }]
}`
	bundle, err := Compile([]byte(doc), filepath.Join(dir, "report.json"))
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := bundle.Operators["tax2025"]; !ok {
		t.Fatalf("missing compiled operator: %#v", bundle.Operators)
	}
	if !strings.Contains(bundle.Script, `registry["tax2025"]`) || !strings.Contains(bundle.Script, "income * rate") {
		t.Fatalf("operator script did not preserve implementation: %s", bundle.Script)
	}
}

func TestCompileRejectsUnknownExpressionOperator(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "tax2025.mjs"), `export default defineOperator({
  name: "tax2025",
  args: ["number"],
  returns: "number",
  pure: true,
  tests: [{ args: [1000], returns: 30 }],
  run(income) { return income * 0.03 }
})`)
	doc := `{
  "runtime": { "operators": ["./tax2025.mjs"] },
  "cells": {
    "income": { "kind": "input", "type": "number", "default": 1000 },
    "tax": { "kind": "computed", "type": "number", "expr": { "call": "missing", "args": [{ "cell": "income" }] } }
  },
  "sections": [{ "type": "stat", "value": { "$bind": "tax" } }]
}`
	_, err := Compile([]byte(doc), filepath.Join(dir, "report.json"))
	if err == nil || !strings.Contains(err.Error(), `operator "missing"`) {
		t.Fatalf("expected unknown operator error, got %v", err)
	}
}

func TestCompileRejectsForbiddenRuntimeReferences(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "bad.mjs"), `export default defineOperator({
  name: "bad",
  args: ["number"],
  returns: "number",
  pure: true,
  tests: [{ args: [1], returns: 1 }],
  run(value) { fetch("/x"); return value }
})`)
	doc := `{
  "runtime": { "operators": ["./bad.mjs"] },
  "sections": [{ "type": "paragraph", "text": "x" }]
}`
	_, err := Compile([]byte(doc), filepath.Join(dir, "report.json"))
	if err == nil || !strings.Contains(err.Error(), "forbidden runtime reference") {
		t.Fatalf("expected forbidden reference error, got %v", err)
	}
}

func TestCompileRunsOperatorTests(t *testing.T) {
	dir := t.TempDir()
	write(t, filepath.Join(dir, "bad.mjs"), `export default defineOperator({
  name: "bad",
  args: ["number"],
  returns: "number",
  pure: true,
  tests: [{ args: [2], returns: 5 }],
  run(value) { return value * 2 }
})`)
	doc := `{
  "runtime": { "operators": ["./bad.mjs"] },
  "sections": [{ "type": "paragraph", "text": "x" }]
}`
	_, err := Compile([]byte(doc), filepath.Join(dir, "report.json"))
	if err == nil || !strings.Contains(err.Error(), "returns mismatch") {
		t.Fatalf("expected test mismatch error, got %v", err)
	}
}

func write(t *testing.T, path, body string) {
	t.Helper()
	if err := os.WriteFile(path, []byte(body), 0644); err != nil {
		t.Fatal(err)
	}
}
