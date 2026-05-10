package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateUnknownFlagFails(t *testing.T) {
	err := cmdValidate([]string{"--definitely-not-real", filepath.Join("..", "..", "recipes", "calculator.json")})
	if err == nil || !strings.Contains(err.Error(), "unknown flag") {
		t.Fatalf("expected unknown flag error, got %v", err)
	}
}

func TestRenderMarkdownTargetUnsupported(t *testing.T) {
	path := writeTempDoc(t, `{"sections":[{"type":"paragraph","text":"hello"}]}`)
	err := cmdRender([]string{path, "--target", "md", "--stdout", "--no-open"})
	if err == nil || !strings.Contains(err.Error(), `unknown target "md"`) {
		t.Fatalf("expected unsupported md target, got %v", err)
	}
}

func TestValidateUndeclaredBindFails(t *testing.T) {
	path := writeTempDoc(t, `{"sections":[{"type":"stat","label":"X","value":{"$bind":"missing"}}]}`)
	err := cmdValidate([]string{path})
	if err == nil || !strings.Contains(err.Error(), "semantic validation failed") || !strings.Contains(err.Error(), "undeclared-cell") {
		t.Fatalf("expected undeclared-cell semantic error, got %v", err)
	}
}

func TestRenderRunsSemanticValidation(t *testing.T) {
	path := writeTempDoc(t, `{"sections":[{"type":"stat","label":"X","value":{"$bind":"missing"}}]}`)
	err := cmdRender([]string{path, "--target", "json", "--stdout"})
	if err == nil || !strings.Contains(err.Error(), "semantic validation failed") {
		t.Fatalf("expected render to block semantic error, got %v", err)
	}
}

func TestValidateDiagramRefsFail(t *testing.T) {
	path := writeTempDoc(t, `{
		"sections":[{
			"type":"diagram",
			"kind":"flow",
			"nodes":[{"id":"a","label":"A"}],
			"edges":[{"from":"a","to":"missing"}]
		}]
	}`)
	err := cmdValidate([]string{path})
	if err == nil || !strings.Contains(err.Error(), "undeclared-node") {
		t.Fatalf("expected undeclared-node semantic error, got %v", err)
	}
}

func TestValidateInputBindMustReferenceState(t *testing.T) {
	path := writeTempDoc(t, `{
		"computed":{"x":{"+":[1,2]}},
		"sections":[{"type":"input","bind":"x"}]
	}`)
	err := cmdValidate([]string{path})
	if err == nil || !strings.Contains(err.Error(), "input-bind-kind") {
		t.Fatalf("expected input-bind-kind semantic error, got %v", err)
	}
}

func TestValidateComputedCycleFails(t *testing.T) {
	path := writeTempDoc(t, `{
		"computed":{
			"a":{"var":"b"},
			"b":{"var":"a"}
		},
		"sections":[{"type":"stat","label":"A","value":{"$bind":"a"}}]
	}`)
	err := cmdValidate([]string{path})
	if err == nil || !strings.Contains(err.Error(), "cycle") {
		t.Fatalf("expected cycle semantic error, got %v", err)
	}
}

func TestValidatePresentationWarningsDoNotFail(t *testing.T) {
	path := writeTempDoc(t, `{
		"state":{"unused":{"type":"number","default":1}},
		"sections":[{"type":"paragraph","text":"hello"}]
	}`)
	if err := cmdValidate([]string{path}); err != nil {
		t.Fatalf("expected warning-only document to validate, got %v", err)
	}
}

func TestSchemaUnknownFlagReturnsError(t *testing.T) {
	err := cmdSchema([]string{"--definitely-not-real"})
	if err == nil || !strings.Contains(err.Error(), "unknown flag") {
		t.Fatalf("expected schema unknown flag error, got %v", err)
	}
}

func TestSchemaMissingExampleValueReturnsError(t *testing.T) {
	err := cmdSchema([]string{"--example"})
	if err == nil || !strings.Contains(err.Error(), "schema --example") {
		t.Fatalf("expected schema --example usage error, got %v", err)
	}
}

func TestRunUnknownCommandUsesUsageExitCode(t *testing.T) {
	err := run([]string{"wat"})
	exitErr, ok := err.(exitCodeError)
	if !ok || exitErr.code != 2 {
		t.Fatalf("expected usage exit code 2, got %#v", err)
	}
}

func writeTempDoc(t *testing.T, body string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "doc.json")
	if err := os.WriteFile(path, []byte(body), 0644); err != nil {
		t.Fatal(err)
	}
	return path
}
