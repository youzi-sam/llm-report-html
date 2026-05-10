// Package lint provides static analysis warnings on top of strict schema
// validation. Validation says "this JSON conforms to the schema". Lint says
// "this JSON conforms but exhibits a known anti-pattern".
//
// Lint is non-fatal: it returns warnings, not errors. CLI exits 0 even with
// warnings; only `validate` failure blocks downstream work.
package lint

import (
	"encoding/json"
	"fmt"
	"regexp"
	"sort"

	"github.com/yansir/llm-report-html/internal/schema"
)

// Warning is a single lint finding with JSON-pointer-style path.
type Warning struct {
	Path string
	Rule string
	Msg  string
}

func (w Warning) String() string {
	return fmt.Sprintf("  %s [%s] %s", w.Path, w.Rule, w.Msg)
}

// Lint inspects a parsed Document plus the raw root map (needed for state /
// computed which the typed Document doesn't capture) and returns warnings.
func Lint(raw []byte) ([]Warning, error) {
	var root map[string]interface{}
	if err := json.Unmarshal(raw, &root); err != nil {
		return nil, fmt.Errorf("not valid JSON: %w", err)
	}
	doc, err := schema.ParseAndValidate(raw)
	if err != nil {
		return nil, err
	}

	state := getMap(root, "state")
	computed := getMap(root, "computed")

	declared := make(map[string]string) // cell -> "state" or "computed"
	for n := range state {
		declared[n] = "state"
	}
	for n := range computed {
		declared[n] = "computed"
	}

	referenced := make(map[string]bool)
	var ws []Warning

	// 1. computed → other cells: collect deps + check undeclared refs.
	depGraph := make(map[string][]string)
	for name, formula := range computed {
		deps := collectVars(formula)
		for _, d := range deps {
			referenced[d] = true
			if _, ok := declared[d]; !ok {
				ws = append(ws, Warning{
					Path: fmt.Sprintf("computed.%s", name),
					Rule: "undeclared-cell",
					Msg:  fmt.Sprintf("formula references undeclared cell %q", d),
				})
			}
		}
		depGraph[name] = deps
	}

	// 2. cycles in computed deps.
	for _, c := range detectCycles(depGraph) {
		ws = append(ws, Warning{
			Path: fmt.Sprintf("computed.%s", c),
			Rule: "cycle",
			Msg:  "computed cell participates in a dependency cycle",
		})
	}

	// 3. walk sections for input.bind / stat.value.$bind / text-field templates
	//    / section.if bindings / array {$bind} on items/rows.
	walkSections(doc.Sections, "sections", func(s map[string]interface{}, path string) {
		t, _ := s["type"].(string)

		// section.if (any section)
		if v, ok := s["if"]; ok {
			if m, ok := v.(map[string]interface{}); ok {
				if b, ok := m["$bind"].(string); ok {
					referenced[b] = true
					if _, ok := declared[b]; !ok {
						ws = append(ws, Warning{path + ".if", "undeclared-cell",
							fmt.Sprintf("references undeclared cell %q", b)})
					}
				}
			}
		}

		// array fields that may bind to derived cells
		for _, f := range []string{"items", "rows", "columns"} {
			if m, ok := s[f].(map[string]interface{}); ok {
				if b, ok := m["$bind"].(string); ok {
					referenced[b] = true
					if _, ok := declared[b]; !ok {
						ws = append(ws, Warning{path + "." + f + ".$bind", "undeclared-cell",
							fmt.Sprintf("array binding references undeclared cell %q", b)})
					}
				}
			}
		}

		switch t {
		case "input":
			if b, ok := s["bind"].(string); ok {
				referenced[b] = true
				if _, ok := declared[b]; !ok {
					ws = append(ws, Warning{path + ".bind", "undeclared-cell",
						fmt.Sprintf("references undeclared cell %q", b)})
				}
			}
		case "stat":
			if m, ok := s["value"].(map[string]interface{}); ok {
				if b, ok := m["$bind"].(string); ok {
					referenced[b] = true
					if _, ok := declared[b]; !ok {
						ws = append(ws, Warning{path + ".value.$bind", "undeclared-cell",
							fmt.Sprintf("references undeclared cell %q", b)})
					}
				}
			}
		case "tabs", "columns":
			items, _ := s["items"].([]interface{})
			if len(items) < 2 {
				ws = append(ws, Warning{path, "trivial-layout",
					fmt.Sprintf("%s with %d item(s); a single-item %s adds no value", t, len(items), t)})
			}
		case "details", "aside":
			subs, _ := s["sections"].([]interface{})
			if len(subs) == 0 {
				ws = append(ws, Warning{path + ".sections", "empty-container",
					fmt.Sprintf("%s has no nested sections", t)})
			}
		}

		// scan text-bearing fields for {$bind:NAME}
		for _, f := range []string{"text", "title", "summary", "label", "by", "alt", "caption"} {
			if v, ok := s[f].(string); ok {
				for _, ref := range parseTextBindings(v) {
					referenced[ref] = true
					if _, ok := declared[ref]; !ok {
						ws = append(ws, Warning{path + "." + f, "undeclared-cell",
							fmt.Sprintf("template references undeclared cell %q", ref)})
					}
				}
			}
		}
	})

	// 4. unreferenced declared cells.
	for name, kind := range declared {
		if !referenced[name] {
			ws = append(ws, Warning{kind + "." + name, "unused-cell",
				"declared but never referenced"})
		}
	}

	// stable order for diff-friendly output
	sort.Slice(ws, func(i, j int) bool {
		if ws[i].Path != ws[j].Path {
			return ws[i].Path < ws[j].Path
		}
		return ws[i].Rule < ws[j].Rule
	})
	return ws, nil
}

// ─── helpers ────────────────────────────────────────────────────────────

var bindingRE = regexp.MustCompile(`\{\$bind:(\w+)\}`)

func parseTextBindings(s string) []string {
	matches := bindingRE.FindAllStringSubmatch(s, -1)
	out := make([]string, 0, len(matches))
	for _, m := range matches {
		out = append(out, m[1])
	}
	return out
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
					// Strip ../ prefixes; each escapes one scope.
					up := 0
					for len(name) >= 3 && name[:3] == "../" {
						name = name[3:]
						up++
					}
					// If we escaped all scopes, this is a top-level cell ref.
					if up >= depth {
						seen[firstSegment(name)] = true
					}
				case scopedOps[k]:
					args, _ := val.([]interface{})
					if len(args) >= 1 {
						walk(args[0], depth)        // source — outer scope
					}
					if len(args) >= 2 {
						walk(args[1], depth+1)      // predicate — inner scope
					}
					if len(args) >= 3 {              // reduce init — outer scope
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

func walkSections(sections []map[string]interface{}, path string, fn func(s map[string]interface{}, path string)) {
	for i, s := range sections {
		p := fmt.Sprintf("%s[%d]", path, i)
		fn(s, p)
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

func recurseInto(raw []interface{}, path string, fn func(s map[string]interface{}, path string)) {
	conv := make([]map[string]interface{}, 0, len(raw))
	for _, c := range raw {
		if m, ok := c.(map[string]interface{}); ok {
			conv = append(conv, m)
		}
	}
	walkSections(conv, path, fn)
}

func getMap(root map[string]interface{}, key string) map[string]interface{} {
	if v, ok := root[key].(map[string]interface{}); ok {
		return v
	}
	return nil
}
