package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/yansir/llm-report-html/internal/schema"
)

type schemaMode string

const (
	schemaModeDoc       schemaMode = "doc"
	schemaModeJSON      schemaMode = "json"
	schemaModeCatalog   schemaMode = "catalog"
	schemaModeExamples  schemaMode = "examples"
	schemaModeOperators schemaMode = "operators"
	schemaModeExample   schemaMode = "example"
)

type schemaOptions struct {
	mode    schemaMode
	example string
}

func cmdSchema(args []string) error {
	opts, err := parseSchemaArgs(args)
	if err != nil {
		return err
	}

	s := schema.Schema()
	switch opts.mode {
	case schemaModeJSON:
		_, err := os.Stdout.Write(schema.RawJSON())
		return err
	case schemaModeCatalog:
		printCatalog(s)
	case schemaModeExample:
		return printExample(opts.example)
	case schemaModeExamples:
		printExamples()
	case schemaModeOperators:
		printOperators()
	case schemaModeDoc:
		printSchemaDoc(s)
	}
	return nil
}

func parseSchemaArgs(args []string) (schemaOptions, error) {
	opts := schemaOptions{mode: schemaModeDoc}
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch a {
		case "--json":
			opts.mode = schemaModeJSON
		case "--catalog":
			opts.mode = schemaModeCatalog
		case "--examples":
			opts.mode = schemaModeExamples
		case "--operators":
			opts.mode = schemaModeOperators
		case "--example":
			if i+1 >= len(args) {
				return opts, errors.New("usage: llm-report-html schema --example <surface-name>")
			}
			opts.mode = schemaModeExample
			opts.example = args[i+1]
			i++
		default:
			return opts, fmt.Errorf("unknown flag: %s", a)
		}
	}
	return opts, nil
}

func printCatalog(s *schema.Doc) {
	fmt.Println("Surface catalog (Agent picks one of these):")
	fmt.Println()
	for _, name := range schema.SurfaceList() {
		def := s.SurfaceCatalog[name]
		fmt.Printf("  %-12s [%-9s] %s\n", name, def.Kind, def.Usage)
	}
	fmt.Println()
	fmt.Println("Use `schema --example <name>` to see a working snippet.")
}

func printExample(name string) error {
	examples := schema.ExamplesFor(name)
	if len(examples) == 0 {
		return fmt.Errorf("no example for surface %q (try `schema --catalog`)", name)
	}
	var buf bytes.Buffer
	var writeErr error
	if err := json.Indent(&buf, examples[0], "", "  "); err != nil {
		_, writeErr = os.Stdout.Write(examples[0])
	} else {
		_, writeErr = os.Stdout.Write(buf.Bytes())
	}
	if writeErr != nil {
		return writeErr
	}
	fmt.Println()
	return nil
}

func printExamples() {
	fmt.Println("Working examples per surface:")
	fmt.Println()
	for _, name := range schema.SurfaceList() {
		examples := schema.ExamplesFor(name)
		if len(examples) == 0 {
			continue
		}
		fmt.Printf("── %s ──\n", name)
		var buf bytes.Buffer
		if err := json.Indent(&buf, examples[0], "  ", "  "); err == nil {
			fmt.Printf("  %s\n\n", buf.String())
		}
	}
}

func printOperators() {
	fmt.Println("Runtime operator modules:")
	fmt.Println()
	fmt.Println(`  export default defineOperator({
    name: "tax2025",
    args: ["number"],
    returns: "number",
    pure: true,
    tests: [{ args: [1000], returns: 30 }],
    run(income) { return income * 0.03 }
  })`)
	fmt.Println()
	fmt.Println(`Declare modules in "runtime.operators" and call them from computed cells with { "call": "tax2025", "args": [{ "cell": "income" }] }.`)
}

func printSchemaDoc(s *schema.Doc) {
	fmt.Println("llm-report-html schema " + s.Version)
	fmt.Println(strings.Repeat("=", 40))
	fmt.Println()
	fmt.Println("Top-level document:")
	fmt.Println(`  { "title"?, "subtitle"?, "author"?, "date"?, "runtime"?, "cells"?, "sections": [<section>, ...] }`)
	fmt.Println()
	fmt.Println("CONTENT SURFACES (leaf):")
	for _, n := range schema.SurfaceList() {
		def := s.SurfaceCatalog[n]
		if def.Kind == "encoding" {
			fmt.Printf("  %-12s %s\n", n, def.Usage)
		}
	}
	fmt.Println()
	fmt.Println("CONTAINER SURFACES (recursive):")
	for _, n := range schema.SurfaceList() {
		def := s.SurfaceCatalog[n]
		if def.Kind == "layout" {
			fmt.Printf("  %-12s %s\n", n, def.Usage)
		}
	}
	fmt.Println()
	fmt.Println("PRESENTATION NOTES:")
	for _, k := range stringMapKeys(s.PresentationNote) {
		fmt.Printf("  %s: %s\n", k, s.PresentationNote[k])
	}
	fmt.Println()
	fmt.Println("More: --catalog | --example <surface> | --examples | --operators | --json")
}

func stringMapKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
