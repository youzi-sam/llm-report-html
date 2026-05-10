package main

import (
	"fmt"

	"github.com/yansir/llm-report-html/internal/lint"
	"github.com/yansir/llm-report-html/internal/schema"
)

func validateRaw(raw []byte) (lint.Report, error) {
	if _, err := schema.ParseAndValidate(raw); err != nil {
		return lint.Report{}, fmt.Errorf("validation: %w", err)
	}
	report, err := lint.Analyze(raw)
	if err != nil {
		return lint.Report{}, fmt.Errorf("validation: %w", err)
	}
	if err := report.Error(); err != nil {
		return lint.Report{}, fmt.Errorf("validation: %w", err)
	}
	return report, nil
}
