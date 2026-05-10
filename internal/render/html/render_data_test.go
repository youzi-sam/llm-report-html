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
	if got := paragraph["__html"].(string); !strings.Contains(got, "<strong>Cloudflare</strong>") || strings.Contains(got, "<b>x</b>") {
		t.Fatalf("paragraph markdown/html escaping mismatch: %q", got)
	}
	if got := callout["__html"].(string); !strings.Contains(got, `<strong><span data-bind-text="count"></span></strong> ready`) {
		t.Fatalf("bind placeholder not preserved through markdown: %q", got)
	}
}

func TestRenderKeepsExtractableSourceDataSeparateFromRenderData(t *testing.T) {
	raw := []byte(`{"sections":[{"type":"paragraph","text":"**hi**"}]}`)
	out, err := Render(raw)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Count(out, `id="report-data"`) != 1 || strings.Count(out, `id="report-render-data"`) != 1 {
		t.Fatalf("expected source and render data slots, got %q", out)
	}
	if strings.Contains(slot(out, `id="report-data"`), "__html") {
		t.Fatal("source slot must not contain derived render fields")
	}
	if !strings.Contains(slot(out, `id="report-render-data"`), "__html") {
		t.Fatal("render slot must contain derived render fields")
	}
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
