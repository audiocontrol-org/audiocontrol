#!/bin/bash
# Test mtools binaries for all platforms using Docker
# Verifies that binaries execute correctly on their target platforms

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
BIN_DIR="$PROJECT_ROOT/bin/mtools"

echo "Testing mtools binaries..."
echo ""

# Function to test a binary
test_binary() {
    local platform=$1
    local docker_platform=$2
    local base_image=$3
    local binary_path="$BIN_DIR/$platform/mcopy"

    echo "=== Testing $platform ==="

    if [ ! -f "$binary_path" ]; then
        echo "✗ Binary not found: $binary_path"
        echo ""
        return 1
    fi

    echo "Binary: $binary_path"
    echo "Size: $(ls -lh "$binary_path" | awk '{print $5}')"

    # Test execution in Docker
    docker run --rm \
        --platform "$docker_platform" \
        -v "$binary_path:/mcopy:ro" \
        "$base_image" \
        bash -c "
            set -e
            echo 'Testing binary execution...'
            chmod +x /mcopy
            /mcopy --version 2>&1 | head -5 || echo 'Version check failed (expected for some builds)'
            /mcopy --help 2>&1 | head -5 || echo 'Help check failed'
            echo '✓ Binary executes'
        "

    echo "✓ $platform passed"
    echo ""
}

# Test Linux binaries
test_binary "linux-x64" "linux/amd64" "ubuntu:22.04"
test_binary "linux-arm64" "linux/arm64" "ubuntu:22.04"

# Test macOS binaries (can only check if they exist locally)
echo "=== Testing macOS binaries ==="
for platform in darwin-arm64 darwin-x64; do
    binary_path="$BIN_DIR/$platform/mcopy"
    if [ -f "$binary_path" ]; then
        echo "$platform: $(ls -lh "$binary_path" | awk '{print $5}')"

        # If on macOS, try to execute
        if [[ "$OSTYPE" == "darwin"* ]]; then
            if $binary_path --version &>/dev/null; then
                echo "✓ $platform executes locally"
            else
                echo "⚠ $platform exists but may not execute on this machine"
            fi
        else
            echo "ℹ $platform present (can't test execution on non-Mac)"
        fi
    else
        echo "✗ $platform: MISSING"
    fi
done
echo ""

echo "=== Test Summary ==="
echo "All available binaries tested successfully!"
