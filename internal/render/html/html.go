// Package html is the HTML renderer. It loads the embedded template (built by
// Vite + singlefile) and substitutes the report-data slot.
//
// The actual section dispatch lives in template/src/main.js. This Go side only
// validates and injects.
package html

import (
	"bytes"
	"encoding/json"
	"errors"
	"strings"

	_ "embed"
)

//go:embed template.html
var templateHTML string

const marker = "__REPORT_DATA__"

func Render(rawDocJSON []byte) (string, error) {
	if !strings.Contains(templateHTML, marker) {
		return "", errors.New("template marker missing — rebuild template")
	}
	compact := compactJSON(rawDocJSON)
	escaped := escapeForScriptTag(compact)
	return strings.Replace(templateHTML, marker, escaped, 1), nil
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
