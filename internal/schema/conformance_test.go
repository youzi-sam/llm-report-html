package schema

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"
)

func TestSurfaceListIsSorted(t *testing.T) {
	got := SurfaceList()
	want := append([]string(nil), got...)
	sort.Strings(want)
	if strings.Join(got, "\x00") != strings.Join(want, "\x00") {
		t.Fatalf("SurfaceList is not sorted: %v", got)
	}
}

func TestGeneratedSchemaIsCurrent(t *testing.T) {
	cmd := exec.Command("node", "generate-schema.mjs", "--check")
	cmd.Dir = "."
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("schema generation check failed: %v\n%s", err, out)
	}
}

func TestHTMLRuntimeUsesGeneratedCatalog(t *testing.T) {
	mainJS := readRepoFile(t, "template", "src", "main.js")
	if !strings.Contains(mainJS, "import { CATALOG } from './generated/catalog.js'") {
		t.Fatal("template/src/main.js must import the schema-generated catalog")
	}
	if strings.Contains(mainJS, "const CATALOG =") {
		t.Fatal("template/src/main.js must not hand-write CATALOG")
	}
}

func TestEverySchemaSurfaceHasHTMLImplementation(t *testing.T) {
	mainJS := readRepoFile(t, "template", "src", "main.js")
	for _, name := range SurfaceList() {
		def := Schema().SurfaceCatalog[name]
		if !hasObjectKey(mainJS, def.Binds) {
			t.Fatalf("surface %q resolves to %s/%s but template/src/main.js has no implementation key %q", name, def.Kind, def.Binds, def.Binds)
		}
	}
}

func TestSchemaOperatorsMatchJSImplementations(t *testing.T) {
	operatorsJS := readRepoFile(t, "template", "src", "operators.js")
	found := map[string]bool{}
	re := regexp.MustCompile(`add_operation\(['"]([^'"]+)['"]`)
	for _, m := range re.FindAllStringSubmatch(operatorsJS, -1) {
		found[m[1]] = true
	}
	for name := range Schema().Operators {
		if !found[name] {
			t.Fatalf("schema documents operator %q but template/src/operators.js does not register it", name)
		}
	}
	for name := range found {
		if _, ok := Schema().Operators[name]; !ok {
			t.Fatalf("template/src/operators.js registers operator %q but schema does not document it", name)
		}
	}
}

func readRepoFile(t *testing.T, parts ...string) string {
	t.Helper()
	path := filepath.Join(append([]string{"..", ".."}, parts...)...)
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return string(body)
}

func hasObjectKey(src, key string) bool {
	re := regexp.MustCompile(`(?m)^\s*` + regexp.QuoteMeta(key) + `\s*:`)
	return re.MatchString(src)
}
