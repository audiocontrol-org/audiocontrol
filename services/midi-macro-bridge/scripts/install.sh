#!/usr/bin/env bash
# Installs midi-macro-bridge from this tarball to /usr/local or ~/.local.
# Idempotent — replaces an existing install.
set -euo pipefail

PREFIX="${PREFIX:-}"
if [[ -z "$PREFIX" ]]; then
    if [[ "$EUID" -eq 0 ]]; then
        PREFIX="/usr/local"
    else
        PREFIX="$HOME/.local"
    fi
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"

mkdir -p "$PREFIX/bin" "$PREFIX/share/midi-macro-bridge" "$PREFIX/share/doc/midi-macro-bridge"

install -m 755 "$SCRIPT_DIR/bin/midi-macro-bridge" "$PREFIX/bin/midi-macro-bridge"
cp -R "$SCRIPT_DIR/share/midi-macro-bridge/." "$PREFIX/share/midi-macro-bridge/"
cp -R "$SCRIPT_DIR/doc/." "$PREFIX/share/doc/midi-macro-bridge/"

echo "✓ installed midi-macro-bridge to $PREFIX/bin/midi-macro-bridge"
echo
echo "Next steps:"
echo "  1. Copy the example config:"
echo "       mkdir -p \$HOME/.config/audiocontrol/midi-macro-bridge"
echo "       cp $PREFIX/share/midi-macro-bridge/config.example.toml \\"
echo "          \$HOME/.config/audiocontrol/midi-macro-bridge/config.toml"
echo "  2. Edit it to your MIDI port names."
echo "  3. Run: midi-macro-bridge"
