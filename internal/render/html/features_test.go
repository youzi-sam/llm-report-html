package html

import (
	"reflect"
	"testing"
)

func TestAnalyzeFeaturesCollectsSurfacesAndDiagramKinds(t *testing.T) {
	features, err := AnalyzeFeatures([]byte(`{
		"sections": [
			{"type": "paragraph", "text": "hi"},
			{"type": "columns", "items": [
				{"sections": [
					{"type": "diagram", "kind": "flow", "nodes": [], "edges": []},
					{"type": "diagram", "kind": "sequence", "actors": [], "messages": []}
				]}
			]}
		]
	}`))
	if err != nil {
		t.Fatal(err)
	}
	assertStrings(t, features.Surfaces, []string{"columns", "diagram", "paragraph"})
	assertStrings(t, features.DiagramKinds, []string{"flow", "sequence"})
	if features.Reactive || features.Formulas {
		t.Fatalf("expected static report features, got %+v", features)
	}
}

func TestAnalyzeFeaturesMarksReactiveOnlyWhenVisibleRuntimeNeedsIt(t *testing.T) {
	features, err := AnalyzeFeatures([]byte(`{
		"state": {"unused": {"type": "number", "default": 1}},
		"computed": {"unused_formula": {"+": [1, 2]}},
		"sections": [{"type": "paragraph", "text": "static"}]
	}`))
	if err != nil {
		t.Fatal(err)
	}
	if features.Reactive || features.Formulas {
		t.Fatalf("unused state/computed should not force runtime, got %+v", features)
	}

	features, err = AnalyzeFeatures([]byte(`{
		"state": {"income": {"type": "number", "default": 1}},
		"computed": {"tax": {"*": [{"var": "income"}, 0.1]}},
		"sections": [
			{"type": "input", "bind": "income"},
			{"type": "stat", "value": {"$bind": "tax"}}
		]
	}`))
	if err != nil {
		t.Fatal(err)
	}
	if !features.Reactive || !features.Formulas {
		t.Fatalf("input + computed bind should require reactive formulas, got %+v", features)
	}
}

func assertStrings(t *testing.T, got, want []string) {
	t.Helper()
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}
