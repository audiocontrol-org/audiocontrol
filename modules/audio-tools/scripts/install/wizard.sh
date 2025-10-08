#!/usr/bin/env bash
# Audio Tools Installer - Interactive Configuration Wizard
# Phase 3: Interactive configuration and setup

set -euo pipefail

# Source utility functions
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./utils.sh
source "$SCRIPT_DIR/utils.sh"

# Configuration variables (to be set by wizard)
CONFIG_SAMPLERS=""
CONFIG_BACKUP_TYPE=""
CONFIG_REMOTE_SOURCES=()
CONFIG_SSH_USER=""
CONFIG_REMOTE_PATH=""
CONFIG_LOCAL_MOUNT_PATTERN=""
CONFIG_EXTRACT_PATH=""
CONFIG_OUTPUT_FORMATS=""
CONFIG_LIBRARY_PATH=""
CONFIG_SYMLINK_STRATEGY=""
CONFIG_SCHEDULE="manual"
CONFIG_SCHEDULE_CRON=""

# State file for resumable wizard
STATE_FILE="$HOME/.audiotools/.wizard-state"

# =============================================================================
# SECTION 1: Sampler Selection
# =============================================================================

wizard_sampler_selection() {
  echo ""
  echo "1. Sampler Selection"
  echo "-------------------"
  echo ""
  echo "Which Akai samplers do you own? (select all that apply)"
  echo ""

  local samplers=("S900" "S1000" "S3000XL" "S5000" "S6000")

  echo "Available samplers: ${samplers[*]}"
  read -p "Enter sampler models (comma-separated) [S3000XL,S5000]: " sampler_input

  # Default to common models
  sampler_input=${sampler_input:-"S3000XL,S5000"}

  # Store in config
  CONFIG_SAMPLERS="$sampler_input"

  echo ""
  success "Selected samplers: $CONFIG_SAMPLERS"

  # Save state
  save_wizard_state "samplers"
}

# =============================================================================
# SECTION 2: Backup Source Configuration
# =============================================================================

wizard_backup_sources() {
  echo ""
  echo "2. Backup Source Configuration"
  echo "-----------------------------"
  echo ""

  if [ "${SKIP_BACKUP:-false}" = "true" ]; then
    warn "BorgBackup not installed. Skipping backup configuration."
    CONFIG_BACKUP_TYPE="none"
    save_wizard_state "backup_sources"
    return 0
  fi

  echo "How will you backup your samplers?"
  echo ""
  echo "1) Remote via PiSCSI (SSH-based)"
  echo "2) Local media (SD cards, USB drives)"
  echo "3) Both remote and local"
  echo "4) Skip backup setup (export only)"
  echo ""
  read -p "Choice [1]: " backup_choice
  backup_choice=${backup_choice:-1}

  case "$backup_choice" in
    1)
      CONFIG_BACKUP_TYPE="remote"
      wizard_remote_config
      ;;
    2)
      CONFIG_BACKUP_TYPE="local"
      wizard_local_config
      ;;
    3)
      CONFIG_BACKUP_TYPE="both"
      wizard_remote_config
      wizard_local_config
      ;;
    4)
      CONFIG_BACKUP_TYPE="none"
      ;;
    *)
      error "Invalid choice: $backup_choice"
      ;;
  esac

  save_wizard_state "backup_sources"
}

# =============================================================================
# SECTION 2.1: Remote Sources (PiSCSI)
# =============================================================================

wizard_remote_config() {
  echo ""
  echo "Remote Source Configuration"
  echo ""

  read -p "Enter PiSCSI hostnames (comma-separated) [pi-scsi2.local]: " piscsi_hosts
  piscsi_hosts=${piscsi_hosts:-"pi-scsi2.local"}

  # Default username and path
  read -p "SSH username [pi]: " ssh_user
  CONFIG_SSH_USER=${ssh_user:-"pi"}

  read -p "Remote disk image path [~/images/]: " remote_path
  CONFIG_REMOTE_PATH=${remote_path:-"~/images/"}

  # Build source URIs
  IFS=',' read -ra PISCSI_HOSTS <<< "$piscsi_hosts"
  CONFIG_REMOTE_SOURCES=()

  for host in "${PISCSI_HOSTS[@]}"; do
    # Trim whitespace
    host=$(echo "$host" | xargs)
    local source="$CONFIG_SSH_USER@$host:$CONFIG_REMOTE_PATH"
    CONFIG_REMOTE_SOURCES+=("$source")

    # Test SSH connection
    echo ""
    if confirm "Test SSH connection to $host?" "y"; then
      test_ssh_connection "$CONFIG_SSH_USER" "$host"
    fi
  done

  echo ""
  echo "Remote sources configured:"
  printf '  %s\n' "${CONFIG_REMOTE_SOURCES[@]}"
}

