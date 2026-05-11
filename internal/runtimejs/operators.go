package runtimejs

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/dop251/goja"
)

type Bundle struct {
	Script    string
	Operators map[string]Contract
}

type Contract struct {
	Name    string
	Args    []string
	Returns string
}

type document struct {
	Runtime struct {
		Operators []string `json:"operators"`
	} `json:"runtime"`
	Cells map[string]cell `json:"cells"`
}

type cell struct {
	Kind string `json:"kind"`
	Type string `json:"type"`
	Expr any    `json:"expr"`
}

type compiledModule struct {
	Path      string
	Source    string
	Script    string
	Contract  Contract
	TestCount int
}

var (
	operatorNameRE  = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)
	defaultExportRE = regexp.MustCompile(`\bexport\s+default\s+defineOperator\s*\(`)
	forbiddenRefs   = []*regexp.Regexp{
		regexp.MustCompile(`\bimport\b`),
		regexp.MustCompile(`\beval\b`),
		regexp.MustCompile(`\bFunction\b`),
		regexp.MustCompile(`\bfetch\b`),
		regexp.MustCompile(`\bXMLHttpRequest\b`),
		regexp.MustCompile(`\bWebSocket\b`),
		regexp.MustCompile(`\blocalStorage\b`),
		regexp.MustCompile(`\bsessionStorage\b`),
		regexp.MustCompile(`\bindexedDB\b`),
		regexp.MustCompile(`\bsetTimeout\b`),
		regexp.MustCompile(`\bsetInterval\b`),
		regexp.MustCompile(`\brequestAnimationFrame\b`),
		regexp.MustCompile(`\bqueueMicrotask\b`),
		regexp.MustCompile(`\bDate\b`),
		regexp.MustCompile(`\bcrypto\b`),
		regexp.MustCompile(`\bdocument\b`),
		regexp.MustCompile(`\bwindow\b`),
		regexp.MustCompile(`\bglobalThis\b`),
		regexp.MustCompile(`\bnavigator\b`),
		regexp.MustCompile(`\blocation\b`),
		regexp.MustCompile(`\bhistory\b`),
		regexp.MustCompile(`\bMath\s*\.\s*random\b`),
	}
)

func Compile(rawDocJSON []byte, inputPath string) (Bundle, error) {
	var doc document
	if err := json.Unmarshal(rawDocJSON, &doc); err != nil {
		return Bundle{}, fmt.Errorf("runtime operators: parse document: %w", err)
	}
	if len(doc.Runtime.Operators) == 0 {
		if err := validateCellExpressions(doc.Cells, nil); err != nil {
			return Bundle{}, err
		}
		return Bundle{}, nil
	}
	if inputPath == "" {
		return Bundle{}, fmt.Errorf("runtime.operators requires a file input path; stdin has no module base directory")
	}

	baseDir := filepath.Dir(inputPath)
	compiled := make([]compiledModule, 0, len(doc.Runtime.Operators))
	contracts := make(map[string]Contract)
	for _, specPath := range doc.Runtime.Operators {
		path, err := resolveOperatorPath(baseDir, specPath)
		if err != nil {
			return Bundle{}, err
		}
		source, err := os.ReadFile(path)
		if err != nil {
			return Bundle{}, fmt.Errorf("runtime.operators %q: %w", specPath, err)
		}
		module, err := compileModule(specPath, string(source))
		if err != nil {
			return Bundle{}, err
		}
		if _, exists := contracts[module.Contract.Name]; exists {
			return Bundle{}, fmt.Errorf("runtime operator %q is declared more than once", module.Contract.Name)
		}
		contracts[module.Contract.Name] = module.Contract
		compiled = append(compiled, module)
	}
	if err := validateCellExpressions(doc.Cells, contracts); err != nil {
		return Bundle{}, err
	}
	return Bundle{
		Script:    buildBrowserScript(compiled),
		Operators: contracts,
	}, nil
}

func resolveOperatorPath(baseDir, specPath string) (string, error) {
	if filepath.IsAbs(specPath) {
		return "", fmt.Errorf("runtime.operators %q: absolute paths are not allowed", specPath)
	}
	clean := filepath.Clean(specPath)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", fmt.Errorf("runtime.operators %q: path must stay under the report directory", specPath)
	}
	ext := filepath.Ext(clean)
	if ext != ".js" && ext != ".mjs" {
		return "", fmt.Errorf("runtime.operators %q: module must end in .js or .mjs", specPath)
	}
	return filepath.Join(baseDir, clean), nil
}

