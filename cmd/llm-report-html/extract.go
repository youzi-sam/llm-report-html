package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

func cmdExtract(args []string) error {
	var inPath, outPath string
	for i := 0; i < len(args); i++ {
		a := args[i]
		switch {
		case a == "-o" || a == "--output":
			if i+1 >= len(args) {
				return errors.New("-o requires a path")
			}
			outPath = args[i+1]
			i++
		case strings.HasPrefix(a, "-"):
			return fmt.Errorf("unknown flag: %s", a)
		default:
			if inPath != "" {
				return errors.New("extract takes one HTML file")
			}
			inPath = a
		}
	}
	raw, err := readInput(inPath)
	if err != nil {
		return fmt.Errorf("read input: %w", err)
	}
	data, err := extractDataSlot(raw)
	if err != nil {
		return err
	}
	var pretty bytes.Buffer
	if err := json.Indent(&pretty, data, "", "  "); err != nil {
		return fmt.Errorf("extracted slot is not valid JSON: %w", err)
	}
	pretty.WriteByte('\n')
	return writeOutput(outPath, pretty.String())
}

// extractDataSlot finds <script ... id="report-data" ...>BODY</script> and
// returns BODY with script-tag escaping reversed. Tolerates attribute order;
// relies only on the id attribute substring.
func extractDataSlot(html []byte) ([]byte, error) {
	idAttr := []byte(`id="report-data"`)
	idx := bytes.Index(html, idAttr)
	if idx < 0 {
		return nil, errors.New(`not a llm-report-html artifact: missing <script id="report-data">`)
	}
	gt := bytes.IndexByte(html[idx:], '>')
	if gt < 0 {
		return nil, errors.New("malformed HTML: unterminated <script> tag")
	}
	start := idx + gt + 1
	end := bytes.Index(html[start:], []byte("</script>"))
	if end < 0 {
		return nil, errors.New(`malformed HTML: unterminated <script id="report-data">`)
	}
	body := html[start : start+end]
	body = bytes.ReplaceAll(body, []byte(`<\/script`), []byte("</script"))
	body = bytes.ReplaceAll(body, []byte(`<\!--`), []byte("<!--"))
	return body, nil
}
