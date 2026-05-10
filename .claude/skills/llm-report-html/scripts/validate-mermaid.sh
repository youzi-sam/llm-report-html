#!/usr/bin/env bash
# Validate mermaid source against mermaid's own parser.
# First invocation auto-installs node_modules in this scripts/ dir (~30MB).
#
# Usage:
#   echo "flowchart LR\nA --> B" | scripts/validate-mermaid.sh
#   scripts/validate-mermaid.sh "flowchart LR\nA --> B"
#
# Exit: 0 OK, 1 parse error (msg on stderr), 2 bad invocation.

set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPTS_DIR"

if [ ! -d node_modules ]; then
    echo "[validate-mermaid] first-run: installing mermaid + jsdom..." >&2
    npm install --silent --no-audit --no-fund --no-progress >&2
fi

if [ -t 0 ] && [ "$#" -eq 0 ]; then
    echo "usage: $(basename "$0") \"<code>\"   or pipe via stdin" >&2
    exit 2
fi

if [ "$#" -ge 1 ]; then
    node validate-mermaid.mjs "$1"
else
    node validate-mermaid.mjs
fi
