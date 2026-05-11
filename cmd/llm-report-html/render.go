package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	htmlrender "github.com/yansir/llm-report-html/internal/render/html"
)

type renderOptions struct {
	target  string
	inPath  string
	outPath string
	stdout  bool
	noOpen  bool
}

func cmdRender(args []string) error {
	opts, err := parseRenderArgs(args)
	if err != nil {
		return err
	}

	raw, err := readInput(opts.inPath)
	if err != nil {
		return err
	}
	if _, err := validateRaw(raw); err != nil {
		return err
	}

	htmlPath := opts.outPath
	if opts.target == "html" && !opts.stdout && htmlPath == "" {
		htmlPath = deriveTmpPath(opts.inPath, ".html")
	}

	var out string
	switch opts.target {
	case "html":
		sourceHref := "report.json"
		if htmlPath != "" {
			sourceHref = filepath.Base(sourceJSONPath(htmlPath))
		}
		out, err = htmlrender.RenderWithSourceHref(raw, sourceHref)
		if err != nil {
			return err
		}
	case "json":
		out = string(raw)
	}

	if opts.stdout {
		_, err := os.Stdout.WriteString(out)
		return err
	}
	if opts.target != "html" && opts.outPath == "" {
		_, err := os.Stdout.WriteString(out)
		return err
	}

	if htmlPath == "" {
		htmlPath = deriveTmpPath(opts.inPath, ".html")
	}
	if err := os.WriteFile(htmlPath, []byte(out), 0644); err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "wrote %s\n", htmlPath)

	if opts.target == "html" {
		jsonPath := sourceJSONPath(htmlPath)
		var pretty bytes.Buffer
		if err := json.Indent(&pretty, raw, "", "  "); err != nil {
			return fmt.Errorf("re-format source json: %w", err)
		}
		pretty.WriteByte('\n')
		if err := os.WriteFile(jsonPath, pretty.Bytes(), 0644); err != nil {
			return err
		}
		fmt.Fprintf(os.Stderr, "wrote %s (source — edit and re-render)\n", jsonPath)
	}

	if opts.target == "html" && !opts.noOpen {
		if err := openInBrowser(htmlPath); err != nil {
			fmt.Fprintf(os.Stderr, "warning: could not open in browser: %v\n", err)
		}
	}
	return nil
}

func sourceJSONPath(htmlPath string) string {
	return strings.TrimSuffix(htmlPath, filepath.Ext(htmlPath)) + ".json"
}

func parseRenderArgs(args []string) (renderOptions, error) {
	opts := renderOptions{target: "html"}
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "--target" || a == "-t":
			if i+1 >= len(args) {
				return opts, errors.New("--target requires a value")
			}
			opts.target = args[i+1]
			i++
		case a == "-o" || a == "--output":
			if i+1 >= len(args) {
				return opts, errors.New("-o requires a path")
			}
			opts.outPath = args[i+1]
			i++
		case a == "--stdout":
			opts.stdout = true
		case a == "--no-open":
			opts.noOpen = true
		case strings.HasPrefix(a, "-"):
			return opts, fmt.Errorf("unknown flag: %s", a)
		default:
			if opts.inPath != "" {
				return opts, errors.New("multiple input files not supported")
			}
			opts.inPath = a
		}
	}
	if opts.target != "html" && opts.target != "json" {
		return opts, fmt.Errorf("unknown target %q (try: html, json)", opts.target)
	}
	return opts, nil
}

func deriveTmpPath(inPath, ext string) string {
	base := "llm-report"
	if inPath != "" {
		stem := strings.TrimSuffix(filepath.Base(inPath), filepath.Ext(inPath))
		if stem != "" {
			base = stem
		}
	}
	ts := time.Now().Format("150405")
	return filepath.Join("/tmp", fmt.Sprintf("%s-%s%s", base, ts, ext))
}

func openInBrowser(path string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "darwin":
		cmd = exec.Command("open", path)
	case "linux":
		cmd = exec.Command("xdg-open", path)
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", "", path)
	default:
		return nil
	}
	return cmd.Start()
}
