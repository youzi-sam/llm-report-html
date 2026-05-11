package lint

import (
	"fmt"
	"sort"
)

func (a *analysis) analyzeCells(cells map[string]interface{}) {
	depGraph := make(map[string][]string)
	for name, raw := range cells {
		spec, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		path := fmt.Sprintf("cells.%s", name)
		kind, _ := spec["kind"].(string)
		switch kind {
		case "input":
			a.analyzeInputCell(path, spec)
		case "computed":
			expr := spec["expr"]
			deps := collectCellRefs(expr)
			for _, d := range deps {
				a.requireDeclared(
					path+".expr",
					d,
					`expression references undeclared cell %q`,
				)
			}
			depGraph[name] = deps
		}
	}

	for _, c := range detectCycles(depGraph) {
		a.addError(
			fmt.Sprintf("cells.%s.expr", c),
			"cycle",
			"computed cell participates in a dependency cycle",
		)
	}
}

func (a *analysis) analyzeInputCell(path string, spec map[string]interface{}) {
	typ, _ := spec["type"].(string)
	value := spec["default"]
	switch typ {
	case "number":
		if _, ok := value.(float64); !ok {
			a.addError(path+".default", "cell-default-type", "number input default must be a number")
		}
	case "text":
		if _, ok := value.(string); !ok {
			a.addError(path+".default", "cell-default-type", "text input default must be a string")
		}
	case "boolean":
		if _, ok := value.(bool); !ok {
			a.addError(path+".default", "cell-default-type", "boolean input default must be a boolean")
		}
	case "select":
		defaultValue, ok := value.(string)
		if !ok {
			a.addError(path+".default", "cell-default-type", "select input default must be a string")
			return
		}
		options, _ := spec["options"].([]interface{})
		if len(options) == 0 {
			a.addError(path+".options", "select-options", "select input requires options")
			return
		}
		found := false
		for _, option := range options {
			if option == defaultValue {
				found = true
				break
			}
		}
		if !found {
			a.addError(path+".default", "select-default", "select input default must match one of options")
		}
	}
}

func collectCellRefs(expr interface{}) []string {
	seen := make(map[string]bool)
	var walk func(interface{})
	walk = func(e interface{}) {
		switch v := e.(type) {
		case []interface{}:
			for _, item := range v {
				walk(item)
			}
		case map[string]interface{}:
			if name, ok := v["cell"].(string); ok {
				seen[name] = true
			}
			if args, ok := v["args"].([]interface{}); ok {
				for _, arg := range args {
					walk(arg)
				}
			}
		}
	}
	walk(expr)

	out := make([]string, 0, len(seen))
	for k := range seen {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func detectCycles(graph map[string][]string) []string {
	white, gray, black := 0, 1, 2
	color := make(map[string]int)
	for k := range graph {
		color[k] = white
	}
	var cycles []string
	var dfs func(string) bool
	dfs = func(n string) bool {
		color[n] = gray
		for _, dep := range graph[n] {
			if _, isComputed := graph[dep]; !isComputed {
				continue
			}
			if color[dep] == gray {
				cycles = append(cycles, n)
				return true
			}
			if color[dep] == white && dfs(dep) {
				return true
			}
		}
		color[n] = black
		return false
	}
	keys := make([]string, 0, len(graph))
	for k := range graph {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if color[k] == white {
			dfs(k)
		}
	}
	return cycles
}
