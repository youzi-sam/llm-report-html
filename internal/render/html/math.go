package html

import (
	"fmt"
	"strings"

	"github.com/dop251/goja"
)

const (
	katexMaxSize   = 10
	katexMaxExpand = 1000
)

type mathRenderer struct {
	runtime *goja.Runtime
	render  goja.Callable
}

func newMathRenderer() (*mathRenderer, error) {
	source, err := readAsset("assets/katex.min.js")
	if err != nil {
		return nil, err
	}
	mhchem, err := readAsset("assets/mhchem.min.js")
	if err != nil {
		return nil, err
	}
	rt := goja.New()
	if _, err := rt.RunString(source); err != nil {
		return nil, fmt.Errorf("load katex renderer: %w", err)
	}
	if _, err := rt.RunString(mhchem); err != nil {
		return nil, fmt.Errorf("load mhchem renderer: %w", err)
	}
	katex := rt.Get("katex")
	if goja.IsUndefined(katex) || goja.IsNull(katex) {
		return nil, fmt.Errorf("load katex renderer: global katex missing")
	}
	render, ok := goja.AssertFunction(katex.ToObject(rt).Get("renderToString"))
	if !ok {
		return nil, fmt.Errorf("load katex renderer: renderToString missing")
	}
	return &mathRenderer{runtime: rt, render: render}, nil
}

func (r *mathRenderer) renderToString(tex string, display bool) (string, error) {
	if strings.TrimSpace(tex) == "" {
		return "", fmt.Errorf("empty TeX expression")
	}
	options := map[string]any{
		"displayMode":  display,
		"output":       "mathml",
		"throwOnError": true,
		"trust":        false,
		"maxSize":      katexMaxSize,
		"maxExpand":    katexMaxExpand,
	}
	value, err := r.render(goja.Undefined(), r.runtime.ToValue(tex), r.runtime.ToValue(options))
	if err != nil {
		return "", fmt.Errorf("KaTeX render failed: %w", err)
	}
	return value.String(), nil
}
