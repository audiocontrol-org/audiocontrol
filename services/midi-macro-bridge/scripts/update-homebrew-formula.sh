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

src = src.replace('PLACEHOLDER_MAC_ARM64_SHA256', '$MAC_ARM_SHA')
src = src.replace('PLACEHOLDER_LINUX_X86_64_SHA256', '$LINUX_X64_SHA')

def replace_sha_for_platform(src, platform_substr, new_sha):
    pattern = re.compile(
        r'(url\s+"[^"]*' + re.escape(platform_substr) + r'[^"]*"\s*\n\s*sha256\s+")[a-f0-9]{64}(")',
        re.MULTILINE,
    )
    new_src, n = pattern.subn(rf'\g<1>{new_sha}\g<2>', src)
    return new_src, n

src, mac_n = replace_sha_for_platform(src, 'aarch64-apple-darwin', '$MAC_ARM_SHA')
src, linux_n = replace_sha_for_platform(src, 'x86_64-unknown-linux-gnu', '$LINUX_X64_SHA')

if mac_n == 0:
    raise SystemExit('ERROR: failed to substitute macOS arm64 sha256 — formula structure may have changed')
if linux_n == 0:
    raise SystemExit('ERROR: failed to substitute Linux x86_64 sha256 — formula structure may have changed')

with open("$FORMULA", "w") as f:
    f.write(src)

print(f'  ✓ macOS arm64 sha256 substitution: {mac_n} match(es)')
print(f'  ✓ Linux x86_64 sha256 substitution: {linux_n} match(es)')
PY

rm -f "$SUMS_FILE"

echo "✓ updated $FORMULA"
echo "  version: $VERSION_NO_V"
echo "  macOS arm64 sha256: $MAC_ARM_SHA"
echo "  Linux x86_64 sha256: $LINUX_X64_SHA"
echo
echo "Review the diff, then commit/push the tap repo."
