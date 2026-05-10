// Package markdown is a kernel-aware markdown renderer.
//
// Dispatch is by surface.kind:
//   - "encoding" surfaces dispatch to encoding-specific render functions
//   - "layout" surfaces recurse into nested sections, with layouts that have no
//     markdown analogue (tabs, columns) degrading to linear sections with
//     headings/dividers.
//
// Reactive cells degrade: text-template references like "{$bind:NAME}" are
// substituted with the cell's default value (state) or a placeholder (computed)
// since markdown is static.
//
// This second renderer exists to validate the schema's decoupling: anything
// expressible in HTML must either render here or degrade gracefully via the
// shape-default fallback rule.
package markdown

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/yansir/llm-report-html/internal/schema"
)

var bindingRE = regexp.MustCompile(`\{\$bind:(\w+)\}`)

// templateContext holds default values for cells, used when degrading
// {$bind:NAME} references in markdown output.
type templateContext struct {
	defaults map[string]string
}

func buildContext(rawDoc map[string]interface{}) *templateContext {
	ctx := &templateContext{defaults: map[string]string{}}
	if state, ok := rawDoc["state"].(map[string]interface{}); ok {
		for name, v := range state {
			if cell, ok := v.(map[string]interface{}); ok {
				if def, ok := cell["default"]; ok {
					ctx.defaults[name] = fmt.Sprint(def)
				}
			}
		}
	}
	return ctx
}

func (c *templateContext) substitute(s string) string {
	if c == nil {
		return s
	}
	return bindingRE.ReplaceAllStringFunc(s, func(match string) string {
		name := bindingRE.FindStringSubmatch(match)[1]
		if v, ok := c.defaults[name]; ok {
			return v
		}
		return "<" + name + ">"
	})
}

// evalIf evaluates a section.if value (boolean literal or {$bind} reference).
// For unknown computed cells we default to "show" — markdown is static and
// can't track liveness, so omitting would be more surprising than showing.
func (c *templateContext) evalIf(v interface{}) bool {
	switch x := v.(type) {
	case bool:
		return x
	case map[string]interface{}:
		if name, ok := x["$bind"].(string); ok {
			if c == nil {
				return true
			}
			if def, ok := c.defaults[name]; ok {
				return def != "" && def != "false" && def != "0"
			}
			return true
		}
	}
	return true
}

func Render(doc *schema.Document) string {
	return RenderWithRaw(doc, nil)
}

// RenderWithRaw is the full-fidelity entry: pass the raw doc bytes so that
// state-cell defaults are available for {$bind:NAME} substitution. The
// HTML-side renderer doesn't need this because it has the live cell engine.
func RenderWithRaw(doc *schema.Document, raw []byte) string {
	var ctx *templateContext
	if raw != nil {
		var rawMap map[string]interface{}
		if err := json.Unmarshal(raw, &rawMap); err == nil {
			ctx = buildContext(rawMap)
		}
	}
	var sb strings.Builder
	if doc.Title != "" {
		fmt.Fprintf(&sb, "# %s\n\n", ctx.substitute(doc.Title))
	}
	meta := []string{}
	if doc.Subtitle != "" {
		meta = append(meta, doc.Subtitle)
	}
	if doc.Author != "" {
		meta = append(meta, "by "+doc.Author)
	}
	if doc.Date != "" {
		meta = append(meta, doc.Date)
	}
	if len(meta) > 0 {
		fmt.Fprintf(&sb, "_%s_\n\n", strings.Join(meta, " · "))
	}
	for _, s := range doc.Sections {
		sb.WriteString(renderSection(s, 0, ctx))
	}
	return sb.String()
}

func renderSection(s map[string]interface{}, depth int, ctx *templateContext) string {
	t, _ := s["type"].(string)
	surf := schema.Surface(t)
	if surf == nil {
		return renderUnknown(s)
	}
	// section.if visibility
	if v, ok := s["if"]; ok && !ctx.evalIf(v) {
		return ""
	}
	switch surf.Kind {
	case "encoding":
		return renderEncoding(surf.Binds, s, ctx)
	case "layout":
		return renderLayout(surf.Binds, s, depth, ctx)
	}
	return renderUnknown(s)
}

