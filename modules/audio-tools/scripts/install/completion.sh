#!/usr/bin/env bash
# Audio Tools Installation Completion - Phase 6
# Displays installation summary and provides next steps

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source utilities
source "$SCRIPT_DIR/utils.sh"

# =============================================================================
# Installation Summary
# =============================================================================

show_installation_summary() {
  echo ""
  echo "=========================================="
  echo "  Installation Complete!"
  echo "=========================================="
  echo ""
  echo "Audio Tools has been successfully installed and configured."
  echo ""

  # Installed packages
  echo "Installed Packages:"
  local packages=(
    "@oletizi/sampler-backup  (akai-backup)"
    "@oletizi/sampler-export  (akai-extract)"
    "@oletizi/sampler-lib"
    "@oletizi/sampler-devices"
  )

  for pkg in "${packages[@]}"; do
    success "$pkg"
  done
  echo ""

  # Configuration summary
  echo "Configuration:"

  # BorgBackup repository
  if [ "${SKIP_BACKUP:-false}" != "true" ] && [ "${CONFIG_BACKUP_TYPE:-none}" != "none" ]; then
    success "BorgBackup repository initialized"
  fi

  # Remote sources
  if [ -n "${CONFIG_REMOTE_SOURCES:-}" ]; then
    IFS=' ' read -ra sources <<< "${CONFIG_REMOTE_SOURCES}"
    success "Remote sources configured: ${#sources[@]}"
  fi

  # Local sources
  if [ "${CONFIG_BACKUP_TYPE:-none}" = "local" ] || [ "${CONFIG_BACKUP_TYPE:-none}" = "both" ]; then
    success "Local media support enabled"
  fi

  # Extraction path
  local extract_path="${CONFIG_EXTRACT_PATH:-$HOME/.audiotools/sampler-export/extracted}"
  success "Extraction path: $extract_path"

  # Scheduled backups
  if [ "${CONFIG_SCHEDULE:-manual}" != "manual" ]; then
    success "Scheduled backups: ${CONFIG_SCHEDULE_CRON:-Daily at 2:00 AM}"
  fi

  # Library integration
  if [ -n "${CONFIG_LIBRARY_PATH:-}" ]; then
    success "Library integration enabled: ${CONFIG_LIBRARY_PATH}"
  fi

  echo ""
}

# =============================================================================
# Verification Commands
# =============================================================================

show_verification_commands() {
  echo "Verification Commands:"
  echo "----------------------"
  echo ""

  echo "Check installation:"
  echo "  \$ which akai-backup akai-extract"
  echo ""

  echo "View configuration:"
  echo "  \$ cat ~/.audiotools/config.json"
  echo ""

  if [ -n "${CONFIG_REMOTE_SOURCES:-}" ]; then
    echo "Test SSH connections:"
    IFS=' ' read -ra sources <<< "${CONFIG_REMOTE_SOURCES}"
    for source in "${sources[@]}"; do
      local user_host="${source%%:*}"
      echo "  \$ ssh $user_host 'echo Connection successful'"
    done
    echo ""
  fi

  if [ "${SKIP_BACKUP:-false}" != "true" ] && command_exists borg; then
    echo "Check BorgBackup:"
    echo "  \$ borg --version"
    echo "  \$ borg info ~/.audiotools/borg-repo"
    echo ""
  fi
}

# =============================================================================
# Quick Start Guide
# =============================================================================

show_quick_start() {
  echo "Quick Start:"
  echo "------------"
  echo ""

  # Backup-specific commands
  if [ "${CONFIG_BACKUP_TYPE:-none}" != "none" ] && [ "${SKIP_BACKUP:-false}" != "true" ]; then
    echo "1. Run your first backup:"
    echo "   \$ akai-backup batch"
    echo ""

    echo "2. Extract disk images:"
    echo "   \$ akai-extract batch"
    echo ""

    echo "3. View backup archives:"
    echo "   \$ akai-backup list"
    echo ""

    echo "4. Check repository info:"
    echo "   \$ akai-backup info"
    echo ""

    # One-command workflow
    local workflow_script="${AUDIOTOOLS_DIR:-$HOME/.audiotools}/scripts/backup-and-extract.sh"
    if [ -f "$workflow_script" ]; then
      echo "5. One-command workflow:"
      echo "   \$ $workflow_script"
      echo ""
    fi
  else
    # Extract-only mode
    echo "1. Extract a disk image:"
    echo "   \$ akai-extract single /path/to/disk.hds"
    echo ""

    echo "2. Extract all images from a directory:"
    echo "   \$ akai-extract batch --source /path/to/images"
    echo ""
  fi

  # Help commands
  echo "Get help:"
  echo "   \$ akai-backup --help"
  echo "   \$ akai-extract --help"
  echo ""
}

