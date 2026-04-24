#!/bin/zsh
set -euo pipefail

REPO="audiocontrol-org/audiocontrol"
ISSUE="315"

echo "=== ISSUE BODY ==="
gh issue view "$ISSUE" -R "$REPO" --json body --jq .body
echo
echo "=== COMMENTS ==="
gh issue view "$ISSUE" -R "$REPO" --comments

