package html

import (
	"encoding/json"
	"fmt"
	"sort"
)

type Features struct {
	Surfaces     []string
	DiagramKinds []string
	Reactive     bool
	Formulas     bool
}

type featureSet struct {
	surfaces     map[string]bool
	diagramKinds map[string]bool
	bindings     bool
	inputs       bool
	formulas     bool
}

func AnalyzeFeatures(rawDocJSON []byte) (Features, error) {
	var root any
	if err := json.Unmarshal(rawDocJSON, &root); err != nil {
		return Features{}, fmt.Errorf("analyze features: %w", err)
	}

	set := featureSet{
		surfaces:     make(map[string]bool),
		diagramKinds: make(map[string]bool),
	}
	if m, ok := root.(map[string]any); ok {
		if computed, ok := m["computed"].(map[string]any); ok && len(computed) > 0 {
			set.formulas = true
		}
	}
	set.walk(root)

	return Features{
		Surfaces:     sortedKeys(set.surfaces),
		DiagramKinds: sortedKeys(set.diagramKinds),
		Reactive:     set.inputs || set.bindings,
		Formulas:     set.formulas && (set.inputs || set.bindings),
	}, nil
}

func (f *featureSet) walk(v any) {
	switch node := v.(type) {
	case []any:
		for _, item := range node {
			f.walk(item)
		}
	case map[string]any:
		if bind, ok := node["$bind"].(string); ok && bind != "" {
			f.bindings = true
		}
		if typ, ok := node["type"].(string); ok && typ != "" {
			f.surfaces[typ] = true
			if typ == "input" {
				f.inputs = true
			}
			if typ == "diagram" {
				if kind, ok := node["kind"].(string); ok && kind != "" {
					f.diagramKinds[kind] = true
				}
			}
		}
		for _, value := range node {
			f.walk(value)
		}
	}
}

func sortedKeys(m map[string]bool) []string {
	out := make([]string, 0, len(m))
	for k := range m {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
