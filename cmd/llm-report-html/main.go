package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	htmlrender "github.com/yansir/llm-report-html/internal/render/html"
	mdrender "github.com/yansir/llm-report-html/internal/render/markdown"
	"github.com/yansir/llm-report-html/internal/lint"
	"github.com/yansir/llm-report-html/internal/schema"
	"github.com/yansir/llm-report-html/internal/skill"
	"github.com/yansir/llm-report-html/recipes"
)

const version = "v0.12.0"

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, helpText)
		os.Exit(2)
	}
	switch os.Args[1] {
	case "render":
		exit(cmdRender(os.Args[2:]))
	case "validate":
		exit(cmdValidate(os.Args[2:]))
	case "extract":
		exit(cmdExtract(os.Args[2:]))
	case "schema":
		cmdSchema(os.Args[2:])
	case "recipe":
		exit(cmdRecipe(os.Args[2:]))
	case "skill":
		exit(cmdSkill(os.Args[2:]))
	case "version", "--version", "-v":
		fmt.Println("llm-report-html " + version)
	case "-h", "--help", "help":
		fmt.Print(helpText)
	default:
		fmt.Fprintln(os.Stderr, "unknown command:", os.Args[1])
		fmt.Fprint(os.Stderr, helpText)
		os.Exit(2)
	}
}

const helpText = `llm-report-html ` + version + ` — render typed JSON to a self-contained HTML report.

USAGE
  llm-report-html <command> [args]

COMMANDS
  render   <doc.json> [--target html|md|json] [-o out]
                                       html (default), md (markdown), json (echo)
  validate <doc.json> [--strict]      schema validation + lint warnings
  extract  <report.html> [-o doc.json]
                                       pull JSON source out of a rendered HTML
  schema   [--catalog | --example <s> | --examples | --operators | --json]
                                       inspect the schema
  recipe   list | recipe show <name>   vetted starter templates
  skill    [--output-dir <path>] [--stdout]
                                       regenerate Agent skill files
  version  | -v | --version
  help     | -h | --help               this message

  Stdin/stdout work on render/validate/extract when path is omitted.

AGENT GUIDE
  This binary is the engine; the skill is the interface. After build:
    .claude/skills/llm-report-html/SKILL.md
  contains workflow + references for any compatible Agent (Claude Code,
  Cursor, Codex, Gemini CLI, …). Install globally with:
    ln -s "$PWD/.claude/skills/llm-report-html" ~/.claude/skills/

  Or browse the schema directly: ` + "`llm-report-html schema --catalog`" + `
`

func exit(err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func cmdRender(args []string) error {
	target := "html"
	var inPath, outPath string
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--target" || a == "-t":
			if i+1 >= len(args) {
				return errors.New("--target requires a value")
			}
			target = args[i+1]
			i++
		case a == "-o" || a == "--output":
			if i+1 >= len(args) {
				return errors.New("-o requires a path")
			}
			outPath = args[i+1]
			i++
		case strings.HasPrefix(a, "-"):
			return fmt.Errorf("unknown flag: %s", a)
		default:
			if inPath != "" {
				return errors.New("multiple input files not supported")
			}
			inPath = a
		}
	}

	raw, err := readInput(inPath)
	if err != nil {
		return err
	}
	doc, err := schema.ParseAndValidate(raw)
	if err != nil {
		return fmt.Errorf("validation: %w", err)
	}

	var out string
	switch target {
	case "html":
		out, err = htmlrender.Render(raw)
		if err != nil {
			return err
		}
	case "md", "markdown":
		out = mdrender.RenderWithRaw(doc, raw)
	case "json":
		out = string(raw)
	default:
		return fmt.Errorf("unknown target %q (try: html, md, json)", target)
	}

	return writeOutput(outPath, out)
}

