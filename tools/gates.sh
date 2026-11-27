#!/usr/bin/env bash
# tools/gates.sh — the repo's blocking gates as one verb (`make gates`).
#
# Replaces the former .githooks/ pre-commit + commit-msg hooks. The
# project uses no git hooks: enforcement lives in this verb, which the
# controller (and every implementer) runs before each commit and before
# opening or merging a PR. See AGENTS.md §"Gates".
#
# Scope: the whole tree plus the branch's commits since its merge base
# with GATES_BASE (default origin/main). Unlike the old pre-commit hook,
# no gate is skipped based on which files are staged — the full set
# takes seconds.
#
# Gates:
#   check-css-duplication, check-chevron-sizing, check-clone-duplication,
#   check-anti-patterns, check-adopters, check-editor-symmetry
#       whole-tree scans against their committed baselines
#   check-disposition-survivor
#       clones.yaml on disk vs the merge base: no protected disposition
#       may silently revert to pending
#   check-refactor-preconditions
#       once per branch commit whose message carries a
#       `Closes clones.yaml <id>` marker
#
# Every gate runs; one consolidated report names each PASS and FAIL,
# with each failure's output indented under it. Exit 1 if any failed,
# exit 2 if the merge base cannot be found.

set -uo pipefail

GATES_BASE="${GATES_BASE:-origin/main}"
MARKER_RE='^[[:space:]]*Closes[[:space:]]+clones\.yaml[[:space:]]+'

if ! BASE_SHA="$(git merge-base "$GATES_BASE" HEAD 2>/dev/null)"; then
  echo "gates: cannot find a merge base between '$GATES_BASE' and HEAD." >&2
  echo "gates: fetch it (git fetch origin) or set GATES_BASE to an existing ref." >&2
  exit 2
fi

LOG_DIR="$(mktemp -d -t gates.XXXXXX)"
trap 'rm -rf "$LOG_DIR"' EXIT HUP INT TERM

GATE_NAMES=()
GATE_CODES=()
GATE_LOGS=()

# run_gate <name> <command...> — capture combined output and exit code;
# never abort, so every gate reports.
run_gate() {
  local name="$1"; shift
  local log="$LOG_DIR/${name//\//_}.log"
  local code=0
  "$@" > "$log" 2>&1 || code=$?
  GATE_NAMES+=("$name")
  GATE_CODES+=("$code")
  GATE_LOGS+=("$log")
}

for target in check-css-duplication check-chevron-sizing check-clone-duplication \
  check-anti-patterns check-adopters check-editor-symmetry; do
  run_gate "$target" make --no-print-directory "$target"
done

run_gate check-disposition-survivor make --no-print-directory check-disposition-survivor \
  "SURVIVOR_ARGS=--head-ref $BASE_SHA --working-tree"

for sha in $(git rev-list --reverse "$BASE_SHA..HEAD"); do
  msg="$LOG_DIR/msg-$sha"
  git log -1 --format=%B "$sha" > "$msg"
  if grep -qiE "$MARKER_RE" "$msg"; then
    run_gate "check-refactor-preconditions@$(git rev-parse --short "$sha")" \
      make --no-print-directory check-refactor-preconditions "COMMIT_MSG_FILE=$msg"
  fi
done

TOTAL=${#GATE_NAMES[@]}
FAILED=0
for code in "${GATE_CODES[@]}"; do
  if [ "$code" -ne 0 ]; then FAILED=$((FAILED + 1)); fi
done

if [ "$FAILED" -eq 0 ]; then
  echo "gates: all $TOTAL gate(s) passed (base $(git rev-parse --short "$BASE_SHA"))."
  exit 0
fi

echo "gates: $FAILED of $TOTAL gate(s) failed:"
echo ""
for i in "${!GATE_NAMES[@]}"; do
  if [ "${GATE_CODES[$i]}" -ne 0 ]; then
    echo "  [FAIL] ${GATE_NAMES[$i]} (exit ${GATE_CODES[$i]}):"
    awk '{ print "    " $0 }' "${GATE_LOGS[$i]}"
    echo ""
  fi
done
for i in "${!GATE_NAMES[@]}"; do
  if [ "${GATE_CODES[$i]}" -eq 0 ]; then
    echo "  [PASS] ${GATE_NAMES[$i]}"
  fi
done
exit 1
