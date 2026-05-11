package main

import (
	"fmt"

	"github.com/yansir/llm-report-html/internal/lint"
	"github.com/yansir/llm-report-html/internal/runtimejs"
	"github.com/yansir/llm-report-html/internal/schema"
)

func validateRaw(raw []byte) (lint.Report, error) {
	report, _, err := validateAndCompile(raw, "")
	return report, err
}

func validateAndCompile(raw []byte, inputPath string) (lint.Report, runtimejs.Bundle, error) {
	if _, err := schema.ParseAndValidate(raw); err != nil {
		return lint.Report{}, runtimejs.Bundle{}, fmt.Errorf("validation: %w", err)
	}
	report, err := lint.Analyze(raw)
	if err != nil {
		return lint.Report{}, runtimejs.Bundle{}, fmt.Errorf("validation: %w", err)
	}
	if err := report.Error(); err != nil {
		return lint.Report{}, runtimejs.Bundle{}, fmt.Errorf("validation: %w", err)
	}
	bundle, err := runtimejs.Compile(raw, inputPath)
	if err != nil {
		return lint.Report{}, runtimejs.Bundle{}, fmt.Errorf("validation: %w", err)
	}
	return report, bundle, nil
}