func cmdValidate(args []string) error {
	var inPath string
	strict := false
	for _, a := range args {
		switch a {
		case "--strict":
			strict = true
		default:
			if !strings.HasPrefix(a, "-") && inPath == "" {
				inPath = a
			}
		}
	}
	raw, err := readInput(inPath)
	if err != nil {
		return err
	}
	if _, err := schema.ParseAndValidate(raw); err != nil {
		return err
	}
	warnings, err := lint.Lint(raw)
	if err != nil {
		return err
	}
	if len(warnings) > 0 {
		fmt.Fprintf(os.Stderr, "ok (%d warning(s)):\n", len(warnings))
		for _, w := range warnings {
			fmt.Fprintln(os.Stderr, w.String())
		}
		if strict {
			return fmt.Errorf("--strict: warnings present")
		}
		return nil
	}
	fmt.Fprintln(os.Stderr, "ok")
	return nil
}

func cmdExtract(args []string) error {
	var inPath, outPath string
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "-o" || a == "--output":
			if i+1 >= len(args) {
				return errors.New("-o requires a path")
			}
			outPath = args[i+1]
			i++
		case strings.HasPrefix(a, "-"):
			return fmt.Errorf("unknown flag: %s", a)
		default:
			if inPath != "" {
				return errors.New("extract takes one HTML file")
			}
			inPath = a
		}
	}
	raw, err := readInput(inPath)
	if err != nil {
		return fmt.Errorf("read input: %w", err)
	}
	data, err := extractDataSlot(raw)
	if err != nil {
		return err
	}
	var pretty bytes.Buffer
	if err := json.Indent(&pretty, data, "", "  "); err != nil {
		return fmt.Errorf("extracted slot is not valid JSON: %w", err)
	}
	pretty.WriteByte('\n')
	return writeOutput(outPath, pretty.String())
}

// extractDataSlot finds <script ... id="report-data" ...>BODY</script> and
// returns BODY with script-tag escaping reversed. Tolerates attribute order;
// relies only on the id attribute substring.
func extractDataSlot(html []byte) ([]byte, error) {
	idAttr := []byte(`id="report-data"`)
	idx := bytes.Index(html, idAttr)
	if idx < 0 {
		return nil, errors.New(`not a llm-report-html artifact: missing <script id="report-data">`)
	}
	gt := bytes.IndexByte(html[idx:], '>')
	if gt < 0 {
		return nil, errors.New("malformed HTML: unterminated <script> tag")
	}
	start := idx + gt + 1
	end := bytes.Index(html[start:], []byte("</script>"))
	if end < 0 {
		return nil, errors.New(`malformed HTML: unterminated <script id="report-data">`)
	}
	body := html[start : start+end]
	body = bytes.ReplaceAll(body, []byte(`<\/script`), []byte("</script"))
	body = bytes.ReplaceAll(body, []byte(`<\!--`), []byte("<!--"))
	return body, nil
}

func cmdSkill(args []string) error {
	outDir := ".claude/skills/llm-report-html"
	stdout := false
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--stdout":
			stdout = true
		case a == "--output-dir" || a == "-o":
			if i+1 >= len(args) {
				return errors.New("--output-dir requires a path")
			}
			outDir = args[i+1]
			i++
		case strings.HasPrefix(a, "-"):
			return fmt.Errorf("unknown flag: %s", a)
		}
	}
	if stdout {
		body, err := skill.RenderSkillMD()
		if err != nil {
			return err
		}
		fmt.Print(body)
		return nil
	}
	if err := skill.Render(outDir); err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "skill written to %s\n", outDir)
	return nil
}

func cmdRecipe(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: llm-report-html recipe <list|show> [name]")
	}
	switch args[0] {
	case "list":
		fmt.Println("Available recipes (vetted starter templates):")
		fmt.Println()
		for _, name := range recipes.List() {
			fmt.Println(recipes.IndexLine(name))
		}
		fmt.Println()
		fmt.Println("Use `recipe show <name>` to print one (pipe to a file to start editing).")
		return nil
	case "show":
		if len(args) < 2 {
			return errors.New("usage: llm-report-html recipe show <name>")
		}
		body, err := recipes.Show(args[1])
		if err != nil {
			return fmt.Errorf("recipe %q not found (try `recipe list`)", args[1])
		}
		os.Stdout.Write(body)
		if len(body) > 0 && body[len(body)-1] != '\n' {
			fmt.Println()
		}
		return nil
	default:
		return fmt.Errorf("unknown recipe subcommand: %s (try list | show)", args[0])
	}
}

