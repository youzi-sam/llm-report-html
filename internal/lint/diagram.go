package lint

import (
	"fmt"
)

func (a *analysis) analyzeDiagram(s map[string]interface{}, path string) {
	switch kind, _ := s["kind"].(string); kind {
	case "flow":
		a.analyzeFlowDiagram(s, path)
	case "state":
		a.analyzeStateDiagram(s, path)
	case "er":
		a.analyzeERDiagram(s, path)
	}
}

func (a *analysis) analyzeFlowDiagram(s map[string]interface{}, path string) {
	ids := map[string]bool{}
	if nodes, ok := s["nodes"].([]interface{}); ok {
		for _, n := range nodes {
			if nm, ok := n.(map[string]interface{}); ok {
				if id, _ := nm["id"].(string); id != "" {
					ids[id] = true
				}
			}
		}
	}

	if edges, ok := s["edges"].([]interface{}); ok {
		for i, e := range edges {
			em, ok := e.(map[string]interface{})
			if !ok {
				continue
			}
			for _, end := range []string{"from", "to"} {
				ref, _ := em[end].(string)
				if ref != "" && !ids[ref] {
					a.addError(
						fmt.Sprintf("%s.edges[%d].%s", path, i, end),
						"undeclared-node",
						fmt.Sprintf("edge references node id %q which is not declared in nodes[]", ref),
					)
				}
			}
		}
	}
}

func (a *analysis) analyzeStateDiagram(s map[string]interface{}, path string) {
	ids := map[string]bool{}
	if states, ok := s["states"].([]interface{}); ok {
		for _, n := range states {
			if nm, ok := n.(map[string]interface{}); ok {
				if id, _ := nm["id"].(string); id != "" {
					ids[id] = true
				}
			}
		}
	}

	check := func(loc, ref string) {
		if ref != "" && !ids[ref] {
			a.addError(
				loc,
				"undeclared-node",
				fmt.Sprintf("references state id %q which is not declared in states[]", ref),
			)
		}
	}

	if init, _ := s["initial"].(string); init != "" {
		check(path+".initial", init)
	}
	if finals, ok := s["final"].([]interface{}); ok {
		for i, f := range finals {
			if id, _ := f.(string); id != "" {
				check(fmt.Sprintf("%s.final[%d]", path, i), id)
			}
		}
	}
	if trs, ok := s["transitions"].([]interface{}); ok {
		for i, t := range trs {
			tm, ok := t.(map[string]interface{})
			if !ok {
				continue
			}
			for _, end := range []string{"from", "to"} {
				ref, _ := tm[end].(string)
				check(fmt.Sprintf("%s.transitions[%d].%s", path, i, end), ref)
			}
		}
	}
}

func (a *analysis) analyzeERDiagram(s map[string]interface{}, path string) {
	ids := map[string]bool{}
	if entities, ok := s["entities"].([]interface{}); ok {
		for _, e := range entities {
			em, ok := e.(map[string]interface{})
			if !ok {
				continue
			}
			if id, _ := em["id"].(string); id != "" {
				ids[id] = true
			}
		}
	}

	if relationships, ok := s["relationships"].([]interface{}); ok {
		for i, rel := range relationships {
			rm, ok := rel.(map[string]interface{})
			if !ok {
				continue
			}
			for _, end := range []string{"from", "to"} {
				ref, _ := rm[end].(string)
				if ref != "" && !ids[ref] {
					a.addError(
						fmt.Sprintf("%s.relationships[%d].%s", path, i, end),
						"undeclared-entity",
						fmt.Sprintf("relationship references entity id %q which is not declared in entities[]", ref),
					)
				}
			}
		}
	}
}
