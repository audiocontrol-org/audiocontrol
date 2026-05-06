#!/usr/bin/env bash
# Assemble + sign MidiMacroBridge.app from a release binary.
#
# Usage:
#   scripts/package-app.sh --version <vX.Y.Z>
#
# Produces under target/release-package/:
#   MidiMacroBridge.app  (signed, NOT notarized -- that happens in package-dmg.sh)
#
# Codesigning identity:
#   Defaults to "Developer ID Application: Orion Letizi (ES3R29MZ5A)" -- the cert
#   in the local keychain. Override with AUDIOCONTROL_DEVELOPER_ID_APP env var
#   for a different signer.

set -euo pipefail

VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done
[[ -n "$VERSION" ]] || { echo "ERROR: --version required (e.g., v0.2.0)" >&2; exit 2; }
[[ "$VERSION" == v* ]] || { echo "ERROR: VERSION must start with 'v'" >&2; exit 2; }

VERSION_NO_V="${VERSION#v}"
SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$SERVICE_DIR"

DEVELOPER_ID_APP="${AUDIOCONTROL_DEVELOPER_ID_APP:-Developer ID Application: Orion Letizi (ES3R29MZ5A)}"

# Verify the cert is actually in the keychain before doing any work.
if ! security find-identity -v -p codesigning 2>/dev/null | grep -qF "$DEVELOPER_ID_APP"; then
    echo "ERROR: codesigning identity not found in keychain:" >&2
    echo "  $DEVELOPER_ID_APP" >&2
    echo "  Run \`security find-identity -v -p codesigning\` to see what's available." >&2
    exit 1
fi

APP_NAME="MidiMacroBridge.app"
STAGING="target/release-package/$APP_NAME"
TRIPLE="aarch64-apple-darwin"

echo "-> building release binary for $TRIPLE"
cargo build --release --target "$TRIPLE"

echo "-> assembling $STAGING"
rm -rf "$STAGING"
mkdir -p "$STAGING/Contents/MacOS" "$STAGING/Contents/Resources"

cp "target/$TRIPLE/release/midi-macro-bridge" "$STAGING/Contents/MacOS/"

# Substitute __VERSION__ into Info.plist.
python3 -c "
src = open('packaging/macos/Info.plist.tmpl').read()
out = src.replace('__VERSION__', '$VERSION_NO_V')
open('$STAGING/Contents/Info.plist', 'w').write(out)
"

# PkgInfo is a 4-byte type code + 4-byte signature. APPLE_PACKAGE_TYPE = APPL.
printf 'APPL????' > "$STAGING/Contents/PkgInfo"

cp packaging/macos/AppIcon.icns "$STAGING/Contents/Resources/AppIcon.icns"

echo "-> codesigning binary"
codesign --force --options runtime --timestamp \
    --entitlements packaging/macos/entitlements.plist \
    --sign "$DEVELOPER_ID_APP" \
    "$STAGING/Contents/MacOS/midi-macro-bridge"

echo "-> codesigning bundle"
codesign --force --options runtime --timestamp \
    --entitlements packaging/macos/entitlements.plist \
    --sign "$DEVELOPER_ID_APP" \
    "$STAGING"

echo "-> verifying signature"
codesign --verify --deep --strict --verbose=2 "$STAGING"

echo "done: $STAGING (signed, not yet notarized)"
echo "  Run scripts/package-dmg.sh --version $VERSION to produce a notarized .dmg."
