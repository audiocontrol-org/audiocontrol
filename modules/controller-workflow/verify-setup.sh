#!/bin/bash
# Quick verification that everything is ready for hardware testing

cd /Users/orion/work/ol_dsp-audio-control-360/modules/audio-control/modules/controller-workflow

echo "=========================================="
echo "Hardware Test Setup Verification"
echo "=========================================="
echo ""

ALL_GOOD=true

# Check CLI exists
echo "Checking for CLI..."
if [ -f "dist/cli/deploy.js" ]; then
    echo "  ✓ CLI found: dist/cli/deploy.js"
    echo "    Size: $(wc -l < dist/cli/deploy.js) lines"
else
    echo "  ✗ CLI not found at dist/cli/deploy.js"
    ALL_GOOD=false
fi

echo ""

# Check test scripts exist
echo "Checking for test scripts..."
for script in test-hardware-validation.sh run-hardware-tests.sh execute-validation.sh; do
    if [ -f "$script" ]; then
        echo "  ✓ $script ($(wc -l < $script) lines)"
    else
        echo "  ✗ $script not found"
        ALL_GOOD=false
    fi
done

echo ""

# Check Node.js
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "  ✓ Node.js installed: $NODE_VERSION"
else
    echo "  ✗ Node.js not found"
    ALL_GOOD=false
fi

echo ""

# Summary
echo "=========================================="
if [ "$ALL_GOOD" = true ]; then
    echo "✓ All components ready for testing!"
    echo ""
    echo "To run the hardware validation tests:"
    echo "  1. Ensure Launch Control XL3 is connected"
    echo "  2. Run: chmod +x execute-validation.sh"
    echo "  3. Run: ./execute-validation.sh"
else
    echo "✗ Some components are missing"
    echo ""
    echo "Try running: npm run build"
fi
echo "=========================================="
