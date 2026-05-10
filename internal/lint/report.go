// Package lint provides static analysis on top of JSON Schema validation.
// Validation says "this JSON conforms to the schema". Analysis separates hard
// semantic errors from presentation warnings.
package lint

import (
	"fmt"
	"sort"
	"strings"
)

// Finding is a single static-analysis finding with JSON-pointer-style path.
type Finding struct {
	Path string
	Rule string
	Msg  string
}

func (f Finding) String() string {
	return fmt.Sprintf("  %s [%s] %s", f.Path, f.Rule, f.Msg)
}

// Report groups fatal semantic errors separately from presentation warnings.
type Report struct {
	Errors   []Finding
	Warnings []Finding
}

// Error formats fatal semantic errors as a single CLI-friendly error.
func (r Report) Error() error {
	if len(r.Errors) == 0 {
		return nil
	}
	var sb strings.Builder
	sb.WriteString("semantic validation failed:\n")
	for _, e := range r.Errors {
		fmt.Fprintf(&sb, "%s\n", e.String())
	}
	return fmt.Errorf("%s", strings.TrimRight(sb.String(), "\n"))
}

func sortFindings(findings []Finding) {
	sort.Slice(findings, func(i, j int) bool {
		if findings[i].Path != findings[j].Path {
			return findings[i].Path < findings[j].Path
		}
		return findings[i].Rule < findings[j].Rule
	})
}
