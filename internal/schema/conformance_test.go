package schema

import (
	"errors"
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
	if _, err := os.Stat(filepath.Join("..", "..", "template", "src", "main.js")); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("template/src/main.js is a stale bootstrap entry; got stat err %v", err)
	}
	coreJS := readRepoFile(t, "template", "src", "packs", "core.js")
	if !strings.Contains(coreJS, "import { CATALOG } from '../generated/catalog.js'") {
		t.Fatal("template/src/packs/core.js must import the schema-generated catalog")
	}
	if strings.Contains(coreJS, "const CATALOG =") {
		t.Fatal("template/src/packs/core.js must not hand-write CATALOG")
	}
}

func TestEverySchemaSurfaceHasHTMLImplementation(t *testing.T) {
	encodingsJS := readRepoFiles(t, "template", "src", "encodings.js", "template", "src", "encodings")
	layoutsJS := readRepoFile(t, "template", "src", "layouts.js")
	for _, name := range SurfaceList() {
		def := Schema().SurfaceCatalog[name]
		src := encodingsJS
		if def.Kind == "layout" {
			src = layoutsJS
		}
		if !hasObjectKey(src, def.Binds) {
			t.Fatalf("surface %q resolves to %s/%s but template/src/%ss.js has no implementation key %q", name, def.Kind, def.Binds, def.Kind, def.Binds)
		}
	}
}

func readRepoFiles(t *testing.T, parts ...string) string {
	t.Helper()
	if len(parts)%3 != 0 {
		t.Fatalf("readRepoFiles expects triples, got %d parts", len(parts))
	}
	var out strings.Builder
	for i := 0; i < len(parts); i += 3 {
		path := filepath.Join("..", "..", parts[i], parts[i+1], parts[i+2])
		info, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if !info.IsDir() {
			out.WriteString(readRepoPath(t, path))
			out.WriteByte('\n')
			continue
		}
		err = filepath.WalkDir(path, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return err
			}
			if d.IsDir() || filepath.Ext(path) != ".js" {
				return nil
			}
			out.WriteString(readRepoPath(t, path))
			out.WriteByte('\n')
			return nil
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	return out.String()
}

func readRepoFile(t *testing.T, parts ...string) string {
	t.Helper()
	path := filepath.Join(append([]string{"..", ".."}, parts...)...)
	return readRepoPath(t, path)
}

func readRepoPath(t *testing.T, path string) string {
	t.Helper()
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
