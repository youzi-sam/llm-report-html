package html

import (
	"bytes"
	stdhtml "html"
	"strings"

	"github.com/alecthomas/chroma/v2"
	chromahtml "github.com/alecthomas/chroma/v2/formatters/html"
	"github.com/alecthomas/chroma/v2/lexers"
	"github.com/alecthomas/chroma/v2/styles"
)

var codeFormatter = chromahtml.New(
	chromahtml.WithClasses(true),
	chromahtml.ClassPrefix("ch-"),
	chromahtml.PreventSurroundingPre(true),
)

var cssFormatter = chromahtml.New(
	chromahtml.WithClasses(true),
	chromahtml.ClassPrefix("ch-"),
)

func highlightCode(source, lang string) string {
	lexer := lexers.Get(lang)
	if lexer == nil && lang != "" {
		lexer = lexers.Match(lang)
	}
	if lexer == nil {
		lexer = lexers.Fallback
	}
	iterator, err := chroma.Coalesce(lexer).Tokenise(nil, source)
	if err != nil {
		return stdhtml.EscapeString(source)
	}
	var buf bytes.Buffer
	if err := codeFormatter.Format(&buf, styles.Get("github"), iterator); err != nil {
		return stdhtml.EscapeString(source)
	}
	return buf.String()
}

func codeHighlightCSS() string {
	light := chromaCSS("github")
	dark := chromaCSS("monokai")
	return strings.TrimSpace(`
.code-block code.chroma {
  display: block;
  min-width: max-content;
}
` + light + `
@media (prefers-color-scheme: dark) {
` + indentCSS(dark) + `
}
`)
}

func chromaCSS(styleName string) string {
	var buf bytes.Buffer
	_ = cssFormatter.WriteCSS(&buf, styles.Get(styleName))
	return strings.TrimSpace(buf.String())
}

func indentCSS(css string) string {
	lines := strings.Split(strings.TrimSpace(css), "\n")
	for i, line := range lines {
		lines[i] = "  " + line
	}
	return strings.Join(lines, "\n")
}
