package schema

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v5"
)

// Document is the parsed report doc structure.
type Document struct {
	Title    string                   `json:"title"`
	Subtitle string                   `json:"subtitle"`
	Author   string                   `json:"author"`
	Date     string                   `json:"date"`
	Sections []map[string]interface{} `json:"sections"`
}

var compiledSchema *jsonschema.Schema

func init() {
	c := jsonschema.NewCompiler()
	c.Draft = jsonschema.Draft2020
	if err := c.AddResource("schema.json", bytes.NewReader(schemaJSON)); err != nil {
		panic(fmt.Sprintf("schema: cannot register resource: %v", err))
	}
	sch, err := c.Compile("schema.json")
	if err != nil {
		panic(fmt.Sprintf("schema: compile failed: %v", err))
	}
	compiledSchema = sch
}

// ParseAndValidate accepts raw JSON, parses to interface{}, runs strict
// JSON Schema 2020-12 validation against the embedded v2.json, then converts
// to Document for downstream renderers.
func ParseAndValidate(raw []byte) (*Document, error) {
	var v interface{}
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, fmt.Errorf("not valid JSON: %w", err)
	}
	if err := compiledSchema.Validate(v); err != nil {
		return nil, formatValidationError(err)
	}
	var d Document
	if err := json.Unmarshal(raw, &d); err != nil {
		return nil, err
	}
	return &d, nil
}

// formatValidationError walks the jsonschema error tree and emits one line per
// leaf failure: "  /sections/3/kind: <message>".
func formatValidationError(err error) error {
	ve, ok := err.(*jsonschema.ValidationError)
	if !ok {
		return err
	}
	var sb strings.Builder
	sb.WriteString("schema validation failed:\n")
	leaves := collectLeaves(ve)
	if len(leaves) == 0 {
		fmt.Fprintf(&sb, "  %s: %s\n", ve.InstanceLocation, ve.Message)
	}
	for _, leaf := range leaves {
		path := leaf.InstanceLocation
		if path == "" {
			path = "(root)"
		}
		fmt.Fprintf(&sb, "  %s: %s\n", path, leaf.Message)
	}
	return errors.New(strings.TrimRight(sb.String(), "\n"))
}

// collectLeaves descends into Causes; "leaves" are errors with no further
// causes, meaning they pinpoint a concrete schema rule violation.
func collectLeaves(ve *jsonschema.ValidationError) []*jsonschema.ValidationError {
	if len(ve.Causes) == 0 {
		return []*jsonschema.ValidationError{ve}
	}
	var out []*jsonschema.ValidationError
	for _, c := range ve.Causes {
		out = append(out, collectLeaves(c)...)
	}
	return out
}
