#!/usr/bin/env bash
# Build the midi-macro-bridge Linux x86_64 release inside a Docker container,
# then assemble the release tarball via package.sh.
#
# Usage:
#   scripts/build-in-docker.sh --version <vX.Y.Z>
#
# Produces under target/release-package/:
#   midi-macro-bridge-<version>-x86_64-unknown-linux-gnu.tar.gz
#   midi-macro-bridge-<version>-x86_64-unknown-linux-gnu.tar.gz.sha256

set -euo pipefail

VERSION=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --version) VERSION="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done
[[ -n "$VERSION" ]] || { echo "ERROR: --version required" >&2; exit 2; }

SERVICE_DIR="$(cd "$(dirname "$0")/.." && pwd -P)"
WORKSPACE_ROOT="$(cd "$SERVICE_DIR/../.." && pwd -P)"

IMAGE_TAG="midi-macro-bridge-linux-builder:latest"

# Force x86_64 even when running on Apple Silicon hosts. Docker Desktop emulates
# amd64 via QEMU/Rosetta — slower than native, but produces a real x86_64 ELF
# without us shipping a cross-compilation toolchain.
PLATFORM="linux/amd64"

echo "→ building Docker image $IMAGE_TAG (platform=$PLATFORM)"
docker build \
    --platform "$PLATFORM" \
    -t "$IMAGE_TAG" \
    -f "$SERVICE_DIR/Dockerfile.linux-builder" \
    "$SERVICE_DIR"

echo "→ cargo build --release inside container (host arch inside container = x86_64)"
# Bind-mount the entire workspace so package.sh's workspace-root LICENSE lookup
# also works. The cargo target dir is workspace-internal so artifacts persist.
docker run --rm \
    --platform "$PLATFORM" \
    -v "$WORKSPACE_ROOT":/workspace \
    -w /workspace/services/midi-macro-bridge \
    "$IMAGE_TAG" \
    bash -c "cargo build --release && ./scripts/package.sh --target x86_64-unknown-linux-gnu --version $VERSION"

echo "✓ Linux tarball assembled"
