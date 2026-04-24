#!/bin/zsh
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 /path/to/comment.md" >&2
  exit 1
fi

BODY_FILE="$1"
REPO="audiocontrol-org/audiocontrol"
ISSUE="315"

gh issue comment "$ISSUE" -R "$REPO" --body-file "$BODY_FILE"

