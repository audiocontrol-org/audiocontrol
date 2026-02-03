#!/bin/bash
# Wrapper script to execute hardware validation and capture results
# This script will be executed to run all hardware tests

cd /Users/orion/work/ol_dsp-audio-control-360/modules/audio-control/modules/controller-workflow

echo "Verifying test script exists..."
ls -la test-hardware-validation.sh

echo ""
echo "Making test script executable..."
chmod +x test-hardware-validation.sh

echo ""
echo "Starting hardware validation tests..."
echo "========================================"
echo ""

# Execute the test script and capture output
./test-hardware-validation.sh 2>&1 | tee hardware-test-results.txt

EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "========================================"
echo "Test execution complete!"
echo "Exit code: $EXIT_CODE"
echo ""
echo "Full results saved to: hardware-test-results.txt"
echo ""

# Show file verification
echo "Verifying output files were created:"
ls -lh ./output/ 2>/dev/null || echo "No output directory found"

exit $EXIT_CODE
