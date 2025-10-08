#!/usr/bin/env bash
# Audio Tools One-Line Installer
# Main entry point for installation process
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/oletizi/ol_dsp/main/modules/audio-tools/install.sh | bash
#   OR
#   ./install.sh

set -euo pipefail

# =============================================================================
# Global Configuration
# =============================================================================

# Installation version
INSTALLER_VERSION="1.0.0-alpha.4"

# =============================================================================
# Version Compatibility
# =============================================================================

# Minimum compatible package version
MIN_PACKAGE_VERSION="1.0.0-alpha.4"

# Maximum compatible package version (empty = no max)
MAX_PACKAGE_VERSION=""

# Minimum Node.js version required
MIN_NODE_VERSION="18"

# GitHub repository for downloads
GITHUB_REPO="oletizi/ol_dsp"
INSTALLER_BASE_URL="https://github.com/${GITHUB_REPO}/releases/latest/download"

# Base directory for audio tools
export AUDIOTOOLS_DIR="${AUDIOTOOLS_DIR:-$HOME/.audiotools}"

# Installation state tracking
INSTALL_STATE_FILE="$AUDIOTOOLS_DIR/.install-state"

# =============================================================================
# Script Location Detection
# =============================================================================

# Detect if we're being piped from curl or run locally
if [ -t 0 ]; then
  # Running locally, script directory is accessible
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  INSTALL_SCRIPTS_DIR="$SCRIPT_DIR/scripts/install"
else
  # Being piped from curl, need to download scripts
  INSTALL_SCRIPTS_DIR="/tmp/audio-tools-install-$$"
  mkdir -p "$INSTALL_SCRIPTS_DIR"

  # TODO: Download install scripts from GitHub
  # For now, this will fail with a clear error
  echo "ERROR: Remote installation not yet implemented."
  echo "Please clone the repository and run ./install.sh"
  exit 1
fi

# =============================================================================
# Source Installation Scripts
# =============================================================================

# Verify install scripts directory exists
if [ ! -d "$INSTALL_SCRIPTS_DIR" ]; then
  echo "ERROR: Installation scripts not found at: $INSTALL_SCRIPTS_DIR"
  echo "Please run this script from the audio-tools directory."
  exit 1
fi

# Source required installation modules
source "$INSTALL_SCRIPTS_DIR/utils.sh"
source "$INSTALL_SCRIPTS_DIR/platform.sh"
source "$INSTALL_SCRIPTS_DIR/checks.sh"
source "$INSTALL_SCRIPTS_DIR/npm-install.sh"
source "$INSTALL_SCRIPTS_DIR/wizard.sh"
source "$INSTALL_SCRIPTS_DIR/config-generator.sh"
source "$INSTALL_SCRIPTS_DIR/test-runner.sh"
source "$INSTALL_SCRIPTS_DIR/completion.sh"

# =============================================================================
# Installation State Management
# =============================================================================

save_install_state() {
  local phase=$1
  mkdir -p "$(dirname "$INSTALL_STATE_FILE")"
  echo "LAST_COMPLETED_PHASE=$phase" > "$INSTALL_STATE_FILE"
  echo "INSTALL_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$INSTALL_STATE_FILE"
}

load_install_state() {
  if [ -f "$INSTALL_STATE_FILE" ]; then
    source "$INSTALL_STATE_FILE"
    return 0
  fi
  return 1
}

clear_install_state() {
  rm -f "$INSTALL_STATE_FILE"
}

# =============================================================================
# Version Compatibility Checks
# =============================================================================

verify_package_compatibility() {
  local installed_version=$1

  # Extract version components (strip prerelease tags for comparison)
  local installed_major=$(echo "$installed_version" | cut -d. -f1 | sed 's/[^0-9]//g')
  local min_major=$(echo "$MIN_PACKAGE_VERSION" | cut -d. -f1 | sed 's/[^0-9]//g')

  if [ "$installed_major" -lt "$min_major" ]; then
    error "Package version $installed_version is too old for this installer"
    echo "Minimum required version: $MIN_PACKAGE_VERSION"
    echo "Please download a newer installer version from:"
    echo "  $INSTALLER_BASE_URL/install.sh"
    return 1
  fi

  # Check maximum version if set
  if [ -n "$MAX_PACKAGE_VERSION" ]; then
    local max_major=$(echo "$MAX_PACKAGE_VERSION" | cut -d. -f1 | sed 's/[^0-9]//g')
    if [ "$installed_major" -gt "$max_major" ]; then
      warn "Package version $installed_version may not be compatible with this installer"
      echo "Maximum tested version: $MAX_PACKAGE_VERSION"
      echo "Consider downloading the latest installer from:"
      echo "  $INSTALLER_BASE_URL/install.sh"

      if ! confirm "Continue anyway?" "n"; then
        return 1
      fi
    fi
  fi

  success "Package version $installed_version is compatible"
  return 0
}

check_installer_version() {
  # Check if newer installer version is available
  local latest_installer_url="$INSTALLER_BASE_URL/install.sh"

  echo "Checking for installer updates..."

  # Download latest installer version line (first 30 lines should contain it)
  local latest_version=$(curl -fsSL "$latest_installer_url" 2>/dev/null | head -n 30 | grep '^INSTALLER_VERSION=' | cut -d'"' -f2)

  if [ -z "$latest_version" ]; then
    warn "Could not check for installer updates (network issue or GitHub rate limit)"
    return 0
  fi

  if [ "$latest_version" != "$INSTALLER_VERSION" ]; then
    warn "Newer installer version available: $latest_version (current: $INSTALLER_VERSION)"
    echo "Download the latest installer:"
    echo "  curl -fsSL $latest_installer_url | bash"
    echo ""

    if ! confirm "Continue with current installer?" "y"; then
      echo "Installation cancelled. Please download the latest installer."
      exit 0
    fi
  else
    success "Installer is up to date ($INSTALLER_VERSION)"
  fi
}

