#!/usr/bin/env bash
set -euo pipefail

# Assemble a release tarball from a `cargo build --release`.
# Usage:
#   scripts/package.sh --target <triple> --version <vX.Y.Z>
#
# Produces under target/release-package/:
#   midi-macro-bridge-<version>-<triple>.tar.gz
#   midi-macro-bridge-<version>-<triple>.tar.gz.sha256

TRIPLE=""
VERSION=""

while [[ $# -gt 0 ]]; do
    case "$1" in
        --target) TRIPLE="$2"; shift 2 ;;
        --version) VERSION="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done

[[ -n "$TRIPLE" ]] || { echo "ERROR: --target required" >&2; exit 2; }
[[ -n "$VERSION" ]] || { echo "ERROR: --version required" >&2; exit 2; }
[[ "$VERSION" == v* ]] || { echo "ERROR: --version must start with 'v' (e.g., v0.1.0)" >&2; exit 2; }

SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
cd "$SERVICE_DIR"

NAME="midi-macro-bridge-${VERSION}-${TRIPLE}"
STAGING="target/release-package/${NAME}"
OUT_DIR="target/release-package"
TARBALL="${OUT_DIR}/${NAME}.tar.gz"

echo "→ building release binary for ${TRIPLE}"
cargo build --release

echo "→ staging tarball at ${STAGING}"
rm -rf "${STAGING}"
mkdir -p "${STAGING}/bin" "${STAGING}/share/midi-macro-bridge" "${STAGING}/doc"

cp target/release/midi-macro-bridge "${STAGING}/bin/"
cp config.example.toml "${STAGING}/share/midi-macro-bridge/"

case "$TRIPLE" in
    *-apple-darwin)
        cp -R share/launchd "${STAGING}/share/midi-macro-bridge/"
        cp QUARANTINE.md "${STAGING}/doc/"
        ;;
    *-linux-*)
        cp -R share/systemd "${STAGING}/share/midi-macro-bridge/"
        ;;
esac

cp README.md "${STAGING}/doc/"
[[ -f CHANGELOG.md ]] && cp CHANGELOG.md "${STAGING}/doc/"
[[ -f INSTALL.md ]]   && cp INSTALL.md   "${STAGING}/doc/"

# Permissive-licence files live at the repo root.
WORKSPACE_ROOT="$(cd ../.. && pwd -P)"
[[ -f "${WORKSPACE_ROOT}/LICENSE-MIT" ]]    && cp "${WORKSPACE_ROOT}/LICENSE-MIT"    "${STAGING}/doc/"
[[ -f "${WORKSPACE_ROOT}/LICENSE-APACHE" ]] && cp "${WORKSPACE_ROOT}/LICENSE-APACHE" "${STAGING}/doc/"

cp scripts/install.sh "${STAGING}/install.sh"
chmod +x "${STAGING}/install.sh"

echo "→ creating ${TARBALL}"
tar -C "${OUT_DIR}" -czf "${TARBALL}" "${NAME}"

if command -v shasum >/dev/null 2>&1; then
    SHASUM="shasum -a 256"
else
    SHASUM="sha256sum"
fi
( cd "${OUT_DIR}" && ${SHASUM} "${NAME}.tar.gz" > "${NAME}.tar.gz.sha256" )

echo "✓ ${TARBALL}"
echo "✓ ${TARBALL}.sha256 ($(cat ${TARBALL}.sha256))"
