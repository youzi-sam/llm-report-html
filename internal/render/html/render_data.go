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
	ctx := &renderContext{}
	if err := ctx.enrichNode(root); err != nil {
		return nil, fmt.Errorf("prepare render data: %w", err)
	}
	out, err := json.Marshal(root)
	if err != nil {
		return nil, fmt.Errorf("marshal render data: %w", err)
	}
	return out, nil
}

type renderContext struct {
	math *mathRenderer
}

func (ctx *renderContext) enrichNode(node any) error {
	switch v := node.(type) {
	case []any:
		for _, item := range v {
			if err := ctx.enrichNode(item); err != nil {
				return err
			}
		}
	case map[string]any:
		if err := ctx.enrichSection(v); err != nil {
			return err
		}
		for _, item := range v {
			if err := ctx.enrichNode(item); err != nil {
				return err
			}
		}
	}
	return nil
}

func (ctx *renderContext) enrichSection(section map[string]any) error {
	typ, _ := section["type"].(string)
	switch typ {
	case "paragraph":
		html, err := ctx.markdownBlock(stringField(section, "text"))
		if err != nil {
			return err
		}
		setRenderField(section, renderHTML, html)
	case "quote":
		html, err := ctx.markdownInline(stringField(section, "text"))
		if err != nil {
			return err
		}
		setRenderField(section, renderTextHTML, html)
	case "code":
		setRenderField(section, renderHTML, highlightCode(stringField(section, "code"), stringField(section, "lang")))
	case "math":
		html, err := ctx.renderMath(stringField(section, "tex"), boolFieldDefault(section, "display", true))
		if err != nil {
			return fmt.Errorf("math.tex: %w", err)
		}
		setRenderField(section, renderHTML, html)
	case "callout":
		html, err := ctx.markdownBlock(stringField(section, "text"))
		if err != nil {
			return err
		}
		setRenderField(section, renderHTML, html)
	case "list":
		if items, ok := section["items"].([]any); ok {
			rendered, err := ctx.enrichListItems(items)
			if err != nil {
				return err
			}
			setRenderField(section, renderItems, rendered)
		}
	case "table":
		if rows, ok := section["rows"].([]any); ok {
			rendered, err := ctx.enrichTableRows(rows)
			if err != nil {
				return err
			}
			setRenderField(section, renderRowsHTML, rendered)
		}
	case "timeline":
		if items, ok := section["items"].([]any); ok {
			rendered, err := ctx.enrichTextItems(items, "text", renderTextHTML, ctx.markdownInline)
			if err != nil {
				return err
			}
			setRenderField(section, renderItems, rendered)
		}
	case "definition":
		if items, ok := section["items"].([]any); ok {
			rendered, err := ctx.enrichTextItems(items, "def", renderDefHTML, ctx.markdownInline)
			if err != nil {
				return err
			}
			setRenderField(section, renderItems, rendered)
		}
	case "faq":
		if items, ok := section["items"].([]any); ok {
			rendered, err := ctx.enrichTextItems(items, "a", renderAnswerHTML, ctx.markdownBlock)
			if err != nil {
				return err
			}
			setRenderField(section, renderItems, rendered)
		}
	}
	return nil
}

func (ctx *renderContext) enrichListItems(items []any) ([]any, error) {
	out := make([]any, 0, len(items))
	for _, item := range items {
		switch v := item.(type) {
		case string:
			html, err := ctx.markdownInline(v)
			if err != nil {
				return nil, err
			}
			out = append(out, map[string]any{
				"text": v,
				renderKey: map[string]any{
					renderHTML: html,
				},
			})
		case map[string]any:
			next := cloneMap(v)
			html, err := ctx.markdownInline(stringField(next, "text"))
			if err != nil {
				return nil, err
			}
			setRenderField(next, renderHTML, html)
			if children, ok := next["children"].([]any); ok {
				rendered, err := ctx.enrichListItems(children)
				if err != nil {
					return nil, err
				}
				setRenderField(next, renderChildren, rendered)
			}
			out = append(out, next)
		default:
			out = append(out, item)
		}
	}
	return out, nil
}

func (ctx *renderContext) enrichTableRows(rows []any) ([]any, error) {
	out := make([]any, 0, len(rows))
	for _, row := range rows {
		cells, ok := row.([]any)
		if !ok {
			out = append(out, row)
			continue
		}
		next := make([]any, 0, len(cells))
		for _, cell := range cells {
			html, err := ctx.markdownInline(fmt.Sprint(cell))
			if err != nil {
				return nil, err
			}
			next = append(next, html)
		}
		out = append(out, next)
	}
	return out, nil
}

func (ctx *renderContext) enrichTextItems(items []any, sourceKey, htmlKey string, render func(string) (string, error)) ([]any, error) {
	out := make([]any, 0, len(items))
	for _, item := range items {
		m, ok := item.(map[string]any)
		if !ok {
			out = append(out, item)
			continue
		}
		next := cloneMap(m)
		html, err := render(stringField(next, sourceKey))
		if err != nil {
			return nil, err
		}
		setRenderField(next, htmlKey, html)
		out = append(out, next)
	}
	return out, nil
}

func (ctx *renderContext) markdownBlock(source string) (string, error) {
	return ctx.renderMarkdown(source, false)
}

func (ctx *renderContext) markdownInline(source string) (string, error) {
	return ctx.renderMarkdown(source, true)
}

func (ctx *renderContext) renderMarkdown(source string, inline bool) (string, error) {
	preparedMath, maths, err := ctx.protectInlineMath(source)
	if err != nil {
		return "", err
	}
	prepared, binds := protectBindTokens(preparedMath)
	var buf bytes.Buffer
	if err := markdown.Convert([]byte(prepared), &buf); err != nil {
		return "", err
	}
	html := buf.String()
	if inline {
		html = trimParagraph(html)
	}
	for marker, name := range binds {
		html = strings.ReplaceAll(html, marker, `<span data-bind-text="`+name+`"></span>`)
	}
	for marker, rendered := range maths {
		html = strings.ReplaceAll(html, marker, rendered)
	}
	return html, nil
}

func (ctx *renderContext) protectInlineMath(source string) (string, map[string]string, error) {
	maths := map[string]string{}
	var out strings.Builder
	for i := 0; i < len(source); {
		if i+1 < len(source) && source[i] == '\\' && source[i+1] == '(' {
			end := findInlineMathEnd(source, i+2)
			if end < 0 {
				return "", nil, fmt.Errorf("inline math has opening \\( without closing \\)")
			}
			tex := source[i+2 : end]
			html, err := ctx.renderMath(tex, false)
			if err != nil {
				return "", nil, fmt.Errorf("inline math: %w", err)
			}
			marker := fmt.Sprintf("LRHMATH%d", len(maths))
			maths[marker] = html
			out.WriteString(marker)
			i = end + 2
			continue
		}
		out.WriteByte(source[i])
		i++
	}
	return out.String(), maths, nil
}

func findInlineMathEnd(source string, start int) int {
	for i := start; i+1 < len(source); i++ {
		if source[i] == '\\' && source[i+1] == ')' {
			return i
		}
	}
	return -1
}

func (ctx *renderContext) renderMath(tex string, display bool) (string, error) {
	if ctx.math == nil {
		renderer, err := newMathRenderer()
		if err != nil {
			return "", err
		}
		ctx.math = renderer
	}
	return ctx.math.renderToString(tex, display)
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

func boolFieldDefault(m map[string]any, key string, fallback bool) bool {
	if value, ok := m[key].(bool); ok {
		return value
	}
	return fallback
}
