package main

import (
	"errors"
	"fmt"
	"os"
	"strings"
)

func cmdValidate(args []string) error {
	inPath, err := parseSingleInput(args)
	if err != nil {
		return err
	}
	raw, err := readInput(inPath)
	if err != nil {
		return err
	}
	report, err := validateRaw(raw)
	if err != nil {
		return err
	}
	if len(report.Warnings) > 0 {
		fmt.Fprintf(os.Stderr, "ok (%d warning(s)):\n", len(report.Warnings))
		for _, w := range report.Warnings {
			fmt.Fprintln(os.Stderr, w.String())
		}
		return nil
	}
	fmt.Fprintln(os.Stderr, "ok")
	return nil
}

func parseSingleInput(args []string) (string, error) {
	var inPath string
	for _, a := range args {
		if strings.HasPrefix(a, "-") {
			return "", fmt.Errorf("unknown flag: %s", a)
		}
		if inPath != "" {
			return "", errors.New("multiple input files not supported")
		}
		inPath = a
	}
	return inPath, nil
}
