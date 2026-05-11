package html

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
)

var markdown = goldmark.New(
	goldmark.WithExtensions(extension.Linkify),
)

var bindTokenRE = regexp.MustCompile(`\{\$bind:([A-Za-z_][A-Za-z0-9_]*)\}`)

const (
	renderKey        = "render"
	renderHTML       = "html"
	renderTextHTML   = "textHtml"
	renderDefHTML    = "defHtml"
	renderAnswerHTML = "aHtml"
	renderItems      = "items"
	renderChildren   = "children"
	renderRowsHTML   = "rowsHtml"
)

func PrepareRenderData(rawDocJSON []byte) ([]byte, error) {
	decoder := json.NewDecoder(bytes.NewReader(rawDocJSON))
	decoder.UseNumber()
	var root any
	if err := decoder.Decode(&root); err != nil {
		return nil, fmt.Errorf("prepare render data: %w", err)
	}
	enrichNode(root)
	out, err := json.Marshal(root)
	if err != nil {
		return nil, fmt.Errorf("marshal render data: %w", err)
	}
	return out, nil
}

func enrichNode(node any) {
	switch v := node.(type) {
	case []any:
		for _, item := range v {
			enrichNode(item)
		}
	case map[string]any:
		enrichSection(v)
		for _, item := range v {
			enrichNode(item)
		}
	}
}

func enrichSection(section map[string]any) {
	typ, _ := section["type"].(string)
	switch typ {
	case "paragraph":
		setRenderField(section, renderHTML, markdownBlock(stringField(section, "text")))
	case "quote":
		setRenderField(section, renderTextHTML, markdownInline(stringField(section, "text")))
	case "code":
		setRenderField(section, renderHTML, highlightCode(stringField(section, "code"), stringField(section, "lang")))
	case "callout":
		setRenderField(section, renderHTML, markdownBlock(stringField(section, "text")))
	case "list":
		if items, ok := section["items"].([]any); ok {
			setRenderField(section, renderItems, enrichListItems(items))
		}
	case "table":
		if rows, ok := section["rows"].([]any); ok {
			setRenderField(section, renderRowsHTML, enrichTableRows(rows))
		}
	case "timeline":
		if items, ok := section["items"].([]any); ok {
			setRenderField(section, renderItems, enrichTextItems(items, "text", renderTextHTML, markdownInline))
		}
	case "definition":
		if items, ok := section["items"].([]any); ok {
			setRenderField(section, renderItems, enrichTextItems(items, "def", renderDefHTML, markdownInline))
		}
	case "faq":
		if items, ok := section["items"].([]any); ok {
			setRenderField(section, renderItems, enrichTextItems(items, "a", renderAnswerHTML, markdownBlock))
		}
	}
}

func enrichListItems(items []any) []any {
	out := make([]any, 0, len(items))
	for _, item := range items {
		switch v := item.(type) {
		case string:
			out = append(out, map[string]any{
				"text": v,
				renderKey: map[string]any{
					renderHTML: markdownInline(v),
				},
			})
		case map[string]any:
			next := cloneMap(v)
			setRenderField(next, renderHTML, markdownInline(stringField(next, "text")))
			if children, ok := next["children"].([]any); ok {
				setRenderField(next, renderChildren, enrichListItems(children))
			}
			out = append(out, next)
		default:
			out = append(out, item)
		}
	}
	return out
}

func enrichTableRows(rows []any) []any {
	out := make([]any, 0, len(rows))
	for _, row := range rows {
		cells, ok := row.([]any)
		if !ok {
			out = append(out, row)
			continue
		}
		next := make([]any, 0, len(cells))
		for _, cell := range cells {
			next = append(next, markdownInline(fmt.Sprint(cell)))
		}
		out = append(out, next)
	}
	return out
}

func enrichTextItems(items []any, sourceKey, htmlKey string, render func(string) string) []any {
	out := make([]any, 0, len(items))
	for _, item := range items {
		m, ok := item.(map[string]any)
		if !ok {
			out = append(out, item)
			continue
		}
		next := cloneMap(m)
		setRenderField(next, htmlKey, render(stringField(next, sourceKey)))
		out = append(out, next)
	}
	return out
}

func markdownBlock(source string) string {
	return renderMarkdown(source, false)
}

func markdownInline(source string) string {
	return renderMarkdown(source, true)
}

func renderMarkdown(source string, inline bool) string {
	prepared, binds := protectBindTokens(source)
	var buf bytes.Buffer
	if err := markdown.Convert([]byte(prepared), &buf); err != nil {
		return ""
	}
	html := buf.String()
	if inline {
		html = trimParagraph(html)
	}
	for marker, name := range binds {
		html = strings.ReplaceAll(html, marker, `<span data-bind-text="`+name+`"></span>`)
	}
	return html
}

func protectBindTokens(source string) (string, map[string]string) {
	binds := map[string]string{}
	idx := 0
	out := bindTokenRE.ReplaceAllStringFunc(source, func(token string) string {
		match := bindTokenRE.FindStringSubmatch(token)
		marker := fmt.Sprintf("LRHBIND%d", idx)
		idx++
		binds[marker] = match[1]
		return marker
	})
	return out, binds
}

func trimParagraph(html string) string {
	html = strings.TrimSuffix(html, "\n")
	if strings.HasPrefix(html, "<p>") && strings.HasSuffix(html, "</p>") {
		return strings.TrimSuffix(strings.TrimPrefix(html, "<p>"), "</p>")
	}
	return html
}

func cloneMap(src map[string]any) map[string]any {
	out := make(map[string]any, len(src)+2)
	for k, v := range src {
		out[k] = v
	}
	return out
}

func setRenderField(m map[string]any, key string, value any) {
	render, _ := m[renderKey].(map[string]any)
	if render == nil {
		render = make(map[string]any)
		m[renderKey] = render
	}
	render[key] = value
}

func stringField(m map[string]any, key string) string {
	if value, ok := m[key].(string); ok {
		return value
	}
	return ""
}
