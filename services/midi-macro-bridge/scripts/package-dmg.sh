#!/usr/bin/env bash
# Wrap MidiMacroBridge.app in a signed + notarized .dmg.
#
# Usage:
#   scripts/package-dmg.sh --version <vX.Y.Z>
#
# Requires that scripts/package-app.sh has already produced
# target/release-package/MidiMacroBridge.app (or this script will run it first).
#
# Credentials:
#   Codesigning identity defaults to "Developer ID Application: Orion Letizi (ES3R29MZ5A)";
#   override with AUDIOCONTROL_DEVELOPER_ID_APP.
#   Notarytool reads creds from the "midi-macro-bridge" keychain profile;
#   override with AUDIOCONTROL_NOTARY_PROFILE.
#
# Produces:
#   target/release-package/MidiMacroBridge-<version>.dmg
#   target/release-package/MidiMacroBridge-<version>.dmg.sha256

set -euo pipefail

VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done
[[ -n "$VERSION" ]] || { echo "ERROR: --version required" >&2; exit 2; }
[[ "$VERSION" == v* ]] || { echo "ERROR: VERSION must start with 'v'" >&2; exit 2; }

SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$SERVICE_DIR"

DEVELOPER_ID_APP="${AUDIOCONTROL_DEVELOPER_ID_APP:-Developer ID Application: Orion Letizi (ES3R29MZ5A)}"
NOTARY_PROFILE="${AUDIOCONTROL_NOTARY_PROFILE:-midi-macro-bridge}"

# Build the .app first if not present.
if [[ ! -d "target/release-package/MidiMacroBridge.app" ]]; then
    echo "-> MidiMacroBridge.app not found; running package-app.sh first"
    ./scripts/package-app.sh --version "$VERSION"
fi

DMG_NAME="MidiMacroBridge-${VERSION}.dmg"
DMG_PATH="target/release-package/$DMG_NAME"
STAGING="target/release-package/dmg-staging"

echo "-> staging DMG contents at $STAGING"
rm -rf "$STAGING"
mkdir -p "$STAGING"
cp -R target/release-package/MidiMacroBridge.app "$STAGING/"
ln -s /Applications "$STAGING/Applications"

echo "-> creating $DMG_PATH (hdiutil)"
rm -f "$DMG_PATH"
hdiutil create \
    -volname "MIDI Macro Bridge" \
    -srcfolder "$STAGING" \
    -ov \
    -format UDZO \
    "$DMG_PATH"

echo "-> codesigning DMG"
codesign --force --timestamp --sign "$DEVELOPER_ID_APP" "$DMG_PATH"

echo "-> submitting to notarytool (this takes ~2-5 min; uses keychain profile '$NOTARY_PROFILE')"
xcrun notarytool submit "$DMG_PATH" \
    --keychain-profile "$NOTARY_PROFILE" \
    --wait

echo "-> stapling notarization ticket"
xcrun stapler staple "$DMG_PATH"

echo "-> Gatekeeper assessment"
spctl --assess --type install --verbose=2 "$DMG_PATH"

echo "-> computing SHA256"
( cd target/release-package && shasum -a 256 "$DMG_NAME" > "${DMG_NAME}.sha256" )

# Cleanup staging dir.
rm -rf "$STAGING"

echo
echo "done: $DMG_PATH"
echo "done: ${DMG_PATH}.sha256 ($(cat "${DMG_PATH}.sha256"))"
