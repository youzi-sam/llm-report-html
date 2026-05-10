#!/usr/bin/env bash
# Install the llm-report-html binary into a directory on $PATH.
# Required because this skill calls the binary at runtime.
#
# Usage:
#   .claude/skills/llm-report-html/scripts/install-binary.sh [target-dir]
#
# Default target: ~/.local/bin

set -euo pipefail

TARGET="${1:-$HOME/.local/bin}"

if ! command -v llm-report-html >/dev/null 2>&1; then
    echo "llm-report-html not on PATH. Building from source..."
else
    echo "llm-report-html is already on PATH ($(which llm-report-html))."
    echo "Re-running anyway to refresh."
fi

# Locate the repo: this script lives under .claude/skills/<name>/scripts/.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"

if [ ! -f "$REPO_ROOT/Makefile" ]; then
    echo "Could not find Makefile at $REPO_ROOT — this skill is not running" \
         "from inside the source repo. Either:" >&2
    echo "  1. Clone the repo and run 'make install', or" >&2
    echo "  2. Drop a prebuilt binary at $TARGET/llm-report-html" >&2
    exit 1
fi

mkdir -p "$TARGET"
( cd "$REPO_ROOT" && make build )
cp "$REPO_ROOT/bin/llm-report-html" "$TARGET/"
echo "Installed: $TARGET/llm-report-html"

if ! echo "$PATH" | tr ':' '\n' | grep -qx "$TARGET"; then
    echo
    echo "WARNING: $TARGET is not on \$PATH. Add to your shell rc, e.g.:"
    echo "    export PATH=\"$TARGET:\$PATH\""
fi
