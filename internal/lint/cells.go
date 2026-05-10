package lint

import (
	"fmt"
	"sort"
)

func (a *analysis) analyzeComputed(computed map[string]interface{}) {
	depGraph := make(map[string][]string)
	for name, formula := range computed {
		deps := collectVars(formula)
		for _, d := range deps {
			a.requireDeclared(
				fmt.Sprintf("computed.%s", name),
				d,
				`formula references undeclared cell %q`,
			)
		}
		depGraph[name] = deps
	}

	for _, c := range detectCycles(depGraph) {
		a.addError(
			fmt.Sprintf("computed.%s", c),
			"cycle",
			"computed cell participates in a dependency cycle",
		)
	}
}

// scopedOps lists JSONLogic operators whose predicate body opens a new data
// scope (the iterator). Inside such a body, `{"var":"x"}` references a field
// of the current item, NOT a top-level cell. To reach a top-level cell from
// inside, the user writes `"../x"` (one ../ per nesting level escaped).
var scopedOps = map[string]bool{
	"map": true, "filter": true, "reduce": true,
	"all": true, "some": true, "none": true,
}

func collectVars(expr interface{}) []string {
	seen := make(map[string]bool)
	var walk func(e interface{}, depth int)
	walk = func(e interface{}, depth int) {
		switch v := e.(type) {
		case []interface{}:
			for _, x := range v {
				walk(x, depth)
			}
		case map[string]interface{}:
			for k, val := range v {
				switch {
				case k == "var":
					var name string
					switch n := val.(type) {
					case string:
						name = n
					case []interface{}:
						if len(n) > 0 {
							if s, ok := n[0].(string); ok {
								name = s
							}
						}
					}
					if name == "" {
						continue
					}
					up := 0
					for len(name) >= 3 && name[:3] == "../" {
						name = name[3:]
						up++
					}
					if up >= depth {
						seen[firstSegment(name)] = true
					}
				case scopedOps[k]:
					args, _ := val.([]interface{})
					if len(args) >= 1 {
						walk(args[0], depth)
					}
					if len(args) >= 2 {
						walk(args[1], depth+1)
					}
					if len(args) >= 3 {
						walk(args[2], depth)
					}
				default:
					walk(val, depth)
				}
			}
		}
	}
	walk(expr, 0)
	out := make([]string, 0, len(seen))
	for k := range seen {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

func firstSegment(s string) string {
	for i := 0; i < len(s); i++ {
		if s[i] == '.' {
			return s[:i]
		}
	}
	return s
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
