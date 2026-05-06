#!/usr/bin/env bash
# Updates the Homebrew formula for a given release version.
#
# Usage:
#   scripts/update-homebrew-formula.sh <version> <path-to-tap>
#
# Example:
#   scripts/update-homebrew-formula.sh v0.1.0 ~/work/audiocontrol-work/homebrew-audiocontrol
#
# Pulls the SHA256SUMS file from the GitHub Release and rewrites the
# placeholders in the formula in place. Does NOT commit/push — review first.

set -euo pipefail

VERSION="${1:-}"
TAP_DIR="${2:-}"
[[ -n "$VERSION" && -n "$TAP_DIR" ]] || {
    echo "usage: $0 <version> <path-to-tap>" >&2
    exit 2
}

REPO="audiocontrol-org/audiocontrol"
FORMULA="$TAP_DIR/Formula/midi-macro-bridge.rb"
[[ -f "$FORMULA" ]] || { echo "ERROR: formula not found at $FORMULA" >&2; exit 1; }

SUMS_FILE="$(mktemp)"
gh release download "$VERSION" --repo "$REPO" --pattern 'SHA256SUMS' -O - > "$SUMS_FILE"

MAC_ARM_SHA="$(grep "aarch64-apple-darwin.tar.gz$" "$SUMS_FILE" | awk '{print $1}')"
LINUX_X64_SHA="$(grep "x86_64-unknown-linux-gnu.tar.gz$" "$SUMS_FILE" | awk '{print $1}')"

[[ -n "$MAC_ARM_SHA" ]] || { echo "ERROR: no macOS arm64 SHA in SHA256SUMS" >&2; exit 1; }
[[ -n "$LINUX_X64_SHA" ]] || { echo "ERROR: no Linux x86_64 SHA in SHA256SUMS" >&2; exit 1; }

VERSION_NO_V="${VERSION#v}"

python3 - <<PY
import re
with open("$FORMULA") as f:
    src = f.read()
src = re.sub(r'version "[^"]+"', 'version "$VERSION_NO_V"', src)
src = re.sub(r'PLACEHOLDER_MAC_ARM64_SHA256', '$MAC_ARM_SHA', src)
src = re.sub(r'PLACEHOLDER_LINUX_X86_64_SHA256', '$LINUX_X64_SHA', src)
src = re.sub(r'sha256 "[a-f0-9]{64}".*aarch64-apple-darwin', 'sha256 "$MAC_ARM_SHA"', src)
src = re.sub(r'sha256 "[a-f0-9]{64}".*x86_64-unknown-linux-gnu', 'sha256 "$LINUX_X64_SHA"', src)
with open("$FORMULA", "w") as f:
    f.write(src)
PY

rm -f "$SUMS_FILE"

echo "✓ updated $FORMULA"
echo "  version: $VERSION_NO_V"
echo "  macOS arm64 sha256: $MAC_ARM_SHA"
echo "  Linux x86_64 sha256: $LINUX_X64_SHA"
echo
echo "Review the diff, then commit/push the tap repo."
