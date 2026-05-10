package main

import (
	"errors"
	"fmt"
	"os"

	"github.com/yansir/llm-report-html/recipes"
)

func cmdRecipe(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: llm-report-html recipe <list|show> [name]")
	}
	switch args[0] {
	case "list":
		if len(args) != 1 {
			return errors.New("usage: llm-report-html recipe list")
		}
		fmt.Println("Available recipes (vetted case studies):")
		fmt.Println()
		for _, name := range recipes.List() {
			fmt.Println(recipes.IndexLine(name))
		}
		fmt.Println()
		fmt.Println("Use `recipe show <name>` to inspect one technique-focused JSON document.")
		return nil
	case "show":
		if len(args) != 2 {
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
