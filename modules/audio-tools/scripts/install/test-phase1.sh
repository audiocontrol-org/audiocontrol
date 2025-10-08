#!/usr/bin/env bash
# Test script for Phase 1: Environment Discovery

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the modules
source "$SCRIPT_DIR/utils.sh"
source "$SCRIPT_DIR/platform.sh"
source "$SCRIPT_DIR/checks.sh"

echo "=========================================="
echo "  Phase 1: Environment Discovery Tests"
echo "=========================================="
echo ""

# Test 1: Platform Detection
echo "Test 1: Platform Detection"
echo "--------------------------"
PLATFORM=$(detect_platform)
echo "Detected platform: $PLATFORM"
OS_NAME=$(get_os_name "$PLATFORM")
echo "OS name: $OS_NAME"
echo "Architecture: $(get_arch)"
echo ""

# Test 2: Package Manager Detection
echo "Test 2: Package Manager Detection"
echo "---------------------------------"
PKG_MANAGER=$(get_package_manager)
echo "Package manager: $PKG_MANAGER"
if is_macos; then
  echo "Running on macOS"
elif is_linux; then
  echo "Running on Linux"
  DISTRO=$(get_linux_distro)
  echo "Distribution: $DISTRO"
fi
echo ""

# Test 3: Utility Functions
echo "Test 3: Utility Functions"
echo "------------------------"
success "This is a success message"
info "This is an info message"
warn "This is a warning message"
echo ""

# Test 4: Command Existence
echo "Test 4: Command Checks"
echo "---------------------"
if command_exists node; then
  echo "✓ node command found"
else
  echo "✗ node command not found"
fi

if command_exists npm; then
  echo "✓ npm command found"
else
  echo "✗ npm command not found"
fi

if command_exists rsync; then
  echo "✓ rsync command found"
else
  echo "✗ rsync command not found"
fi

if command_exists ssh; then
  echo "✓ ssh command found"
else
  echo "✗ ssh command not found"
fi
echo ""

# Test 5: Dependency Checks
echo "Test 5: Full Dependency Check"
echo "-----------------------------"
check_all_dependencies

echo ""
echo "=========================================="
echo "  All Tests Completed"
echo "=========================================="