// ---------- encoding dispatch ----------

func renderEncoding(encoding string, s map[string]interface{}, ctx *templateContext) string {
	switch encoding {
	case "heading":
		level := intOf(s["level"], 2)
		if level < 1 {
			level = 1
		}
		if level > 6 {
			level = 6
		}
		return strings.Repeat("#", level) + " " + ctx.substitute(str(s["text"])) + "\n\n"
	case "paragraph":
		return ctx.substitute(str(s["text"])) + "\n\n"
	case "quote":
		text := ctx.substitute(str(s["text"]))
		body := "> " + strings.ReplaceAll(text, "\n", "\n> ") + "\n"
		if by := str(s["by"]); by != "" {
			body += ">\n> — " + by + "\n"
		}
		return body + "\n"
	case "code":
		return "```" + str(s["lang"]) + "\n" + str(s["code"]) + "\n```\n\n"
	case "divider":
		return "---\n\n"

	case "list":
		ordered, _ := s["ordered"].(bool)
		items, _ := s["items"].([]interface{})
		var sb strings.Builder
		for i, it := range items {
			marker := "- "
			if ordered {
				marker = fmt.Sprintf("%d. ", i+1)
			}
			switch v := it.(type) {
			case string:
				fmt.Fprintf(&sb, "%s%s\n", marker, v)
			case map[string]interface{}:
				fmt.Fprintf(&sb, "%s%s\n", marker, str(v["text"]))
			}
		}
		return sb.String() + "\n"

	case "table":
		cols, _ := s["columns"].([]interface{})
		rows, _ := s["rows"].([]interface{})
		if len(cols) == 0 {
			return ""
		}
		var sb strings.Builder
		header := make([]string, len(cols))
		sep := make([]string, len(cols))
		for i, c := range cols {
			header[i] = fmt.Sprint(c)
			sep[i] = "---"
		}
		fmt.Fprintf(&sb, "| %s |\n| %s |\n", strings.Join(header, " | "), strings.Join(sep, " | "))
		for _, r := range rows {
			rr, _ := r.([]interface{})
			cells := make([]string, len(rr))
			for i, c := range rr {
				cells[i] = strings.ReplaceAll(fmt.Sprint(c), "\n", " ")
			}
			fmt.Fprintf(&sb, "| %s |\n", strings.Join(cells, " | "))
		}
		return sb.String() + "\n"

	case "timeline":
		items, _ := s["items"].([]interface{})
		var sb strings.Builder
		for _, it := range items {
			m, _ := it.(map[string]interface{})
			fmt.Fprintf(&sb, "- **%s** — %s\n", str(m["date"]), str(m["text"]))
		}
		return sb.String() + "\n"

	case "definition":
		items, _ := s["items"].([]interface{})
		var sb strings.Builder
		for _, it := range items {
			m, _ := it.(map[string]interface{})
			fmt.Fprintf(&sb, "**%s**\n: %s\n\n", str(m["term"]), str(m["def"]))
		}
		return sb.String()

	case "faq":
		items, _ := s["items"].([]interface{})
		var sb strings.Builder
		for _, it := range items {
			m, _ := it.(map[string]interface{})
			fmt.Fprintf(&sb, "<details>\n<summary><b>Q:</b> %s</summary>\n\n%s\n</details>\n\n", str(m["q"]), str(m["a"]))
		}
		return sb.String()

	case "callout":
		kind := str(s["kind"])
		if kind == "" {
			kind = "info"
		}
		title := ctx.substitute(str(s["title"]))
		text := ctx.substitute(str(s["text"]))
		header := strings.ToUpper(kind)
		if title != "" {
			header += ": " + title
		}
		body := strings.ReplaceAll(text, "\n", "\n> ")
		return fmt.Sprintf("> **%s**\n>\n> %s\n\n", header, body)

	case "mermaid":
		return "```mermaid\n" + str(s["code"]) + "\n```\n\n"

	case "image":
		alt := str(s["alt"])
		src := str(s["src"])
		out := fmt.Sprintf("![%s](%s)\n", alt, src)
		if cap := str(s["caption"]); cap != "" {
			out += "_" + cap + "_\n"
		}
		return out + "\n"

	case "input":
		// Markdown can't be interactive — degrade to a labeled placeholder.
		bind := str(s["bind"])
		label := str(s["label"])
		if label == "" {
			label = bind
		}
		return fmt.Sprintf("> **[input: `%s`]** %s\n\n", bind, label)

	case "stat":
		// Render label + value (resolving {$bind} as a literal `cell.<name>`
		// reference; markdown is static so we can't sub the live value).
		label := str(s["label"])
		v := s["value"]
		var shown string
		if m, ok := v.(map[string]interface{}); ok {
			if b, ok := m["$bind"].(string); ok {
				shown = "`{$bind: " + b + "}`"
			} else {
				shown = fmt.Sprint(v)
			}
		} else {
			shown = fmt.Sprint(v)
		}
		if label != "" {
			return fmt.Sprintf("**%s:** %s\n\n", label, shown)
		}
		return shown + "\n\n"
	}
	return renderUnknown(s)
}

