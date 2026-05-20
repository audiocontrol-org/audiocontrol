#!/usr/bin/env bash
#
# check-fixture-drift.sh — recapture committed fixtures from real hardware,
# diff against the on-disk version, report any drift.
#
# Operator-run: requires Roland S-330 / S-550 reachable via MIDI (typically
# Volt 4 on orion-m4). Not run in CI.
#
# Usage:
#   scripts/check-fixture-drift.sh                                # all devices, all scenarios
#   scripts/check-fixture-drift.sh --device s330                   # one device, all scenarios
#   scripts/check-fixture-drift.sh --device s550 --scenario foo    # specific (single) scenario
#   scripts/check-fixture-drift.sh --device all --scenario all     # explicit all/all
#   scripts/check-fixture-drift.sh --help
#
# Exit codes:
#   0 — every recapture matched the committed fixture
#   1 — at least one fixture drifted, missing, or recapture failed
#   2 — usage error (bad flag, or --scenario <name> matched no fixtures —
#       almost always a typo; available scenario names are printed)
#
# Notes:
#   * Comparison ignores the `capturedAt` timestamp on the scenario header
#     (line 1) and per-record `timestampMs` fields, which legitimately drift
#     between captures. Everything else (bytes, kind, sequence, annotations)
#     must match.
#   * Each recapture is written to a worktree-local .tmp/fixture-drift/<device>/
#     directory; the operator can rerun a diff manually if needed.

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults / args
# ---------------------------------------------------------------------------

DEVICE="all"
SCENARIO="all"
SHOW_HELP=0
DIFF_LINES=20  # how many differing lines to print per drifted fixture

usage() {
    cat <<'USAGE'
Usage: check-fixture-drift.sh [--device s330|s550|all] [--scenario <name>|all] [--help]

Recapture committed Roland fixtures from real hardware and report drift.

Options:
  --device s330|s550|all   Restrict recapture to one device (default: all)
  --scenario <name>|all    Restrict recapture to a single scenario (default: all)
  --help                   Show this help and exit

Requires:
  * Roland S-330 or S-550 connected via MIDI on `Volt 4`
  * `make record-fixtures-roland-<device>` runnable (devenv shell)

Exit:
  0 = parity, 1 = drift, 2 = usage error
USAGE
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --device)
            shift
            DEVICE="${1:-}"
            ;;
        --scenario)
            shift
            SCENARIO="${1:-}"
            ;;
        --help|-h)
            SHOW_HELP=1
            ;;
        *)
            echo "Unknown argument: $1" >&2
            usage >&2
            exit 2
            ;;
    esac
    shift
done

if [ "$SHOW_HELP" -eq 1 ]; then
    usage
    exit 0
fi

case "$DEVICE" in
    s330|s550|all) ;;
    *)
        echo "ERROR: --device must be s330, s550, or all (got: '$DEVICE')" >&2
        exit 2
        ;;
esac

if [ -z "$SCENARIO" ]; then
    echo "ERROR: --scenario requires a value (use 'all' for every scenario)" >&2
    exit 2
fi

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
FIXTURES_ROOT="$REPO_ROOT/modules/sampler-devices/test/fixtures"
WORK_DIR="$REPO_ROOT/.tmp/fixture-drift"

mkdir -p "$WORK_DIR"

cd "$REPO_ROOT"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

list_devices() {
    if [ "$DEVICE" = "all" ]; then
        for dev in s330 s550; do
            if [ -d "$FIXTURES_ROOT/$dev" ]; then
                echo "$dev"
            fi
        done
    else
        if [ -d "$FIXTURES_ROOT/$DEVICE" ]; then
            echo "$DEVICE"
        fi
    fi
}

list_scenarios_for_device() {
    local dev="$1"
    local dir="$FIXTURES_ROOT/$dev"
    if [ ! -d "$dir" ]; then
        return 0
    fi

    if [ "$SCENARIO" = "all" ]; then
        # All committed *.ndjson under fixtures/<dev>/
        ( cd "$dir" && ls -1 *.ndjson 2>/dev/null | sed 's/\.ndjson$//' || true )
    else
        if [ -f "$dir/$SCENARIO.ndjson" ]; then
            echo "$SCENARIO"
        fi
    fi
}

