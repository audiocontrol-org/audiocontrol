#!/bin/bash
# Final test execution script with pre-flight checks
# This ensures the environment is ready before running hardware tests

set -e

cd /Users/orion/work/ol_dsp-audio-control-360/modules/audio-control/modules/controller-workflow

echo "=========================================="
echo "Pre-Flight Checks"
echo "=========================================="
echo ""

# Check 1: Verify dist/cli/deploy.js exists
echo "1. Checking for compiled CLI..."
if [ -f "dist/cli/deploy.js" ]; then
    echo "   ✓ CLI found: dist/cli/deploy.js"
    ls -lh dist/cli/deploy.js
else
    echo "   ✗ CLI not found. Building project..."
    npm run build
fi

echo ""

# Check 2: Verify test script exists
echo "2. Checking for test script..."
if [ -f "test-hardware-validation.sh" ]; then
    echo "   ✓ Test script found"
    wc -l test-hardware-validation.sh
else
    echo "   ✗ Test script not found!"
    exit 1
fi

echo ""

# Check 3: Make scripts executable
echo "3. Making scripts executable..."
chmod +x test-hardware-validation.sh
chmod +x run-hardware-tests.sh
echo "   ✓ Scripts are executable"

echo ""

# Check 4: Clean previous test output
echo "4. Cleaning previous test output..."
rm -rf ./output
mkdir -p ./output
echo "   ✓ Output directory ready"

echo ""
echo "=========================================="
echo "Executing Hardware Validation Tests"
echo "=========================================="
echo ""
echo "Please ensure:"
echo "  - Launch Control XL3 is connected via USB"
echo "  - No other applications are using the device"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Execute the full test suite
./run-hardware-tests.sh

EXIT_CODE=$?

echo ""
echo "=========================================="
echo "Final Verification"
echo "=========================================="
echo ""

# Show what was created
echo "Files created during testing:"
ls -lh ./output/ 2>/dev/null || echo "No output files created"

echo ""
echo "Test result file:"
ls -lh hardware-test-results.txt 2>/dev/null || echo "No results file created"

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✓ All tests completed successfully!"
else
    echo "✗ Some tests failed (exit code: $EXIT_CODE)"
fi

exit $EXIT_CODE
