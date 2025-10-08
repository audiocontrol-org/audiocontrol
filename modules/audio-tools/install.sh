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
INSTALLER_VERSION="1.0.0"

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

  echo "Version: $INSTALLER_VERSION"
  echo "Target: PiSCSI owners and hardware sampler enthusiasts"
  echo ""
  echo "This installer will:"
  echo "  1. Verify system requirements"
  echo "  2. Install npm packages globally"
  echo "  3. Configure backup sources (PiSCSI, local media)"
  echo "  4. Set up extraction workflow"
  echo "  5. Test configuration with dry run"
  echo "  6. Provide quick start guide"
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
