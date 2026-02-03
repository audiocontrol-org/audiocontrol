#!/bin/bash
# Hardware Validation Test Script for Feature 360
# Tests MIDI Controller to DAW Deployment Pipeline
# Device: Launch Control XL3 (Serial: LX280935400469)

set -e

echo "=========================================="
echo "Feature 360 Hardware Validation Tests"
echo "=========================================="
echo ""
echo "Working Directory: $(pwd)"
echo "Device: Launch Control XL3"
echo "Serial: LX280935400469"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0

# Function to report test result
report_test() {
    local test_name="$1"
    local result="$2"

    if [ "$result" = "PASS" ]; then
        echo -e "${GREEN}✓ PASS${NC}: $test_name"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $test_name"
        ((TESTS_FAILED++))
    fi
}

# Create output directory
mkdir -p ./output

echo "=========================================="
echo "TEST 1: List Configuration Slots"
echo "=========================================="
echo ""

if node dist/cli/deploy.js list > ./output/test1-list-output.txt 2>&1; then
    cat ./output/test1-list-output.txt
    echo ""
    report_test "Device connection and slot listing" "PASS"

    # Check for specific expected elements
    if grep -q "Configuration Slots:" ./output/test1-list-output.txt; then
        report_test "Slot listing format" "PASS"
    else
        report_test "Slot listing format" "FAIL"
    fi

    # Count slots (should be 16: slots 0-15)
    SLOT_COUNT=$(grep -c "Slot [0-9]" ./output/test1-list-output.txt || true)
    if [ "$SLOT_COUNT" -eq 16 ]; then
        report_test "All 16 slots present (0-15)" "PASS"
    else
        echo "  Found $SLOT_COUNT slots, expected 16"
        report_test "All 16 slots present (0-15)" "FAIL"
    fi
else
    echo "ERROR: List command failed"
    cat ./output/test1-list-output.txt
    report_test "Device connection and slot listing" "FAIL"
fi

echo ""
echo "=========================================="
echo "TEST 2: Read Slot 0 Configuration"
echo "=========================================="
echo ""

if node dist/cli/deploy.js deploy --slot 0 > ./output/test2-deploy-output.txt 2>&1; then
    cat ./output/test2-deploy-output.txt
    echo ""
    report_test "Slot 0 deployment command execution" "PASS"

    # Check if canonical YAML was generated
    if ls -la ./output/*.yaml 2>/dev/null | head -5; then
        report_test "Canonical YAML generation" "PASS"
        echo ""
        echo "Generated YAML files:"
        ls -1 ./output/*.yaml
    else
        report_test "Canonical YAML generation" "FAIL"
    fi
else
    echo "ERROR: Deploy command failed"
    cat ./output/test2-deploy-output.txt
    report_test "Slot 0 deployment command execution" "FAIL"
fi

echo ""
echo "=========================================="
echo "TEST 3: Canonical YAML Structure"
echo "=========================================="
echo ""

# Find the most recent YAML file
YAML_FILE=$(ls -t ./output/*.yaml 2>/dev/null | head -1)

if [ -n "$YAML_FILE" ] && [ -f "$YAML_FILE" ]; then
    echo "Examining: $YAML_FILE"
    echo ""
    echo "File size: $(wc -l < "$YAML_FILE") lines"
    echo ""
    echo "First 50 lines:"
    echo "----------------------------------------"
    head -50 "$YAML_FILE"
    echo "----------------------------------------"
    echo ""

    report_test "YAML file readable" "PASS"

    # Check for required YAML structure elements
    if grep -q "metadata:" "$YAML_FILE"; then
        report_test "YAML metadata section present" "PASS"
    else
        report_test "YAML metadata section present" "FAIL"
    fi

    if grep -q "controls:" "$YAML_FILE"; then
        report_test "YAML controls section present" "PASS"
    else
        report_test "YAML controls section present" "FAIL"
    fi
else
    echo "No YAML file found"
    report_test "YAML file readable" "FAIL"
fi

echo ""
echo "=========================================="
echo "TEST 4: Ardour Deployment"
echo "=========================================="
echo ""

if node dist/cli/deploy.js deploy --slot 0 --daw ardour > ./output/test4-ardour-output.txt 2>&1; then
    cat ./output/test4-ardour-output.txt
    echo ""
    report_test "Ardour deployment command execution" "PASS"

    # Check if Ardour .map file was generated
    if ls -la ./output/*.map 2>/dev/null | head -5; then
        report_test "Ardour .map file generation" "PASS"
        echo ""
        echo "Generated .map files:"
        ls -1 ./output/*.map

        # Show first 50 lines of .map file
        MAP_FILE=$(ls -t ./output/*.map 2>/dev/null | head -1)
        if [ -n "$MAP_FILE" ] && [ -f "$MAP_FILE" ]; then
            echo ""
            echo "First 50 lines of $MAP_FILE:"
            echo "----------------------------------------"
            head -50 "$MAP_FILE"
            echo "----------------------------------------"

            # Check for XML structure
            if grep -q "<?xml" "$MAP_FILE"; then
                report_test "Ardour .map XML structure valid" "PASS"
            else
                report_test "Ardour .map XML structure valid" "FAIL"
            fi
        fi
    else
        report_test "Ardour .map file generation" "FAIL"
    fi
else
    echo "ERROR: Ardour deployment failed"
    cat ./output/test4-ardour-output.txt
    report_test "Ardour deployment command execution" "FAIL"
fi

echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo ""
echo "Total Tests Passed: $TESTS_PASSED"
echo "Total Tests Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    echo ""
    echo "Generated files:"
    ls -lh ./output/
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