# =============================================================================
# Error Recovery
# =============================================================================

cleanup_on_error() {
  local exit_code=$?

  if [ $exit_code -ne 0 ]; then
    echo ""
    echo "=========================================="
    echo "  Installation Failed"
    echo "=========================================="
    echo ""
    warn "Installation encountered an error and was interrupted."
    echo ""
    echo "Installation state saved. You can:"
    echo "  1. Fix the issue and re-run: ./install.sh"
    echo "  2. View logs at: $AUDIOTOOLS_DIR/logs/install.log"
    echo "  3. Get help: https://github.com/oletizi/ol_dsp/issues"
    echo ""
    echo "Partial installation preserved. No files were deleted."
    echo ""
  fi
}

trap cleanup_on_error EXIT

# =============================================================================
# Resume Support
# =============================================================================

check_resume() {
  if load_install_state; then
    echo ""
    warn "Previous installation detected (stopped at: ${LAST_COMPLETED_PHASE:-unknown})"
    echo ""
    if confirm "Resume from where you left off?" "y"; then
      return 0
    else
      if confirm "Start fresh installation?" "n"; then
        clear_install_state
        rm -rf "$AUDIOTOOLS_DIR/config.json"
        rm -rf "$AUDIOTOOLS_DIR/.wizard-state"
        success "Installation state cleared"
        return 1
      else
        echo "Installation cancelled."
        exit 0
      fi
    fi
  fi
  return 1
}

# =============================================================================
# Installation Banner
# =============================================================================

show_banner() {
  section "Audio Tools Installer"

  echo "Installer Version: $INSTALLER_VERSION"
  echo "Target Packages: $MIN_PACKAGE_VERSION"
  echo "Minimum Node.js: $MIN_NODE_VERSION"
  echo "Target: PiSCSI owners and hardware sampler enthusiasts"
  echo ""
  echo "This installer will:"
  echo "  1. Verify system requirements"
  echo "  2. Check for installer updates"
  echo "  3. Install npm packages globally"
  echo "  4. Configure backup sources (PiSCSI, local media)"
  echo "  5. Set up extraction workflow"
  echo "  6. Test configuration with dry run"
  echo "  7. Provide quick start guide"
  echo ""
  echo "Installation takes approximately 2-5 minutes."
  echo "You can press Ctrl+C at any time to cancel."
  echo ""

  if ! confirm "Ready to begin?" "y"; then
    echo "Installation cancelled."
    exit 0
  fi
}

# =============================================================================
# Main Installation Flow
# =============================================================================

run_installation() {
  local resume_phase=""

  # Check for resume
  if check_resume; then
    resume_phase="${LAST_COMPLETED_PHASE:-}"
  fi

  # Show banner (unless resuming)
  if [ -z "$resume_phase" ]; then
    show_banner
  fi

  # Phase 1: Environment Discovery
  if [ -z "$resume_phase" ] || [ "$resume_phase" = "" ]; then
    section "Phase 1: Environment Discovery"

    # Check installer version FIRST
    check_installer_version

    # Detect platform
    echo "Detecting platform..."
    export PLATFORM=$(detect_platform)
    success "Platform: $PLATFORM"

    # Check Node.js
    check_nodejs

    # Check BorgBackup
    check_borgbackup

    # Check disk space
    check_disk_space

    save_install_state "phase1"
  fi

  # Phase 2: Package Installation
  if [ -z "$resume_phase" ] || [ "$resume_phase" = "phase1" ]; then
    section "Phase 2: Package Installation"

    install_packages
    verify_binaries

    save_install_state "phase2"
  fi

  # Phase 3: Interactive Configuration Wizard
  if [ -z "$resume_phase" ] || [ "$resume_phase" = "phase2" ]; then
    run_configuration_wizard

    save_install_state "phase3"
  fi

  # Phase 4: Configuration Generation
  if [ -z "$resume_phase" ] || [ "$resume_phase" = "phase3" ]; then
    run_configuration_generation

    save_install_state "phase4"
  fi

  # Phase 5: Test Run
  if [ -z "$resume_phase" ] || [ "$resume_phase" = "phase4" ]; then
    run_test_phase

    save_install_state "phase5"
  fi

  # Phase 6: Completion
  run_completion_phase

  # Clear installation state (successful completion)
  clear_install_state
}

# =============================================================================
# Logging Setup
# =============================================================================

setup_logging() {
  # Create log directory
  mkdir -p "$AUDIOTOOLS_DIR/logs"

  # Log file
  local log_file="$AUDIOTOOLS_DIR/logs/install.log"

  # Redirect stdout and stderr to log file while keeping terminal output
  exec > >(tee -a "$log_file")
  exec 2>&1

  echo "Installation started at $(date)"
  echo "Installer version: $INSTALLER_VERSION"
  echo "Platform: $(uname -s) $(uname -m)"
  echo "User: $USER"
  echo "Home: $HOME"
  echo ""
}

# =============================================================================
# Main Entry Point
# =============================================================================

main() {
  # Setup logging
  setup_logging

  # Run installation
  run_installation

  # Success
  return 0
}

# Run main installation
main "$@"