func compileModule(path, source string) (compiledModule, error) {
	if err := lintSource(path, source); err != nil {
		return compiledModule{}, err
	}
	script, err := transformModule(path, source)
	if err != nil {
		return compiledModule{}, err
	}
	rt := goja.New()
	installSandbox(rt)
	if err := rt.Set("defineOperator", func(call goja.FunctionCall) goja.Value {
		return call.Argument(0)
	}); err != nil {
		return compiledModule{}, err
	}
	value, err := rt.RunString("(function(){\n\"use strict\";\n" + script + "\n})()")
	if err != nil {
		return compiledModule{}, fmt.Errorf("runtime.operators %q: module evaluation failed: %w", path, err)
	}
	contract, testCount, err := validateOperatorSpec(rt, path, value)
	if err != nil {
		return compiledModule{}, err
	}
	return compiledModule{
		Path:      path,
		Source:    source,
		Script:    script,
		Contract:  contract,
		TestCount: testCount,
	}, nil
}

func lintSource(path, source string) error {
	matches := defaultExportRE.FindAllStringIndex(source, -1)
	if len(matches) != 1 {
		return fmt.Errorf("runtime.operators %q: module must export exactly one default defineOperator(...) call", path)
	}
	withoutDefault := defaultExportRE.ReplaceAllString(source, "")
	if regexp.MustCompile(`\bexport\b`).MatchString(withoutDefault) {
		return fmt.Errorf("runtime.operators %q: secondary exports are not allowed", path)
	}
	for _, re := range forbiddenRefs {
		if re.MatchString(source) {
			return fmt.Errorf("runtime.operators %q: forbidden runtime reference %q", path, re.String())
		}
	}
	return nil
}

func transformModule(path, source string) (string, error) {
	if !defaultExportRE.MatchString(source) {
		return "", fmt.Errorf("runtime.operators %q: missing export default defineOperator(...)", path)
	}
	return defaultExportRE.ReplaceAllString(source, "return defineOperator("), nil
}

func installSandbox(rt *goja.Runtime) {
	for _, name := range []string{
		"fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage",
		"indexedDB", "setTimeout", "setInterval", "requestAnimationFrame",
		"queueMicrotask", "Date", "crypto", "document", "window", "globalThis",
		"navigator", "location", "history",
	} {
		_ = rt.Set(name, nil)
	}
	math := rt.GlobalObject().Get("Math").ToObject(rt)
	_ = math.Set("random", func(goja.FunctionCall) goja.Value {
		panic(rt.NewTypeError("Math.random is not allowed in runtime operator modules"))
	})
}

func validateOperatorSpec(rt *goja.Runtime, path string, value goja.Value) (Contract, int, error) {
	if goja.IsUndefined(value) || goja.IsNull(value) {
		return Contract{}, 0, fmt.Errorf("runtime.operators %q: defineOperator must return a spec object", path)
	}
	obj := value.ToObject(rt)
	name, err := requiredString(obj, "name")
	if err != nil {
		return Contract{}, 0, fmt.Errorf("runtime.operators %q: %w", path, err)
	}
	if !operatorNameRE.MatchString(name) {
		return Contract{}, 0, fmt.Errorf("runtime.operators %q: invalid operator name %q", path, name)
	}
	args, err := requiredStringSlice(obj, "args")
	if err != nil {
		return Contract{}, 0, fmt.Errorf("runtime.operators %q: %w", path, err)
	}
	for _, typ := range args {
		if !isRuntimeType(typ) {
			return Contract{}, 0, fmt.Errorf("runtime.operators %q: unsupported arg type %q", path, typ)
		}
	}
	returns, err := requiredString(obj, "returns")
	if err != nil {
		return Contract{}, 0, fmt.Errorf("runtime.operators %q: %w", path, err)
	}
	if !isRuntimeType(returns) {
		return Contract{}, 0, fmt.Errorf("runtime.operators %q: unsupported return type %q", path, returns)
	}
	if pure := obj.Get("pure"); pure != nil && !pure.ToBoolean() {
		return Contract{}, 0, fmt.Errorf("runtime.operators %q: pure must be true", path)
	}
	run, ok := goja.AssertFunction(obj.Get("run"))
	if !ok {
		return Contract{}, 0, fmt.Errorf("runtime.operators %q: run must be a function", path)
	}
	tests, err := requiredTests(obj)
	if err != nil {
		return Contract{}, 0, fmt.Errorf("runtime.operators %q: %w", path, err)
	}
	contract := Contract{Name: name, Args: args, Returns: returns}
	for index, test := range tests {
		if err := runOperatorTest(rt, run, contract, index, test); err != nil {
			return Contract{}, 0, fmt.Errorf("runtime.operators %q: %w", path, err)
		}
	}
	return contract, len(tests), nil
}

