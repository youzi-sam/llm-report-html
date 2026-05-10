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

// Analyze inspects a parsed Document plus the raw root map (needed for state /
// computed which the typed Document doesn't capture).
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
	a.analyzeComputed(getMap(root, "computed"))
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
	for n := range getMap(root, "state") {
		a.declared[n] = "state"
	}
	for n := range getMap(root, "computed") {
		a.declared[n] = "computed"
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
	for name, kind := range a.declared {
		if !a.referenced[name] {
			a.addWarning(kind+"."+name, "unused-cell", "declared but never referenced")
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
