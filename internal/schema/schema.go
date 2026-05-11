// Package schema embeds and parses the generated report schema.
//
// The canonical edit surface is manifest-src/. manifest.json and schema.json
// are generated from it so runtime validation, skill generation, and CLI
// introspection consume one artifact.
//
// Surface catalog entries are tagged "kind": either "encoding" (leaf node)
// or "layout" (container). Validators recurse into layout containers;
// renderers dispatch by kind.
package schema

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"sort"
)

//go:embed schema.json
var schemaJSON []byte

// Doc is the parsed top-level schema; only fields actually consumed by
// validators / renderers / the skill generator are retained.
type Doc struct {
	Version          string                `json:"version"`
	SurfaceCatalog   map[string]SurfaceDef `json:"x-surface-catalog"`
	PresentationNote map[string]string     `json:"x-presentation-notes"`
	Defs             map[string]DefEntry   `json:"$defs"`
}

// DefEntry captures the subset of fields we read from $defs/section.<surface>.
// Examples are rendered as raw JSON; we don't introspect their structure.
type DefEntry struct {
	Examples []json.RawMessage `json:"examples"`
}

type SurfaceDef struct {
	Kind   string   `json:"kind"`  // "encoding" | "layout"
	Binds  string   `json:"binds"` // encoding name OR layout name
	Fields []string `json:"fields"`
	Usage  string   `json:"usage"`
}

var loaded *Doc

func Schema() *Doc {
	if loaded != nil {
		return loaded
	}
	d := &Doc{}
	if err := json.Unmarshal(schemaJSON, d); err != nil {
		panic(fmt.Sprintf("schema/schema.json malformed: %v", err))
	}
	loaded = d
	return d
}

func RawJSON() []byte { return schemaJSON }

// Surface returns the catalog entry for a surface type, or nil.
func Surface(name string) *SurfaceDef {
	if s, ok := Schema().SurfaceCatalog[name]; ok {
		return &s
	}
	return nil
}

// ExamplesFor returns the raw JSON examples for a given surface type, or nil.
func ExamplesFor(surface string) []json.RawMessage {
	def, ok := Schema().Defs["section."+surface]
	if !ok {
		return nil
	}
	return def.Examples
}

// SurfaceList returns all known surface type names.
func SurfaceList() []string {
	cat := Schema().SurfaceCatalog
	out := make([]string, 0, len(cat))
	for k := range cat {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
