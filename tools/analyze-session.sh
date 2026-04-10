#!/usr/bin/env bash
# Run session log analysis for audiocontrol projects.
#
# Usage:
#   tools/analyze-session.sh              # Analyze local sessions
#   tools/analyze-session.sh --remote     # Include orion-m1 sessions

set -euo pipefail

ANALYZER_DIR="$(dirname "$0")/session-analyzer"
VENV="$ANALYZER_DIR/.venv"

if [ ! -d "$ANALYZER_DIR" ]; then
  echo "Cloning analyzer..."
  git clone https://github.com/mrothroc/claude-code-log-analyzer.git "$ANALYZER_DIR"
fi

if [ ! -d "$VENV" ]; then
  echo "Setting up Python venv..."
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -r "$ANALYZER_DIR/requirements.txt"
fi

if [ "${1:-}" = "--remote" ]; then
  echo "Syncing session logs from orion-m1..."
  rsync -az orion@orion-m1.local:~/.claude/projects/*audiocontrol* /tmp/m1-claude-data/ 2>/dev/null || echo "Warning: could not reach orion-m1"
  echo ""
  echo "=== Remote sessions (orion-m1) ==="
  "$VENV/bin/python" "$ANALYZER_DIR/arc_analyzer.py" agents --data-dir /tmp/m1-claude-data
  echo ""
fi

echo "=== Local sessions ==="
"$VENV/bin/python" "$ANALYZER_DIR/arc_analyzer.py" agents
"$VENV/bin/python" "$ANALYZER_DIR/arc_analyzer.py" stats 2>/dev/null || echo "(Run 'extract' first for arc stats)"