# Same as list_scenarios_for_device but ignores $SCENARIO and always lists every
# committed *.ndjson under fixtures/<dev>/. Used for the "did you mean..."
# helper when the operator passed a typo via --scenario.
list_all_scenarios_for_device() {
    local dev="$1"
    local dir="$FIXTURES_ROOT/$dev"
    if [ ! -d "$dir" ]; then
        return 0
    fi
    ( cd "$dir" && ls -1 *.ndjson 2>/dev/null | sed 's/\.ndjson$//' || true )
}

# Strip the volatile fields from a fixture so two captures of the same
# scenario can be compared verbatim.
#   * Scenario header (line 1): drop `capturedAt` and the trailing scenario-level
#     `description` (description is identical across captures because it's hard-coded
#     in the scenario registry — but we drop it just to be safe against quoting drift).
#   * Records (lines 2+): drop `timestampMs`.
#
# This is a Python helper to keep the JSON parsing robust (no jq dependency
# required across operator boxes).
canonicalize_fixture() {
    local input="$1"
    local output="$2"
    python3 - "$input" "$output" <<'PY'
import json
import sys
src, dst = sys.argv[1], sys.argv[2]
with open(src, 'r', encoding='utf-8') as fh:
    lines = fh.readlines()
out_lines = []
for i, raw in enumerate(lines):
    raw = raw.rstrip('\n')
    if not raw:
        continue
    obj = json.loads(raw)
    if i == 0:
        # Scenario header — drop volatile fields.
        obj.pop('capturedAt', None)
    else:
        # Record — drop wall-clock timing.
        obj.pop('timestampMs', None)
    out_lines.append(json.dumps(obj, sort_keys=True))
with open(dst, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(out_lines) + '\n')
PY
}

# Print a diff of two canonicalized fixtures, capped at $DIFF_LINES.
print_diff() {
    local committed="$1"
    local fresh="$2"
    diff -u "$committed" "$fresh" | head -n "$DIFF_LINES" || true
}

# ---------------------------------------------------------------------------
# Capture + compare
# ---------------------------------------------------------------------------

DEVICES=()
while IFS= read -r d; do
    [ -n "$d" ] && DEVICES+=("$d")
done < <(list_devices)

if [ "${#DEVICES[@]}" -eq 0 ]; then
    echo "No fixture directories found under $FIXTURES_ROOT for device='$DEVICE'." >&2
    echo "Nothing to check." >&2
    exit 0
fi

UNCHANGED=()
CHANGED=()
MISSING=()
FAILED=()

# Track total scenarios we actually processed across the whole run. If the
# operator passed --scenario <name> (non-"all") and we never matched it for
# any selected device, that is almost always a typo and we want to fail
# loudly instead of exiting 0 with a misleading "all clear" summary.
TOTAL_SCENARIOS_SEEN=0
ALL_AVAILABLE_SCENARIOS=()

echo "=== Roland fixture drift check ==="
echo "Repo:       $REPO_ROOT"
echo "Fixtures:   $FIXTURES_ROOT"
echo "Workspace:  $WORK_DIR"
echo "Devices:    ${DEVICES[*]}"
echo "Scenario:   $SCENARIO"
echo ""

