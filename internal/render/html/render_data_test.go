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
