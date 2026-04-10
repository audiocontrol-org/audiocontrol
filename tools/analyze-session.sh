#!/usr/bin/env bash
# Run session log analysis for audiocontrol projects via Docker.
# No Python installation required on the host.
#
# Usage:
#   tools/analyze-session.sh              # Analyze local sessions
#   tools/analyze-session.sh --remote     # Include orion-m1 sessions
#   tools/analyze-session.sh stats        # Run arc stats (needs prior extract)
#   tools/analyze-session.sh extract      # Extract arcs (needs GEMINI_API_KEY)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="audiocontrol-session-analyzer"
CLAUDE_DIR="$HOME/.claude"

# Build the Docker image if needed
if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "Building analyzer image..."
  docker build -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile.analyzer" "$SCRIPT_DIR"
fi

# Handle --remote flag: rsync from orion-m1 first
if [ "${1:-}" = "--remote" ]; then
  shift
  echo "Syncing session logs from orion-m1..."
  REMOTE_DIR="/tmp/m1-claude-data"
  mkdir -p "$REMOTE_DIR"
  rsync -az orion@orion-m1.local:~/.claude/projects/*audiocontrol* "$REMOTE_DIR/" 2>/dev/null || echo "Warning: could not reach orion-m1"
  echo ""
  echo "=== Remote sessions (orion-m1) ==="
  docker run --rm \
    -v "$REMOTE_DIR:/data:ro" \
    ${GEMINI_API_KEY:+-e GEMINI_API_KEY="$GEMINI_API_KEY"} \
    "$IMAGE_NAME" arc_analyzer.py agents --data-dir /data
  echo ""
  echo "=== Local sessions ==="
fi

# Default command: agents
CMD="${1:-agents}"

docker run --rm \
  -v "$CLAUDE_DIR:/root/.claude:ro" \
  ${GEMINI_API_KEY:+-e GEMINI_API_KEY="$GEMINI_API_KEY"} \
  "$IMAGE_NAME" arc_analyzer.py "$CMD"
