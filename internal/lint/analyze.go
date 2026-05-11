package lint

import (
	"encoding/json"
	"fmt"

	"github.com/yansir/llm-report-html/internal/schema"
)

type analysis struct {
	declared   map[string]string
	referenced map[string]bool
	report     Report
}

// Analyze inspects a parsed Document plus the raw root map (needed for cells
// which the typed Document doesn't capture).
func Analyze(raw []byte) (Report, error) {
	var root map[string]interface{}
	if err := json.Unmarshal(raw, &root); err != nil {
		return Report{}, fmt.Errorf("not valid JSON: %w", err)
	}
	doc, err := schema.ParseAndValidate(raw)
	if err != nil {
		return Report{}, err
	}

	a := newAnalysis(root)
	a.analyzeCells(getMap(root, "cells"))
	walkSections(doc.Sections, "sections", a.analyzeSection)
	a.warnUnusedCells()
	a.sort()
	return a.report, nil
}

func newAnalysis(root map[string]interface{}) *analysis {
	a := &analysis{
		declared:   make(map[string]string),
		referenced: make(map[string]bool),
	}
	for n, raw := range getMap(root, "cells") {
		spec, _ := raw.(map[string]interface{})
		kind, _ := spec["kind"].(string)
		if kind != "" {
			a.declared[n] = kind
		}
	}
	return a
}

func (a *analysis) addError(path, rule, msg string) {
	a.report.Errors = append(a.report.Errors, Finding{Path: path, Rule: rule, Msg: msg})
}

func (a *analysis) addWarning(path, rule, msg string) {
	a.report.Warnings = append(a.report.Warnings, Finding{Path: path, Rule: rule, Msg: msg})
}

func (a *analysis) requireDeclared(path, name, msg string) bool {
	a.referenced[name] = true
	if _, ok := a.declared[name]; !ok {
		a.addError(path, "undeclared-cell", fmt.Sprintf(msg, name))
		return false
	}
	return true
}

func (a *analysis) warnUnusedCells() {
	for name := range a.declared {
		if !a.referenced[name] {
			a.addWarning("cells."+name, "unused-cell", "declared but never referenced")
		}
	}
}

func (a *analysis) sort() {
	sortFindings(a.report.Errors)
	sortFindings(a.report.Warnings)
}

func getMap(root map[string]interface{}, key string) map[string]interface{} {
	if v, ok := root[key].(map[string]interface{}); ok {
		return v
	}
	return nil
}