for dev in "${DEVICES[@]}"; do
    SCENARIOS=()
    while IFS= read -r s; do
        [ -n "$s" ] && SCENARIOS+=("$s")
    done < <(list_scenarios_for_device "$dev")

    # Always remember the full set of available scenarios for this device so
    # we can show the operator a useful list on a typo.
    while IFS= read -r s; do
        [ -n "$s" ] && ALL_AVAILABLE_SCENARIOS+=("$dev/$s")
    done < <(list_all_scenarios_for_device "$dev")

    if [ "${#SCENARIOS[@]}" -eq 0 ]; then
        echo "[$dev] no committed scenarios found — skipping"
        echo ""
        continue
    fi

    TOTAL_SCENARIOS_SEEN=$(( TOTAL_SCENARIOS_SEEN + ${#SCENARIOS[@]} ))

    echo "[$dev] scenarios: ${SCENARIOS[*]}"
    mkdir -p "$WORK_DIR/$dev"

    for scen in "${SCENARIOS[@]}"; do
        committed="$FIXTURES_ROOT/$dev/$scen.ndjson"
        fresh="$WORK_DIR/$dev/$scen.ndjson"
        committed_canon="$WORK_DIR/$dev/$scen.committed.canon"
        fresh_canon="$WORK_DIR/$dev/$scen.fresh.canon"

        if [ ! -f "$committed" ]; then
            echo "  [$dev/$scen] MISSING committed fixture"
            MISSING+=("$dev/$scen")
            continue
        fi

        echo "  [$dev/$scen] recapturing..."
        # `make record-fixtures-roland-<device>` runs the CLI tool inside
        # devenv shell. Capture stderr too — failures should be visible.
        if ! make "record-fixtures-roland-$dev" \
                ARGS="--scenario $scen --output $fresh" >"$WORK_DIR/$dev/$scen.log" 2>&1; then
            echo "    FAILED — see $WORK_DIR/$dev/$scen.log"
            FAILED+=("$dev/$scen")
            continue
        fi

        if [ ! -f "$fresh" ]; then
            echo "    FAILED — recapture produced no output file"
            FAILED+=("$dev/$scen")
            continue
        fi

        canonicalize_fixture "$committed" "$committed_canon"
        canonicalize_fixture "$fresh" "$fresh_canon"

        if cmp -s "$committed_canon" "$fresh_canon"; then
            echo "    UNCHANGED"
            UNCHANGED+=("$dev/$scen")
        else
            changed_lines=$(diff "$committed_canon" "$fresh_canon" | grep -c '^[<>]' || true)
            echo "    CHANGED ($changed_lines differing lines, first $DIFF_LINES shown):"
            print_diff "$committed_canon" "$fresh_canon" | sed 's/^/      /'
            CHANGED+=("$dev/$scen")
        fi
    done
    echo ""
done

# ---------------------------------------------------------------------------
# Typo guard
# ---------------------------------------------------------------------------
#
# If --scenario <name> (anything other than "all") matched zero fixtures across
# every selected device, that's a usage error masquerading as success. Fail
# loudly so the operator notices instead of trusting a misleading green light.
# When --scenario is "all", an empty result is legitimate (e.g. a device dir
# with no fixtures yet, like S-550 in early Phase 0).

if [ "$SCENARIO" != "all" ] && [ "$TOTAL_SCENARIOS_SEEN" -eq 0 ]; then
    echo "ERROR: --scenario '$SCENARIO' matched no committed fixtures for device='$DEVICE'." >&2
    if [ "${#ALL_AVAILABLE_SCENARIOS[@]}" -gt 0 ]; then
        echo "Available scenarios for the selected device set:" >&2
        for s in "${ALL_AVAILABLE_SCENARIOS[@]}"; do
            echo "  $s" >&2
        done
    else
        echo "(No committed fixtures exist yet for device='$DEVICE'.)" >&2
    fi
    exit 2
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo "=== Summary ==="
echo "  Unchanged: ${#UNCHANGED[@]}  ${UNCHANGED[*]:-}"
echo "  Changed:   ${#CHANGED[@]}    ${CHANGED[*]:-}"
echo "  Missing:   ${#MISSING[@]}    ${MISSING[*]:-}"
echo "  Failed:    ${#FAILED[@]}     ${FAILED[*]:-}"
echo ""

if [ "${#CHANGED[@]}" -gt 0 ] || [ "${#MISSING[@]}" -gt 0 ] || [ "${#FAILED[@]}" -gt 0 ]; then
    echo "Drift detected. Inspect $WORK_DIR for fresh fixtures + canonicalized diffs."
    echo "If the drift is expected (protocol or scenario change), commit the new"
    echo "fixtures with the originating PR. If unexpected, investigate before"
    echo "trusting any UI-harness specs that depend on these fixtures."
    exit 1
fi

echo "All fixtures match committed snapshots."
exit 0
