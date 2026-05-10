// Package html is the HTML renderer. It loads the embedded template shell plus
// Vite-built runtime packs and substitutes source + derived render data slots.
//
// The actual section dispatch lives in template/src/main.js. This Go side owns
// source-preserving compaction and derived render artifacts such as precompiled
// Markdown.
package html

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"strings"

	_ "embed"
)

//go:embed template.html
var templateHTML string

//go:embed assets/*
var runtimeAssets embed.FS

const marker = "__REPORT_DATA__"
const renderMarker = "__REPORT_RENDER_DATA__"
const cssMarker = "__REPORT_CSS__"
const runtimeMarker = "__REPORT_RUNTIME__"

func Render(rawDocJSON []byte) (string, error) {
	if !strings.Contains(templateHTML, marker) {
		return "", errors.New("template marker missing — rebuild template")
	}
	if !strings.Contains(templateHTML, renderMarker) {
		return "", errors.New("render-data template marker missing — rebuild template")
	}
	if !strings.Contains(templateHTML, cssMarker) {
		return "", errors.New("css template marker missing — rebuild template")
	}
	if !strings.Contains(templateHTML, runtimeMarker) {
		return "", errors.New("runtime template marker missing — rebuild template")
	}

	source := compactJSON(rawDocJSON)
	renderData, err := PrepareRenderData(rawDocJSON)
	if err != nil {
		return "", err
	}
	features, err := AnalyzeFeatures(rawDocJSON)
	if err != nil {
		return "", err
	}
	css, scripts, err := runtimeFor(features)
	if err != nil {
		return "", err
	}

	out := strings.Replace(templateHTML, marker, escapeForScriptTag(source), 1)
	out = strings.Replace(out, renderMarker, escapeForScriptTag(renderData), 1)
	out = strings.Replace(out, cssMarker, css, 1)
	out = strings.Replace(out, runtimeMarker, scripts, 1)
	return out, nil
}

func runtimeFor(features Features) (string, string, error) {
	css, err := readAsset("assets/core.css")
	if err != nil {
		return "", "", err
	}
	packs := make([]string, 0, 2+len(features.DiagramKinds))
	if features.Reactive {
		packs = append(packs, "reactive")
	}
	needsDagre := false
	for _, kind := range features.DiagramKinds {
		if isDagreDiagram(kind) {
			needsDagre = true
			continue
		}
		packs = append(packs, "diagram-"+kind)
	}
	if needsDagre {
		packs = append(packs, "diagram-dagre")
	}
	packs = append(packs, "core")

	var scripts strings.Builder
	for _, pack := range packs {
		js, err := readAsset("assets/" + pack + ".js")
		if err != nil {
			return "", "", err
		}
		scripts.WriteString("  <script>")
		scripts.WriteString(js)
		scripts.WriteString("</script>\n")
	}
	return css, strings.TrimRight(scripts.String(), "\n"), nil
}

func isDagreDiagram(kind string) bool {
	switch kind {
	case "er", "flow", "state", "tree":
		return true
	default:
		return false
	}
}

func readAsset(path string) (string, error) {
	body, err := runtimeAssets.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func compactJSON(raw []byte) []byte {
	var buf bytes.Buffer
	if err := json.Compact(&buf, raw); err != nil {
		return raw
	}
	return buf.Bytes()
}

func escapeForScriptTag(b []byte) string {
	s := string(b)
	s = strings.ReplaceAll(s, "</script", `<\/script`)
	s = strings.ReplaceAll(s, "<!--", `<\!--`)
	return s
}
