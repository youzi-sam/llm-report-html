// Package recipes embeds two CASE STUDIES — not templates — for techniques
// that can't be conveyed in prose alone:
//
//   - calculator    cells + JS operator modules + typed expr calls
//   - filtered-list array binding + section.if + JS operator modules
//
// Read these to learn the technique. Do NOT copy their structure for unrelated
// content (e.g. an essay or comparison) — that produces formulaic output. For
// open-ended content, follow references/composition.md instead.
package recipes

import (
	"embed"
	"fmt"
	"io/fs"
	"sort"
	"strings"
)

//go:embed *.json
var fsys embed.FS

// List returns recipe names (file basename without .json), sorted.
func List() []string {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		n := e.Name()
		if strings.HasSuffix(n, ".json") {
			names = append(names, strings.TrimSuffix(n, ".json"))
		}
	}
	sort.Strings(names)
	return names
}

// Show returns the raw JSON bytes of the named recipe.
func Show(name string) ([]byte, error) {
	return fsys.ReadFile(name + ".json")
}

// Description gives a one-line summary per recipe. The framing emphasizes
// these are case studies for technique learning, not copy-paste templates.
func Description(name string) string {
	descriptions := map[string]string{
		"calculator":    "case study: cells + JS operator modules (READ for technique; do NOT copy structure)",
		"filtered-list": "case study: array binding + section.if + JS operator modules (READ for technique; do NOT copy structure)",
	}
	if d, ok := descriptions[name]; ok {
		return d
	}
	return ""
}

// IndexLine returns "name — description" for listing.
func IndexLine(name string) string {
	desc := Description(name)
	if desc == "" {
		return fmt.Sprintf("  %-26s", name)
	}
	return fmt.Sprintf("  %-26s %s", name, desc)
}
