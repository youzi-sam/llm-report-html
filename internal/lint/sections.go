package lint

import (
	"fmt"
	"regexp"
	"strings"
)

type sectionRef struct {
	path string
	body map[string]interface{}
}

var bindingRE = regexp.MustCompile(`\{\$bind:(\w+)\}`)

func (a *analysis) analyzeSection(sec sectionRef) {
	s := sec.body
	path := sec.path
	t, _ := s["type"].(string)

	a.checkIfBinding(s, path)
	a.checkArrayBindings(s, path)

	switch t {
	case "input":
		a.checkInputBind(s, path)
	case "stat":
		a.checkStatBind(s, path)
	case "tabs", "columns":
		a.warnTrivialLayout(t, s, path)
	case "details", "aside":
		a.warnEmptyContainer(t, s, path)
	case "callout":
		a.warnEmptyCallout(s, path)
	case "diagram":
		a.analyzeDiagram(s, path)
	}

	a.checkTextBindings(s, path)
}

func (a *analysis) checkIfBinding(s map[string]interface{}, path string) {
	if v, ok := s["if"]; ok {
		if m, ok := v.(map[string]interface{}); ok {
			if b, ok := m["$bind"].(string); ok {
				a.requireDeclared(path+".if", b, `references undeclared cell %q`)
			}
		}
	}
}

func (a *analysis) checkArrayBindings(s map[string]interface{}, path string) {
	for _, f := range []string{"items", "rows", "columns"} {
		if m, ok := s[f].(map[string]interface{}); ok {
			if b, ok := m["$bind"].(string); ok {
				a.requireDeclared(path+"."+f+".$bind", b, `array binding references undeclared cell %q`)
			}
		}
	}
}

func (a *analysis) checkInputBind(s map[string]interface{}, path string) {
	b, ok := s["bind"].(string)
	if !ok {
		return
	}
	if !a.requireDeclared(path+".bind", b, `references undeclared cell %q`) {
		return
	}
	if kind := a.declared[b]; kind != "state" {
		a.addError(
			path+".bind",
			"input-bind-kind",
			fmt.Sprintf("input.bind must reference a state cell, got %s cell %q", kind, b),
		)
	}
}

func (a *analysis) checkStatBind(s map[string]interface{}, path string) {
	m, ok := s["value"].(map[string]interface{})
	if !ok {
		return
	}
	if b, ok := m["$bind"].(string); ok {
		a.requireDeclared(path+".value.$bind", b, `references undeclared cell %q`)
	}
}

func (a *analysis) warnTrivialLayout(t string, s map[string]interface{}, path string) {
	items, _ := s["items"].([]interface{})
	if len(items) < 2 {
		a.addWarning(path, "trivial-layout", fmt.Sprintf("%s with %d item(s); a single-item %s adds no value", t, len(items), t))
	}
}

func (a *analysis) warnEmptyContainer(t string, s map[string]interface{}, path string) {
	subs, _ := s["sections"].([]interface{})
	if len(subs) == 0 {
		a.addWarning(path+".sections", "empty-container", fmt.Sprintf("%s has no nested sections", t))
	}
}

func (a *analysis) warnEmptyCallout(s map[string]interface{}, path string) {
	if txt, _ := s["text"].(string); strings.TrimSpace(txt) == "" {
		a.addWarning(path+".text", "empty-callout", "callout has no body text — use heading if you only want a colored label, or move sibling content into text as markdown")
	}
}

func (a *analysis) checkTextBindings(s map[string]interface{}, path string) {
	for _, f := range []string{"text", "title", "summary", "label", "by", "alt", "caption"} {
		if v, ok := s[f].(string); ok {
			for _, ref := range parseTextBindings(v) {
				a.requireDeclared(path+"."+f, ref, `template references undeclared cell %q`)
			}
		}
	}
}

func parseTextBindings(s string) []string {
	matches := bindingRE.FindAllStringSubmatch(s, -1)
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		out = append(out, m[1])
	}
	return out
}

func walkSections(sections []map[string]interface{}, path string, fn func(sectionRef)) {
	for i, s := range sections {
		p := fmt.Sprintf("%s[%d]", path, i)
		fn(sectionRef{path: p, body: s})
		t, _ := s["type"].(string)
		switch t {
		case "details", "aside":
			subs, _ := s["sections"].([]interface{})
			recurseInto(subs, p+".sections", fn)
		case "tabs", "columns":
			items, _ := s["items"].([]interface{})
			for j, it := range items {
				if m, ok := it.(map[string]interface{}); ok {
					if subs, ok := m["sections"].([]interface{}); ok {
						recurseInto(subs, fmt.Sprintf("%s.items[%d].sections", p, j), fn)
					}
				}
			}
		}
	}
}

func recurseInto(raw []interface{}, path string, fn func(sectionRef)) {
	conv := make([]map[string]interface{}, 0, len(raw))
	for _, c := range raw {
		if m, ok := c.(map[string]interface{}); ok {
			conv = append(conv, m)
		}
	}
	walkSections(conv, path, fn)
}
