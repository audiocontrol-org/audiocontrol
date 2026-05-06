#!/usr/bin/env bash
# End-to-end release for midi-macro-bridge.
# See services/midi-macro-bridge/Makefile `release` target for usage.
set -euo pipefail

VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done
[[ -n "$VERSION" ]] || { echo "ERROR: --version required (e.g., v0.1.0)" >&2; exit 2; }
[[ "$VERSION" == v* ]] || { echo "ERROR: VERSION must start with 'v'" >&2; exit 2; }

SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
WORKSPACE_ROOT="$(cd "$SERVICE_DIR/../.." && pwd -P)"
cd "$WORKSPACE_ROOT"

VERSION_NO_V="${VERSION#v}"

echo "→ pre-release checks"

CARGO_VERSION="$(grep -E '^version = ' "$SERVICE_DIR/Cargo.toml" | head -1 | awk -F\" '{print $2}')"
if [[ "$CARGO_VERSION" != "$VERSION_NO_V" ]]; then
    echo "ERROR: Cargo.toml version ($CARGO_VERSION) does not match VERSION ($VERSION_NO_V)" >&2
    echo "       Update services/midi-macro-bridge/Cargo.toml first." >&2
    exit 1
fi
echo "  ✓ Cargo.toml version: $CARGO_VERSION"

if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "ERROR: working tree has uncommitted changes" >&2
    git status --short
    exit 1
fi
echo "  ✓ working tree clean"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$CURRENT_BRANCH" != "main" ]]; then
    echo "  ⚠ on branch '$CURRENT_BRANCH' (not main) — proceeding anyway"
fi

if git show-ref --tags --verify --quiet "refs/tags/$VERSION"; then
    echo "ERROR: tag $VERSION already exists locally" >&2
    exit 1
fi
echo "  ✓ tag $VERSION does not yet exist"

echo "→ building both tarballs"
make -C "$SERVICE_DIR" package-all VERSION="$VERSION"

# macOS smoke test (Phase 6 criterion: no `MIDI channel disconnected` within 2.5s).
STAGED="$SERVICE_DIR/target/release-package/midi-macro-bridge-$VERSION-aarch64-apple-darwin"
if [[ ! -d "$STAGED" ]]; then
    echo "ERROR: macOS staging dir missing: $STAGED" >&2
    exit 1
fi
echo "→ smoke testing macOS binary"
SMOKE_LOG="$(mktemp)"
"$STAGED/bin/midi-macro-bridge" --no-open >"$SMOKE_LOG" 2>&1 &
PID=$!
sleep 2.5
if ! kill -0 "$PID" 2>/dev/null; then
    echo "ERROR: macOS binary exited within 2.5s" >&2
    cat "$SMOKE_LOG" >&2
    exit 1
fi
kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true
if grep -q "MIDI channel disconnected" "$SMOKE_LOG"; then
    echo "ERROR: regression — 'MIDI channel disconnected' in startup log" >&2
    cat "$SMOKE_LOG" >&2
    exit 1
fi
rm -f "$SMOKE_LOG"
echo "  ✓ macOS smoke test clean"

echo "→ tagging $VERSION and pushing"
git tag -a "$VERSION" -m "midi-macro-bridge $VERSION"
git push origin "$VERSION"

echo "→ extracting release notes from CHANGELOG.md"
NOTES_FILE="$(mktemp)"
if [[ -f "$SERVICE_DIR/CHANGELOG.md" ]]; then
    awk -v v="$VERSION" '
        $0 ~ "^## " v "$" {flag=1; next}
        flag && /^## / {exit}
        flag {print}
    ' "$SERVICE_DIR/CHANGELOG.md" > "$NOTES_FILE"
fi
if [[ ! -s "$NOTES_FILE" ]]; then
    echo "midi-macro-bridge $VERSION" > "$NOTES_FILE"
fi

echo "→ creating GitHub Release"
cd "$SERVICE_DIR/target/release-package"
gh release create "$VERSION" \
    --title "midi-macro-bridge $VERSION" \
    --notes-file "$NOTES_FILE" \
    "midi-macro-bridge-$VERSION-aarch64-apple-darwin.tar.gz" \
    "midi-macro-bridge-$VERSION-aarch64-apple-darwin.tar.gz.sha256" \
    "midi-macro-bridge-$VERSION-x86_64-unknown-linux-gnu.tar.gz" \
    "midi-macro-bridge-$VERSION-x86_64-unknown-linux-gnu.tar.gz.sha256" \
    SHA256SUMS

rm -f "$NOTES_FILE"

echo
echo "✓ Released $VERSION"
echo "  https://github.com/audiocontrol-org/audiocontrol/releases/tag/$VERSION"