// ---------- layout dispatch (containers) ----------

func renderLayout(layout string, s map[string]interface{}, depth int, ctx *templateContext) string {
	switch layout {
	case "accordion":
		// details — preserve <details> in markdown for fidelity
		summary := ctx.substitute(str(s["summary"]))
		open := ""
		if b, _ := s["open"].(bool); b {
			open = " open"
		}
		var inner strings.Builder
		if subs, ok := s["sections"].([]interface{}); ok {
			for _, c := range subs {
				if m, ok := c.(map[string]interface{}); ok {
					inner.WriteString(renderSection(m, depth+1, ctx))
				}
			}
		}
		return fmt.Sprintf("<details%s>\n<summary>%s</summary>\n\n%s</details>\n\n", open, summary, inner.String())

	case "tabs":
		// degrade: linear sections with sub-headings per tab
		items, _ := s["items"].([]interface{})
		var sb strings.Builder
		for _, it := range items {
			m, _ := it.(map[string]interface{})
			label := ctx.substitute(str(m["label"]))
			if label != "" {
				fmt.Fprintf(&sb, "### %s\n\n", label)
			}
			if subs, ok := m["sections"].([]interface{}); ok {
				for _, c := range subs {
					if cm, ok := c.(map[string]interface{}); ok {
						sb.WriteString(renderSection(cm, depth+1, ctx))
					}
				}
			}
		}
		return sb.String()

	case "columns":
		// degrade: linear sections separated by horizontal rule
		items, _ := s["items"].([]interface{})
		var sb strings.Builder
		for i, it := range items {
			if i > 0 {
				sb.WriteString("---\n\n")
			}
			m, _ := it.(map[string]interface{})
			if subs, ok := m["sections"].([]interface{}); ok {
				for _, c := range subs {
					if cm, ok := c.(map[string]interface{}); ok {
						sb.WriteString(renderSection(cm, depth+1, ctx))
					}
				}
			}
		}
		return sb.String()

	case "aside":
		// degrade: blockquote
		title := ctx.substitute(str(s["title"]))
		var inner strings.Builder
		if title != "" {
			fmt.Fprintf(&inner, "**%s**\n\n", title)
		}
		if subs, ok := s["sections"].([]interface{}); ok {
			for _, c := range subs {
				if m, ok := c.(map[string]interface{}); ok {
					inner.WriteString(renderSection(m, depth+1, ctx))
				}
			}
		}
		body := strings.ReplaceAll(strings.TrimRight(inner.String(), "\n"), "\n", "\n> ")
		return "> " + body + "\n\n"
	}
	return ""
}

// ---------- helpers ----------

func renderUnknown(s map[string]interface{}) string {
	t, _ := s["type"].(string)
	return fmt.Sprintf("> _Unrendered section type `%s`._\n\n```json\n%v\n```\n\n", t, s)
}

func str(v interface{}) string {
	if v == nil {
		return ""
	}
	return fmt.Sprint(v)
}

func intOf(v interface{}, dflt int) int {
	if v == nil {
		return dflt
	}
	switch x := v.(type) {
	case int:
		return x
	case float64:
		return int(x)
	case string:
		var i int
		_, err := fmt.Sscanf(x, "%d", &i)
		if err == nil {
			return i
		}
	}
	return dflt
}