# =============================================================================
# Next Steps
# =============================================================================

show_next_steps() {
  echo "Next Steps:"
  echo "-----------"
  echo ""

  if [ "${CONFIG_BACKUP_TYPE:-none}" != "none" ] && [ "${SKIP_BACKUP:-false}" != "true" ]; then
    echo "1. Run your first backup to verify everything works"
    echo "2. Check the extracted samples in your output directory"
    echo "3. Import SFZ/DecentSampler programs into your DAW"

    if [ "${CONFIG_SCHEDULE:-manual}" != "manual" ]; then
      echo "4. Verify scheduled backups are working (check logs tomorrow)"
    else
      echo "4. Consider setting up automated backups for convenience"
    fi
  else
    echo "1. Prepare disk images for extraction"
    echo "2. Run extraction on your disk images"
    echo "3. Import programs into your DAW or sampler"
    echo "4. Consider installing BorgBackup for backup functionality"
  fi

  echo ""
  echo "Documentation:"
  echo "  README: https://github.com/oletizi/ol_dsp/tree/main/modules/audio-tools"
  echo "  Issues: https://github.com/oletizi/ol_dsp/issues"
  echo ""

  local quickstart="${AUDIOTOOLS_DIR:-$HOME/.audiotools}/QUICKSTART.md"
  if [ -f "$quickstart" ]; then
    echo "Quick reference guide:"
    echo "  $quickstart"
    echo ""
  fi

  echo "Configuration file:"
  echo "  ${AUDIOTOOLS_DIR:-$HOME/.audiotools}/config.json"
  echo ""

  echo "Log files:"
  echo "  ${AUDIOTOOLS_DIR:-$HOME/.audiotools}/logs/backup.log"
  echo "  ${AUDIOTOOLS_DIR:-$HOME/.audiotools}/logs/backup.error.log"
  echo ""
}

# =============================================================================
# Common Troubleshooting Tips
# =============================================================================

show_troubleshooting() {
  echo "Common Issues:"
  echo "--------------"
  echo ""

  echo "Cannot connect to PiSCSI:"
  echo "  • Verify PiSCSI is powered on and connected to network"
  echo "  • Test: ping <piscsi-hostname>"
  echo "  • Check SSH key authentication: ssh <user>@<piscsi-hostname>"
  echo ""

  if command_exists borg; then
    echo "Repository locked:"
    echo "  • If backup was interrupted, break lock:"
    echo "    \$ borg break-lock ~/.audiotools/borg-repo"
    echo ""
  fi

  echo "Command not found (akai-backup, akai-extract):"
  echo "  • Add npm global bin to PATH:"
  echo "    \$ export PATH=\"\$(npm config get prefix)/bin:\$PATH\""
  echo "  • Add to your shell profile (~/.bashrc, ~/.zshrc, etc.)"
  echo ""

  echo "View detailed logs:"
  echo "  \$ tail -f ~/.audiotools/logs/backup.log"
  echo "  \$ tail -f ~/.audiotools/logs/backup.error.log"
  echo ""

  echo "Need help? Visit the documentation or open an issue."
  echo ""
}

# =============================================================================
# Final Banner
# =============================================================================

show_final_banner() {
  echo "=========================================="
  echo "  Thank you for installing Audio Tools!"
  echo "=========================================="
  echo ""
  echo "Happy sampling!"
  echo ""
}

# =============================================================================
# Main Completion Phase Runner
# =============================================================================

run_completion_phase() {
  section "Phase 6: Installation Complete"

  # Show installation summary
  show_installation_summary

  # Show verification commands
  show_verification_commands

  # Show quick start guide
  show_quick_start

  # Show next steps
  show_next_steps

  # Show troubleshooting tips
  show_troubleshooting

  # Final banner
  show_final_banner

  return 0
}

# =============================================================================
# Direct Execution Support
# =============================================================================

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  # Being run directly, not sourced
  run_completion_phase
fi
