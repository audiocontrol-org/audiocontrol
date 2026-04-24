#!/bin/zsh
set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 /path/to/current-state.md" >&2
  exit 1
fi

SECTION_FILE="$1"
REPO="audiocontrol-org/audiocontrol"
ISSUE="315"
BODY_FILE="$(mktemp /tmp/issue315-body.XXXXXX.md)"
UPDATED_FILE="$(mktemp /tmp/issue315-body-updated.XXXXXX.md)"

cleanup() {
  rm -f "$BODY_FILE" "$UPDATED_FILE"
}
trap cleanup EXIT

gh issue view "$ISSUE" -R "$REPO" --json body --jq .body > "$BODY_FILE"

python3 - "$BODY_FILE" "$SECTION_FILE" "$UPDATED_FILE" <<'PY'
from pathlib import Path
import re
import sys

body_path = Path(sys.argv[1])
section_path = Path(sys.argv[2])
updated_path = Path(sys.argv[3])

body = body_path.read_text()
section = section_path.read_text().rstrip() + "\n"

pattern = r"## Current State of Play\n.*?(?=\n## |\Z)"
updated = re.sub(pattern, section, body, flags=re.S)
updated_path.write_text(updated)
PY

gh issue edit "$ISSUE" -R "$REPO" --body-file "$UPDATED_FILE"