test_ssh_connection() {
  local user=$1
  local host=$2

  echo "Testing SSH connection to $user@$host..."
  if ssh -o ConnectTimeout=5 -o BatchMode=yes "$user@$host" "echo 'Connection successful'" 2>/dev/null; then
    success "SSH connection to $host works!"
  else
    warn "Could not connect to $host"
    echo ""
    echo "Troubleshooting steps:"
    echo "1. Ensure PiSCSI is powered on and connected to network"
    echo "2. Verify hostname resolves: ping $host"
    echo "3. Test SSH manually: ssh $user@$host"
    echo "4. Setup SSH keys if needed"
    echo ""

    if confirm "Setup SSH keys for $host?" "n"; then
      setup_ssh_keys "$user" "$host"
    fi

    if ! confirm "Continue anyway?" "n"; then
      exit 1
    fi
  fi
}

setup_ssh_keys() {
  local user=$1
  local host=$2

  echo ""
  echo "SSH Key Setup"
  echo "-------------"
  echo ""

  if [ ! -f "$HOME/.ssh/id_rsa.pub" ] && [ ! -f "$HOME/.ssh/id_ed25519.pub" ]; then
    if confirm "No SSH keys found. Generate one now?" "y"; then
      ssh-keygen -t ed25519 -C "audio-tools@$(hostname)" || warn "Failed to generate SSH key"
    fi
  fi

  if confirm "Copy SSH key to $host?" "y"; then
    ssh-copy-id "$user@$host" || warn "Failed to copy SSH key"
  fi
}

# =============================================================================
# SECTION 2.2: Local Sources
# =============================================================================

wizard_local_config() {
  echo ""
  echo "Local Source Configuration"
  echo ""

  local default_pattern
  case "${PLATFORM:-darwin-arm64}" in
    darwin*)
      default_pattern="/Volumes/*"
      ;;
    linux*)
      default_pattern="/media/$USER/*"
      ;;
  esac

  echo "Where do you typically mount SD cards/USB drives?"
  read -p "Mount point pattern [$default_pattern]: " mount_pattern
  CONFIG_LOCAL_MOUNT_PATTERN=${mount_pattern:-$default_pattern}

  # Detect currently mounted media
  echo ""
  echo "Scanning for currently mounted media..."
  detect_mounted_media
}

