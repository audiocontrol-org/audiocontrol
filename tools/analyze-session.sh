#!/usr/bin/env bash
# Run session log analysis for audiocontrol projects via Docker.
# No Python installation required on the host.
#
# Usage:
#   tools/analyze-session.sh              # Extract agents + show stats
#   tools/analyze-session.sh --remote     # Include orion-m1 sessions
#   tools/analyze-session.sh extract      # Extract arcs (needs GEMINI_API_KEY)
#   tools/analyze-session.sh stats        # Show stats only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_NAME="audiocontrol-session-analyzer"
CLAUDE_DIR="$HOME/.claude"
# Persist analyzer DB on host
DB_DIR="$SCRIPT_DIR/.analyzer-data"
mkdir -p "$DB_DIR"

# Build the Docker image if needed
if ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
  echo "Building analyzer image..."
  docker build -t "$IMAGE_NAME" -f "$SCRIPT_DIR/Dockerfile.analyzer" "$SCRIPT_DIR"
fi

# The analyzer writes arc_analytics.db to its script directory (/analyzer/).
# We bind-mount the DB file from the host so it persists across runs.
# On first run, it creates a new DB.
run_analyzer() {
  local db_file="$DB_DIR/arc_analytics.db"
  touch "$db_file"
  docker run --rm \
    -v "$CLAUDE_DIR:/root/.claude:ro" \
    -v "$db_file:/analyzer/arc_analytics.db:rw" \
    ${GEMINI_API_KEY:+-e GEMINI_API_KEY="$GEMINI_API_KEY"} \
    "$IMAGE_NAME" "$@"
}

# Handle --remote flag
if [ "${1:-}" = "--remote" ]; then
  shift
  echo "Syncing session logs from orion-m1..."
  REMOTE_DIR="/tmp/m1-claude-data"
  mkdir -p "$REMOTE_DIR"
  rsync -az orion@orion-m1.local:~/.claude/projects/*audiocontrol* "$REMOTE_DIR/" 2>/dev/null || echo "Warning: could not reach orion-m1"
  echo ""
  echo "=== Remote sessions (orion-m1) ==="
  local db_file="$DB_DIR/arc_analytics.db"
  touch "$db_file"
  docker run --rm \
    -v "$REMOTE_DIR:/root/.claude/projects:ro" \
    -v "$db_file:/analyzer/arc_analytics.db:rw" \
    "$IMAGE_NAME" arc_analyzer.py agents
  echo ""
  echo "=== Local sessions ==="
fi

CMD="${1:-all}"

case "$CMD" in
  all)
    echo "Extracting agent sessions..."
    run_analyzer arc_analyzer.py agents
    echo ""
    echo "=== Statistics ==="
    run_analyzer arc_analyzer.py stats
    ;;
  *)
    run_analyzer arc_analyzer.py "$CMD"
    ;;
esac
