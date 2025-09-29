#!/bin/bash

# Round-trip test execution script
# This script compiles TypeScript and runs the round-trip test

cd "/Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3"

echo "=========================================="
echo "Launch Control XL3 Round-Trip Test Suite"
echo "=========================================="
echo ""

echo "Step 1: Compiling TypeScript..."
echo "--------------------------------"
npm run build
BUILD_EXIT_CODE=$?

if [ $BUILD_EXIT_CODE -ne 0 ]; then
    echo "❌ TypeScript compilation failed!"
    echo "Build exit code: $BUILD_EXIT_CODE"
    exit 1
fi

echo "✅ TypeScript compilation successful!"
echo ""

echo "Step 2: Running Round-Trip Test..."
echo "----------------------------------"
echo "Using the newer Node.js test script with enhanced protocol verification..."
echo ""

# Run the newer round-trip test that includes control name verification
npm run test:round-trip:node

TEST_EXIT_CODE=$?
echo ""
echo "Round-trip test completed with exit code: $TEST_EXIT_CODE"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "✅ Round-trip test PASSED!"
else
    echo "❌ Round-trip test FAILED!"
fi

echo ""
echo "=========================================="
echo "Test Results Summary"
echo "=========================================="
echo "Build: $([ $BUILD_EXIT_CODE -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "Round-trip: $([ $TEST_EXIT_CODE -eq 0 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo ""

exit $TEST_EXIT_CODE