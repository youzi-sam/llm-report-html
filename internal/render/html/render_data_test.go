package html

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestPrepareRenderDataPrecompilesMarkdown(t *testing.T) {
	raw := []byte(`{
		"sections": [
			{"type": "paragraph", "text": "**Cloudflare** <b>x</b>"},
			{"type": "callout", "kind": "success", "text": "**{$bind:count}** ready"}
		]
	}`)
	renderData, err := PrepareRenderData(raw)
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(renderData, &doc); err != nil {
		t.Fatal(err)
	}
	sections := doc["sections"].([]any)
	paragraph := sections[0].(map[string]any)
	callout := sections[1].(map[string]any)
	if got := renderString(t, paragraph, "html"); !strings.Contains(got, "<strong>Cloudflare</strong>") || strings.Contains(got, "<b>x</b>") {
		t.Fatalf("paragraph markdown/html escaping mismatch: %q", got)
	}
	if got := renderString(t, callout, "html"); !strings.Contains(got, `<strong><span data-bind-text="count"></span></strong> ready`) {
		t.Fatalf("bind placeholder not preserved through markdown: %q", got)
	}
}

func TestPrepareRenderDataHighlightsCode(t *testing.T) {
	raw := []byte(`{"sections":[{"type":"code","lang":"go","code":"package main\nfunc main() {}"}]}`)
	renderData, err := PrepareRenderData(raw)
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(renderData, &doc); err != nil {
		t.Fatal(err)
	}
	code := doc["sections"].([]any)[0].(map[string]any)
	html := renderString(t, code, "html")
	if !strings.Contains(html, "ch-") || !strings.Contains(html, "package") {
		t.Fatalf("expected highlighted code HTML, got %q", html)
	}
}

func TestPrepareRenderDataRendersBlockAndInlineMath(t *testing.T) {
	raw := []byte(`{
		"sections": [
			{"type": "paragraph", "text": "Pythagoras: \\(a^2+b^2=c^2\\), not $100."},
			{"type": "math", "tex": "\\\\int_0^1 x^2 \\\\, dx = \\\\frac{1}{3}", "display": true}
		]
	}`)
	renderData, err := PrepareRenderData(raw)
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(renderData, &doc); err != nil {
		t.Fatal(err)
	}
	sections := doc["sections"].([]any)
	paragraph := sections[0].(map[string]any)
	block := sections[1].(map[string]any)
	if got := renderString(t, paragraph, "html"); !strings.Contains(got, `<math`) || !strings.Contains(got, "$100") || strings.Contains(got, `katex-html`) {
		t.Fatalf("inline math mismatch: %q", got)
	}
	if got := renderString(t, block, "html"); !strings.Contains(got, `<math`) || !strings.Contains(got, `display="block"`) || strings.Contains(got, `katex-html`) {
		t.Fatalf("block math mismatch: %q", got)
	}
}

func TestPrepareRenderDataSupportsChemicalNotationAndUnits(t *testing.T) {
	raw := []byte(`{
		"sections": [
			{"type": "paragraph", "text": "Buffer equilibrium: \\(\\ce{CO2 + H2O <=> HCO3- + H+}\\), with concentration \\(\\pu{1.2e-3 mol L-1}\\)."},
			{"type": "math", "tex": "\\ce{Cr2O7^2- + 14H+ + 6e- -> 2Cr^3+ + 7H2O}", "display": true}
		]
	}`)
	renderData, err := PrepareRenderData(raw)
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(renderData, &doc); err != nil {
		t.Fatal(err)
	}
	sections := doc["sections"].([]any)
	paragraph := renderString(t, sections[0].(map[string]any), "html")
	block := renderString(t, sections[1].(map[string]any), "html")
	if strings.Count(paragraph, `<math`) != 2 || !strings.Contains(paragraph, `CO2 + H2O`) || !strings.Contains(paragraph, `1.2e-3 mol L-1`) {
		t.Fatalf("inline chemical math mismatch: %q", paragraph)
	}
	if !strings.Contains(block, `<math`) || !strings.Contains(block, `Cr2O7^2- + 14H+ + 6e-`) {
		t.Fatalf("block chemical math mismatch: %q", block)
	}
}

func TestPrepareRenderDataRejectsInvalidMath(t *testing.T) {
	raw := []byte(`{"sections":[{"type":"math","tex":"\\\\notacommand{"}]}`)
	if _, err := PrepareRenderData(raw); err == nil || !strings.Contains(err.Error(), "KaTeX render failed") {
		t.Fatalf("expected KaTeX error, got %v", err)
	}
}

func TestRenderKeepsExtractableSourceDataSeparateFromRenderData(t *testing.T) {
	raw := []byte(`{"sections":[{"type":"paragraph","text":"**hi**"}]}`)
	out, err := RenderWithSourceHref(raw, "custom-report.json")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, `class="source-json-link" href="custom-report.json" target="_blank"`) {
		t.Fatalf("expected source JSON link, got %q", out)
	}
	if strings.Contains(out, `source-json-control`) || strings.Contains(out, `<details class="source-json"`) {
		t.Fatalf("source JSON popup controls must not be rendered, got %q", out)
	}
	if strings.Count(out, `id="report-data"`) != 1 || strings.Count(out, `id="report-render-data"`) != 1 {
		t.Fatalf("expected source and render data slots, got %q", out)
	}
	if strings.Contains(slot(out, `id="report-data"`), `"render"`) {
		t.Fatal("source slot must not contain derived render fields")
	}
	if !strings.Contains(slot(out, `id="report-render-data"`), `"render"`) {
		t.Fatal("render slot must contain derived render fields")
	}
}

func TestRenderUsesNativeMathMLWithoutKaTeXCSS(t *testing.T) {
	static, err := RenderWithSourceHref([]byte(`{"sections":[{"type":"paragraph","text":"plain"}]}`), "plain.json")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(static, "KaTeX_Main") {
		t.Fatal("static report should not include KaTeX CSS")
	}

	withMath, err := RenderWithSourceHref([]byte(`{"sections":[{"type":"math","tex":"E=mc^2"}]}`), "math.json")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(withMath, "KaTeX_Main") || strings.Contains(withMath, "@font-face") || strings.Contains(withMath, "katex-html") {
		t.Fatal("math report must not include KaTeX CSS/font or HTML layout layer")
	}

	var rendered map[string]any
	if err := json.Unmarshal([]byte(slot(withMath, `id="report-render-data"`)), &rendered); err != nil {
		t.Fatal(err)
	}
	section := rendered["sections"].([]any)[0].(map[string]any)
	if !strings.Contains(renderString(t, section, "html"), `<math`) {
		t.Fatal("math report should include native MathML")
	}
}

func renderString(t *testing.T, node map[string]any, key string) string {
	t.Helper()
	render, ok := node["render"].(map[string]any)
	if !ok {
		t.Fatalf("missing render object in %#v", node)
	}
	value, ok := render[key].(string)
	if !ok {
		t.Fatalf("missing render.%s in %#v", key, node)
	}
	return value
}

func slot(html, idAttr string) string {
	idx := strings.Index(html, idAttr)
	if idx < 0 {
		return ""
	}
	start := strings.Index(html[idx:], ">")
	if start < 0 {
		return ""
	}
	start += idx + 1
	end := strings.Index(html[start:], "</script>")
	if end < 0 {
		return ""
	}
	return html[start : start+end]
}