func requiredString(obj *goja.Object, key string) (string, error) {
	value := obj.Get(key)
	if goja.IsUndefined(value) || goja.IsNull(value) {
		return "", fmt.Errorf("%s is required", key)
	}
	out, ok := value.Export().(string)
	if !ok || out == "" {
		return "", fmt.Errorf("%s must be a non-empty string", key)
	}
	return out, nil
}

func requiredStringSlice(obj *goja.Object, key string) ([]string, error) {
	raw := obj.Get(key).Export()
	items, ok := raw.([]interface{})
	if !ok {
		return nil, fmt.Errorf("%s must be an array of strings", key)
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		value, ok := item.(string)
		if !ok || value == "" {
			return nil, fmt.Errorf("%s must be an array of non-empty strings", key)
		}
		out = append(out, value)
	}
	return out, nil
}

type operatorTest struct {
	Args    []interface{} `json:"args"`
	Returns interface{}   `json:"returns"`
}

func requiredTests(obj *goja.Object) ([]operatorTest, error) {
	body, err := json.Marshal(obj.Get("tests").Export())
	if err != nil {
		return nil, fmt.Errorf("tests must be JSON-serializable: %w", err)
	}
	var tests []operatorTest
	if err := json.Unmarshal(body, &tests); err != nil {
		return nil, fmt.Errorf("tests must be an array of {args, returns}: %w", err)
	}
	if len(tests) == 0 {
		return nil, fmt.Errorf("tests must contain at least one case")
	}
	for i, test := range tests {
		if test.Args == nil {
			return nil, fmt.Errorf("tests[%d].args is required", i)
		}
	}
	return tests, nil
}

func runOperatorTest(rt *goja.Runtime, run goja.Callable, contract Contract, index int, test operatorTest) error {
	if len(test.Args) != len(contract.Args) {
		return fmt.Errorf("tests[%d].args length=%d, want %d", index, len(test.Args), len(contract.Args))
	}
	args := make([]goja.Value, 0, len(test.Args))
	for i, arg := range test.Args {
		if !matchesRuntimeType(arg, contract.Args[i]) {
			return fmt.Errorf("tests[%d].args[%d] has type %s, want %s", index, i, valueType(arg), contract.Args[i])
		}
		args = append(args, rt.ToValue(arg))
	}
	got, err := run(goja.Undefined(), args...)
	if err != nil {
		return fmt.Errorf("tests[%d] threw: %w", index, err)
	}
	gotExport := got.Export()
	if !matchesRuntimeType(gotExport, contract.Returns) {
		return fmt.Errorf("tests[%d].returns has type %s, want %s", index, valueType(gotExport), contract.Returns)
	}
	if !jsonEqual(gotExport, test.Returns) {
		return fmt.Errorf("tests[%d].returns mismatch: got %s, want %s", index, jsonForError(gotExport), jsonForError(test.Returns))
	}
	return nil
}

func validateCellExpressions(cells map[string]cell, contracts map[string]Contract) error {
	cellTypes := make(map[string]string, len(cells))
	for name, cell := range cells {
		cellTypes[name] = normalizeType(cell.Type)
	}
	names := make([]string, 0, len(cells))
	for name := range cells {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		cell := cells[name]
		if cell.Kind != "computed" {
			continue
		}
		got, err := inferExprType(cell.Expr, cellTypes, contracts)
		if err != nil {
			return fmt.Errorf("cells.%s.expr: %w", name, err)
		}
		want := normalizeType(cell.Type)
		if got != "any" && got != want {
			return fmt.Errorf("cells.%s.type: expression returns %s, declared %s", name, got, want)
		}
	}
	return nil
}