func cmdSchema(args []string) {
	mode := "doc"
	var argVal string
	for i, a := range args {
		switch a {
		case "--json":
			mode = "json"
		case "--catalog":
			mode = "catalog"
		case "--examples":
			mode = "examples"
		case "--operators":
			mode = "operators"
		case "--example":
			mode = "example"
			if i+1 < len(args) {
				argVal = args[i+1]
			}
		}
	}
	s := schema.Schema()

	switch mode {
	case "json":
		os.Stdout.Write(schema.RawJSON())
		return
	case "catalog":
		fmt.Println("Surface catalog (Agent picks one of these):")
		fmt.Println()
		for name, def := range s.SurfaceCatalog {
			fmt.Printf("  %-12s [%-9s] %s\n", name, def.Kind, def.Usage)
		}
		fmt.Println()
		fmt.Println("Use `schema --example <name>` to see a working snippet.")
		return
	case "example":
		if argVal == "" {
			fmt.Fprintln(os.Stderr, "usage: llm-report-html schema --example <surface-name>")
			os.Exit(2)
		}
		examples := schema.ExamplesFor(argVal)
		if len(examples) == 0 {
			fmt.Fprintf(os.Stderr, "no example for surface %q (try `schema --catalog`)\n", argVal)
			os.Exit(2)
		}
		var buf bytes.Buffer
		if err := json.Indent(&buf, examples[0], "", "  "); err != nil {
			os.Stdout.Write(examples[0])
		} else {
			os.Stdout.Write(buf.Bytes())
		}
		fmt.Println()
		return
	case "examples":
		fmt.Println("Working examples per surface:")
		fmt.Println()
		for name := range s.SurfaceCatalog {
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
		return
	case "operators":
		fmt.Println("Curated JSONLogic operators (use these instead of nested if/else):")
		fmt.Println()
		for name, op := range s.Operators {
			fmt.Printf("── %s(%s) ──\n", name, strings.Join(op.Args, ", "))
			fmt.Printf("  %s\n", op.Doc)
			var buf bytes.Buffer
			if err := json.Indent(&buf, op.Example, "  ", "  "); err == nil {
				fmt.Printf("  e.g. %s\n\n", buf.String())
			}
		}
		fmt.Println("Use them in `computed.<name>` like any built-in JSONLogic op.")
		return
	}

	// default: surface-first overview
	fmt.Println("llm-report-html schema " + s.Version)
	fmt.Println(strings.Repeat("=", 40))
	fmt.Println()
	fmt.Println("Top-level document:")
	fmt.Println(`  { "title"?, "subtitle"?, "author"?, "date"?, "state"?, "computed"?, "sections": [<section>, ...] }`)
	fmt.Println()
	fmt.Println("CONTENT SURFACES (leaf):")
	for n, def := range s.SurfaceCatalog {
		if def.Kind == "encoding" {
			fmt.Printf("  %-12s %s\n", n, def.Usage)
		}
	}
	fmt.Println()
	fmt.Println("CONTAINER SURFACES (recursive):")
	for n, def := range s.SurfaceCatalog {
		if def.Kind == "layout" {
			fmt.Printf("  %-12s %s\n", n, def.Usage)
		}
	}
	fmt.Println()
	fmt.Println("PRESENTATION NOTES:")
	for k, v := range s.PresentationNote {
		fmt.Printf("  %s: %s\n", k, v)
	}
	fmt.Println()
	fmt.Println("More: --catalog | --example <surface> | --examples | --operators | --json")
}

func readInput(path string) ([]byte, error) {
	if path == "" {
		return io.ReadAll(os.Stdin)
	}
	return os.ReadFile(path)
}

func writeOutput(path, content string) error {
	if path == "" {
		_, err := os.Stdout.WriteString(content)
		return err
	}
	return os.WriteFile(path, []byte(content), 0644)
}
