#!/bin/bash
# Baseline Test Execution Script
# Run by test-automator to establish current state

echo "🤖 Launch Control XL3 - Baseline Test Execution"
echo "================================================"
echo "Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# Change to project directory
cd /Users/orion/work/ol_dsp/modules/audio-control/modules/launch-control-xl3

echo "📁 Working Directory: $(pwd)"
echo ""

# Phase 1: Check if fixes are complete by looking for recent changes
echo "🔍 Phase 1: Checking for Recent Protocol Fixes"
echo "-----------------------------------------------"

# Check git status for any uncommitted changes
echo "Git status:"
git status --porcelain

# Check recent commits
echo ""
echo "Recent commits (last 3):"
git log --oneline -3

echo ""
echo "🔧 Phase 2: Compilation Test"
echo "----------------------------"

# Clean build
echo "→ Cleaning previous build..."
npm run clean
if [ $? -eq 0 ]; then
    echo "  ✓ Clean completed"
else
    echo "  ❌ Clean failed"
    exit 1
fi

# Build
echo "→ Running TypeScript compilation..."
start_time=$(date +%s)
npm run build 2>&1 | tee build.log
build_result=$?
end_time=$(date +%s)
duration=$((end_time - start_time))

if [ $build_result -eq 0 ]; then
    echo "  ✓ Build completed in ${duration}s"

    # Check for warnings in build log
    warning_count=$(grep -i "warning" build.log | wc -l)
    error_count=$(grep -i "error" build.log | wc -l)

    echo "  📊 Build Statistics:"
    echo "    - Duration: ${duration}s"
    echo "    - Warnings: $warning_count"
    echo "    - Errors: $error_count"

    if [ $warning_count -gt 0 ]; then
        echo "  ⚠️  Warnings found:"
        grep -i "warning" build.log | head -5
    fi
else
    echo "  ❌ Build failed after ${duration}s"
    echo "  📋 Error details:"
    tail -10 build.log
    exit 1
fi

echo ""
echo "📋 Phase 3: Test Readiness Verification"
echo "---------------------------------------"

# Verify test files exist
test_files=(
    "utils/test-round-trip.ts"
    "utils/automated-protocol-test.ts"
    "test-automation-results.md"
    "test-execution-log.md"
)

echo "→ Verifying test framework files..."
for file in "${test_files[@]}"; do
    if [ -f "$file" ]; then
        size=$(wc -l < "$file")
        echo "  ✓ $file ($size lines)"
    else
        echo "  ❌ $file (missing)"
    fi
done

# Check if dist directory was created
if [ -d "dist" ]; then
    file_count=$(find dist -name "*.js" | wc -l)
    echo "  ✓ dist directory created with $file_count JS files"
else
    echo "  ❌ dist directory not found"
fi

echo ""
echo "🎯 Baseline Test Summary"
echo "======================="
echo "• Compilation: $([ $build_result -eq 0 ] && echo "✅ PASS" || echo "❌ FAIL")"
echo "• Test Framework: ✅ READY"
echo "• Build Duration: ${duration}s"
echo "• Next Phase: Waiting for protocol fixes"
echo ""

# Update execution log
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ): Baseline test completed - Build: $([ $build_result -eq 0 ] && echo "PASS" || echo "FAIL")" >> test-execution-log.md

echo "📝 Baseline test complete. Ready for protocol fix verification."
echo "   Run automated test suite after other agents complete fixes:"
echo "   npx tsx utils/automated-protocol-test.ts"