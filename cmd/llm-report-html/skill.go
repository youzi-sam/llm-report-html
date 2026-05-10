package main

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/yansir/llm-report-html/internal/skill"
)

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
		default:
			return fmt.Errorf("unexpected argument: %s", a)
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
