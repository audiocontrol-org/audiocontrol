#!/bin/bash
# Build mtools binaries for all platforms using Docker
# This allows local cross-platform binary compilation without CI/CD

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
BIN_DIR="$PROJECT_ROOT/bin/mtools"

echo "Building mtools binaries for all platforms..."
echo "Output directory: $BIN_DIR"
echo ""

# Create output directories
mkdir -p "$BIN_DIR"/{darwin-arm64,darwin-x64,linux-x64,linux-arm64}

# Function to build for a platform
build_platform() {
    local platform=$1
    local docker_platform=$2
    local base_image=$3

    echo "=== Building for $platform ==="
    echo "Docker platform: $docker_platform"
    echo "Base image: $base_image"

    # Create temporary directory for this build
    local temp_dir=$(mktemp -d)
    trap "rm -rf $temp_dir" EXIT

    # Build in Docker container
    docker run --rm \
        --platform "$docker_platform" \
        -v "$temp_dir:/output" \
        "$base_image" \
        bash -c "
            set -e
            echo 'Installing mtools...'
            apt-get update -qq
            apt-get install -y -qq mtools file

            echo 'Copying binary...'
            cp /usr/bin/mcopy /output/mcopy

            echo 'Binary info:'
            file /output/mcopy
            ls -lh /output/mcopy

            echo 'Checking dependencies:'
            ldd /output/mcopy || true
        "

    # Copy to final location
    cp "$temp_dir/mcopy" "$BIN_DIR/$platform/mcopy"
    chmod +x "$BIN_DIR/$platform/mcopy"

    echo "✓ Binary saved to: $BIN_DIR/$platform/mcopy"
    echo ""
}

# Build for Linux x64
build_platform "linux-x64" "linux/amd64" "ubuntu:22.04"

# Build for Linux ARM64
build_platform "linux-arm64" "linux/arm64" "ubuntu:22.04"

# macOS binaries need to be built natively (can't cross-compile in Docker)
echo "=== macOS Binaries ==="
echo "macOS binaries must be built natively:"
echo ""
echo "For darwin-x64 (macOS Intel):"
echo "  - On Intel Mac: brew install mtools && cp \$(which mcopy) $BIN_DIR/darwin-x64/"
echo "  - Or use GitHub Actions macos-13 runner"
echo ""
echo "For darwin-arm64 (macOS ARM):"
echo "  - On Apple Silicon Mac: brew install mtools && cp \$(which mcopy) $BIN_DIR/darwin-arm64/"
echo "  - Already present: $(ls -lh $BIN_DIR/darwin-arm64/mcopy 2>/dev/null || echo 'MISSING')"
echo ""

# Summary
echo "=== Build Summary ==="
for platform in darwin-arm64 darwin-x64 linux-x64 linux-arm64; do
    if [ -f "$BIN_DIR/$platform/mcopy" ]; then
        size=$(ls -lh "$BIN_DIR/$platform/mcopy" | awk '{print $5}')
        echo "✓ $platform: $size"
    else
        echo "✗ $platform: MISSING"
    fi
done
echo ""

# Total size check
total_size=$(find "$BIN_DIR" -name "mcopy" -exec ls -l {} \; | awk '{sum += $5} END {print sum}')
total_mb=$(echo "scale=2; $total_size / 1024 / 1024" | bc)
echo "Total size: ${total_mb}MB"

if (( $(echo "$total_mb < 5" | bc -l) )); then
    echo "✓ Under 5MB target"
else
    echo "⚠ Exceeds 5MB target - consider optimization"
fi

echo ""
echo "Done! Run './test-binaries.sh' to verify."