detect_mounted_media() {
  local found_media=()

  case "${PLATFORM:-darwin-arm64}" in
    darwin*)
      # List /Volumes excluding system volumes
      for vol in /Volumes/*; do
        [ "$vol" = "/Volumes/Macintosh HD" ] && continue
        [ -d "$vol" ] && found_media+=("$vol")
      done
      ;;
    linux*)
      # List /media/$USER
      for vol in /media/$USER/*; do
        [ -d "$vol" ] && found_media+=("$vol")
      done
      # Also check /mnt
      for vol in /mnt/*; do
        [ -d "$vol" ] && found_media+=("$vol")
      done
      ;;
  esac

  if [ ${#found_media[@]} -gt 0 ]; then
    echo "Found mounted media:"
    printf '  %s\n' "${found_media[@]}"
    echo ""
    if confirm "Want to test extraction from any of these?" "n"; then
      info "Test extraction will be available after installation completes"
    fi
  else
    info "No removable media currently mounted."
  fi
}

# =============================================================================
# SECTION 3: Extraction Configuration
# =============================================================================

wizard_extraction_config() {
  echo ""
  echo "3. Extraction Configuration"
  echo "--------------------------"
  echo ""

  local default_extract_path="$HOME/.audiotools/sampler-export/extracted"

  echo "Extracted samples will be stored at:"
  echo "  $default_extract_path"
  echo ""

  if confirm "Use this location?" "y"; then
    CONFIG_EXTRACT_PATH="$default_extract_path"
  else
    read -p "Enter custom extraction path: " custom_path
    CONFIG_EXTRACT_PATH="${custom_path/#\~/$HOME}"
  fi

  # Create extraction directory
  create_dir "$CONFIG_EXTRACT_PATH"

  echo ""
  echo "Which output formats do you need?"
  echo ""
  echo "1) SFZ only (universal, works in most DAWs)"
  echo "2) DecentSampler only (specialized, simpler format)"
  echo "3) Both SFZ and DecentSampler"
  echo ""
  read -p "Choice [3]: " format_choice
  format_choice=${format_choice:-3}

  case "$format_choice" in
    1) CONFIG_OUTPUT_FORMATS="sfz" ;;
    2) CONFIG_OUTPUT_FORMATS="decentsampler" ;;
    3) CONFIG_OUTPUT_FORMATS="sfz,decentsampler" ;;
    *) CONFIG_OUTPUT_FORMATS="sfz,decentsampler" ;;
  esac

  success "Extraction configured: $CONFIG_EXTRACT_PATH"
  save_wizard_state "extraction"
}

# =============================================================================
# SECTION 4: Library Integration
# =============================================================================

wizard_library_integration() {
  echo ""
  echo "4. Library Integration"
  echo "---------------------"
  echo ""

  echo "Do you have an existing sampler library folder?"
  echo "(This allows symlinking extracted programs to your library)"
  echo ""

  if confirm "Create library symlinks?" "n"; then
    read -p "Enter library path: " library_path
    CONFIG_LIBRARY_PATH="${library_path/#\~/$HOME}"

    # Validate path exists or offer to create
    if [ ! -d "$CONFIG_LIBRARY_PATH" ]; then
      if confirm "Directory doesn't exist. Create it?" "y"; then
        create_dir "$CONFIG_LIBRARY_PATH"
      fi
    fi

    # Configure symlink strategy
    echo ""
    echo "Symlink strategy:"
    echo "1) Link entire sampler directories (e.g., S5000/ -> library/S5000/)"
    echo "2) Link individual programs (e.g., each .sfz file)"
    echo ""
    read -p "Choice [1]: " symlink_strategy
    CONFIG_SYMLINK_STRATEGY=${symlink_strategy:-1}

    success "Library integration configured"
  else
    CONFIG_LIBRARY_PATH=""
    CONFIG_SYMLINK_STRATEGY=""
    info "Skipping library integration"
  fi

  save_wizard_state "library"
}

# =============================================================================
# SECTION 5: Automated Scheduling
# =============================================================================

wizard_scheduling() {
  echo ""
  echo "5. Automated Scheduling"
  echo "----------------------"
  echo ""

  if [ "$CONFIG_BACKUP_TYPE" = "none" ]; then
    info "Backup not configured. Skipping scheduling."
    return 0
  fi

  if ! confirm "Schedule automatic backups?" "n"; then
    CONFIG_SCHEDULE="manual"
    info "Backups will be run manually"
    save_wizard_state "scheduling"
    return 0
  fi

  echo ""
  echo "Backup frequency:"
  echo "1) Daily at 2 AM"
  echo "2) Daily at custom time"
  echo "3) Weekly on Sunday at 2 AM"
  echo "4) Custom cron schedule"
  echo ""
  read -p "Choice [1]: " schedule_choice
  schedule_choice=${schedule_choice:-1}

  case "$schedule_choice" in
    1)
      CONFIG_SCHEDULE_CRON="0 2 * * *"
      ;;
    2)
      read -p "Enter hour (0-23) [2]: " hour
      hour=${hour:-2}
      CONFIG_SCHEDULE_CRON="0 $hour * * *"
      ;;
    3)
      CONFIG_SCHEDULE_CRON="0 2 * * 0"
      ;;
    4)
      read -p "Enter cron expression: " custom_cron
      CONFIG_SCHEDULE_CRON="$custom_cron"
      ;;
  esac

  CONFIG_SCHEDULE="scheduled"
  success "Scheduled backups configured: $CONFIG_SCHEDULE_CRON"
  save_wizard_state "scheduling"
}

# =============================================================================
# Configuration Summary and Confirmation
# =============================================================================

show_config_summary() {
  echo ""
  section "Configuration Summary"

  echo "Samplers: $CONFIG_SAMPLERS"
  echo "Backup Type: $CONFIG_BACKUP_TYPE"

  if [ "$CONFIG_BACKUP_TYPE" != "none" ]; then
    if [[ "$CONFIG_BACKUP_TYPE" =~ remote|both ]]; then
      echo "Remote Sources:"
      printf '  - %s\n' "${CONFIG_REMOTE_SOURCES[@]}"
    fi

    if [[ "$CONFIG_BACKUP_TYPE" =~ local|both ]]; then
      echo "Local Mount Pattern: $CONFIG_LOCAL_MOUNT_PATTERN"
    fi
  fi

  echo ""
  echo "Extraction Path: $CONFIG_EXTRACT_PATH"
  echo "Output Formats: $CONFIG_OUTPUT_FORMATS"

  if [ -n "$CONFIG_LIBRARY_PATH" ]; then
    echo ""
    echo "Library Integration: Enabled"
    echo "Library Path: $CONFIG_LIBRARY_PATH"
    echo "Symlink Strategy: $([ "$CONFIG_SYMLINK_STRATEGY" = "1" ] && echo "Directory" || echo "Individual files")"
  fi

  if [ "$CONFIG_SCHEDULE" != "manual" ]; then
    echo ""
    echo "Scheduled Backups: $CONFIG_SCHEDULE_CRON"
  fi

  echo ""
  if ! confirm "Confirm and save configuration?" "y"; then
    echo ""
    if confirm "Return to wizard?" "y"; then
      run_configuration_wizard
    else
      exit 1
    fi
  fi
}

# =============================================================================
# State Management
# =============================================================================

save_wizard_state() {
  local phase=$1
  local state_dir
  state_dir=$(dirname "$STATE_FILE")

  create_dir "$state_dir"

  cat > "$STATE_FILE" <<EOF
# Wizard state - $(date)
WIZARD_PHASE="$phase"
CONFIG_SAMPLERS="$CONFIG_SAMPLERS"
CONFIG_BACKUP_TYPE="$CONFIG_BACKUP_TYPE"
CONFIG_REMOTE_SOURCES=($(printf '"%s" ' "${CONFIG_REMOTE_SOURCES[@]}"))
CONFIG_SSH_USER="$CONFIG_SSH_USER"
CONFIG_REMOTE_PATH="$CONFIG_REMOTE_PATH"
CONFIG_LOCAL_MOUNT_PATTERN="$CONFIG_LOCAL_MOUNT_PATTERN"
CONFIG_EXTRACT_PATH="$CONFIG_EXTRACT_PATH"
CONFIG_OUTPUT_FORMATS="$CONFIG_OUTPUT_FORMATS"
CONFIG_LIBRARY_PATH="$CONFIG_LIBRARY_PATH"
CONFIG_SYMLINK_STRATEGY="$CONFIG_SYMLINK_STRATEGY"
CONFIG_SCHEDULE="$CONFIG_SCHEDULE"
CONFIG_SCHEDULE_CRON="$CONFIG_SCHEDULE_CRON"
EOF
}

load_wizard_state() {
  if [ -f "$STATE_FILE" ]; then
    # shellcheck source=/dev/null
    source "$STATE_FILE"
    return 0
  fi
  return 1
}

# =============================================================================
# Main Wizard Orchestration
# =============================================================================

run_configuration_wizard() {
  section "Audio Tools Configuration Wizard"

  echo "This wizard will help you configure your sampler backup and extraction workflow."
  echo "Press Ctrl+C at any time to cancel."
  echo ""

  # Load existing config if present
  local config_file="$HOME/.audiotools/config.json"
  if [ -f "$config_file" ]; then
    if confirm "Existing configuration found. Use it?" "y"; then
      info "Using existing configuration from $config_file"
      return 0
    else
      # Backup existing config
      local backup_file="$config_file.backup.$(date +%Y%m%d-%H%M%S)"
      cp "$config_file" "$backup_file"
      info "Existing configuration backed up to $backup_file"
    fi
  fi

  # Check for resumable wizard state
  if load_wizard_state; then
    if confirm "Resume previous wizard session from phase: $WIZARD_PHASE?" "y"; then
      info "Resuming wizard..."
    else
      rm -f "$STATE_FILE"
    fi
  fi

  # Run wizard sections
  wizard_sampler_selection
  wizard_backup_sources
  wizard_extraction_config
  wizard_library_integration
  wizard_scheduling

  # Show summary and confirm
  show_config_summary

  # Clean up state file on successful completion
  rm -f "$STATE_FILE"

  success "Configuration wizard completed!"

  # Export configuration variables for use by Phase 4
  export CONFIG_SAMPLERS
  export CONFIG_BACKUP_TYPE
  export CONFIG_REMOTE_SOURCES
  export CONFIG_SSH_USER
  export CONFIG_REMOTE_PATH
  export CONFIG_LOCAL_MOUNT_PATTERN
  export CONFIG_EXTRACT_PATH
  export CONFIG_OUTPUT_FORMATS
  export CONFIG_LIBRARY_PATH
  export CONFIG_SYMLINK_STRATEGY
  export CONFIG_SCHEDULE
  export CONFIG_SCHEDULE_CRON
}

# Allow running wizard standalone for testing
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  run_configuration_wizard
fi
