package main

import (
	"fmt"
	"os"
)

const version = "v0.12.0"

type exitCodeError struct {
	code int
}

func (e exitCodeError) Error() string { return "" }

func main() {
	if err := run(os.Args[1:]); err != nil {
		code := 1
		if e, ok := err.(exitCodeError); ok {
			code = e.code
		} else {
			fmt.Fprintln(os.Stderr, "error:", err)
		}
		os.Exit(code)
	}
}

func run(args []string) error {
	if len(args) < 1 {
		fmt.Fprint(os.Stderr, helpText)
		return exitCodeError{code: 2}
	}

	switch args[0] {
	case "render":
		return cmdRender(args[1:])
	case "validate":
		return cmdValidate(args[1:])
	case "extract":
		return cmdExtract(args[1:])
	case "schema":
		return cmdSchema(args[1:])
	case "recipe":
		return cmdRecipe(args[1:])
	case "skill":
		return cmdSkill(args[1:])
	case "version", "--version", "-v":
		fmt.Println("llm-report-html " + version)
		return nil
	case "-h", "--help", "help":
		fmt.Print(helpText)
		return nil
	default:
		fmt.Fprintln(os.Stderr, "unknown command:", args[0])
		fmt.Fprint(os.Stderr, helpText)
		return exitCodeError{code: 2}
	}
}

const helpText = `llm-report-html ` + version + ` — render typed JSON to a self-contained HTML report.

USAGE
  llm-report-html <command> [args]

COMMANDS
  render   <doc.json> [--target html|json] [-o out] [--stdout] [--no-open]
                                       html (default): writes to /tmp + sibling
                                       .json source, then opens in the browser.
                                       json: prints to stdout (use -o for file).
                                       --stdout: pipe any target to stdout.
  validate <doc.json>                 schema + semantic validation + warnings
  extract  <report.html> [-o doc.json]
                                       pull JSON source out of a rendered HTML
  schema   [--catalog | --example <s> | --examples | --operators | --json]
                                       inspect the schema
  recipe   list | recipe show <name>   vetted case studies
  skill    [--output-dir <path>] [--stdout]
                                       regenerate Agent skill files
  version  | -v | --version
  help     | -h | --help               this message

  Stdin works on render/validate/extract when path is omitted.
  Sibling .json next to the rendered .html is the canonical source — edit it
  and re-render rather than hand-editing the HTML.

AGENT GUIDE
  This binary is the engine; the skill is the interface. After build:
    .claude/skills/llm-report-html/SKILL.md
  contains workflow + references for any compatible Agent (Claude Code,
  Cursor, Codex, Gemini CLI, …). Install globally with:
    ln -s "$PWD/.claude/skills/llm-report-html" ~/.claude/skills/

  Or browse the schema directly: ` + "`llm-report-html schema --catalog`" + `
`