func inferExprType(expr any, cellTypes map[string]string, contracts map[string]Contract) (string, error) {
	obj, ok := expr.(map[string]interface{})
	if !ok {
		return "any", nil
	}
	if value, ok := obj["value"]; ok {
		return valueType(value), nil
	}
	if name, ok := obj["cell"].(string); ok {
		typ, ok := cellTypes[name]
		if !ok {
			return "", fmt.Errorf("references undeclared cell %q", name)
		}
		return typ, nil
	}
	call, ok := obj["call"].(string)
	if !ok {
		return "any", nil
	}
	contract, ok := contracts[call]
	if !ok {
		return "", fmt.Errorf("operator %q is not declared in runtime.operators", call)
	}
	rawArgs, _ := obj["args"].([]interface{})
	if len(rawArgs) != len(contract.Args) {
		return "", fmt.Errorf("operator %q expects %d args, got %d", call, len(contract.Args), len(rawArgs))
	}
	for i, arg := range rawArgs {
		got, err := inferExprType(arg, cellTypes, contracts)
		if err != nil {
			return "", err
		}
		want := normalizeType(contract.Args[i])
		if got != "any" && want != "any" && got != want {
			return "", fmt.Errorf("operator %q arg %d expects %s, got %s", call, i, want, got)
		}
	}
	return normalizeType(contract.Returns), nil
}

func buildBrowserScript(modules []compiledModule) string {
	var b strings.Builder
	b.WriteString("(function(){\n")
	b.WriteString("\"use strict\";\n")
	b.WriteString("const registry=globalThis.LRH_OPERATORS||(globalThis.LRH_OPERATORS=Object.create(null));\n")
	b.WriteString("const defineOperator=spec=>spec;\n")
	for _, module := range modules {
		b.WriteString("registry[")
		b.WriteString(jsonForScript(module.Contract.Name))
		b.WriteString("]=(function(){\n")
		b.WriteString(module.Script)
		b.WriteString("\n})().run;\n")
	}
	b.WriteString("})();")
	return b.String()
}

func jsonForScript(value string) string {
	body, _ := json.Marshal(value)
	return string(body)
}

func isRuntimeType(typ string) bool {
	switch normalizeType(typ) {
	case "number", "text", "boolean", "array", "object", "any":
		return true
	default:
		return false
	}
}

func normalizeType(typ string) string {
	switch typ {
	case "string":
		return "text"
	case "select":
		return "text"
	default:
		return typ
	}
}

func matchesRuntimeType(value interface{}, typ string) bool {
	switch normalizeType(typ) {
	case "any":
		return true
	case "number":
		return isNumber(value)
	case "text":
		_, ok := value.(string)
		return ok
	case "boolean":
		_, ok := value.(bool)
		return ok
	case "array":
		_, ok := value.([]interface{})
		return ok
	case "object":
		_, ok := value.(map[string]interface{})
		return ok
	default:
		return false
	}
}

func isNumber(value interface{}) bool {
	switch v := value.(type) {
	case int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64:
		return true
	case float32:
		return !math.IsNaN(float64(v)) && !math.IsInf(float64(v), 0)
	case float64:
		return !math.IsNaN(v) && !math.IsInf(v, 0)
	case json.Number:
		_, err := v.Float64()
		return err == nil
	default:
		return false
	}
}

func valueType(value interface{}) string {
	if value == nil {
		return "any"
	}
	switch value.(type) {
	case string:
		return "text"
	case bool:
		return "boolean"
	case []interface{}:
		return "array"
	case map[string]interface{}:
		return "object"
	default:
		if isNumber(value) {
			return "number"
		}
		return "any"
	}
}

func jsonEqual(a, b interface{}) bool {
	return bytes.Equal(mustJSON(a), mustJSON(b))
}

func jsonForError(value interface{}) string {
	return string(mustJSON(value))
}

func mustJSON(value interface{}) []byte {
	body, err := json.Marshal(value)
	if err != nil {
		return []byte(fmt.Sprintf("%v", value))
	}
	return body
}
