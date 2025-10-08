#!/usr/bin/env bash
# Audio Tools Test Runner - Phase 5
# Validates configuration with non-destructive dry-run operations

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source utilities
source "$SCRIPT_DIR/utils.sh"

# =============================================================================
# BorgBackup Repository Initialization
# =============================================================================

initialize_borg_repo() {
  local repo_path="${AUDIOTOOLS_DIR:-$HOME/.audiotools}/borg-repo"

  if [ "${CONFIG_BACKUP_TYPE:-none}" = "none" ] || [ "${SKIP_BACKUP:-false}" = "true" ]; then
    info "Backup not configured. Skipping repository initialization."
    return 0
  fi

  echo ""
  echo "Initializing BorgBackup repository..."

  # Check if repository already initialized
  if [ -d "$repo_path" ] && [ -f "$repo_path/README" ]; then
    success "BorgBackup repository already initialized"
    return 0
  fi

  # Initialize repository without encryption for simplicity
  # Users can enable encryption later if needed
  if ! command_exists borg; then
    warn "BorgBackup not available. Skipping repository initialization."
    return 0
  fi

  borg init --encryption=none "$repo_path" 2>/dev/null || {
    warn "Repository initialization failed (may already exist)"
    return 0
  }

  success "BorgBackup repository initialized at $repo_path"
}

# =============================================================================
# SSH Connection Testing
# =============================================================================

test_ssh_connections() {
  if [ "${CONFIG_BACKUP_TYPE:-none}" != "remote" ] && [ "${CONFIG_BACKUP_TYPE:-none}" != "both" ]; then
    return 0
  fi

  if [ -z "${CONFIG_REMOTE_SOURCES:-}" ]; then
    return 0
  fi

  echo ""
  echo "Testing SSH connections..."

  # Convert space-separated sources to array
  IFS=' ' read -ra sources <<< "${CONFIG_REMOTE_SOURCES}"

  local failed=0
  for source in "${sources[@]}"; do
    # Extract user@host and path
    local user_host="${source%%:*}"
    local remote_path="${source#*:}"

    echo ""
    echo "Testing: $source"

    # Test SSH connection with timeout
    if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$user_host" "test -d '$remote_path'" 2>/dev/null; then
      warn "Cannot access remote path: $source"
      echo "  Troubleshooting:"
      echo "    1. Ensure SSH key authentication is set up"
      echo "    2. Verify remote path exists: ssh $user_host ls -la '$remote_path'"
      echo "    3. Check network connectivity to $user_host"
      failed=$((failed + 1))
      continue
    fi

    # Count disk images
    local disk_count
    disk_count=$(ssh "$user_host" "find '$remote_path' -maxdepth 3 \( -name '*.hds' -o -name '*.img' -o -name '*.iso' \) 2>/dev/null | wc -l" | tr -d ' ')

    if [ "$disk_count" -gt 0 ]; then
      success "Found $disk_count disk image(s) in $source"
    else
      warn "No disk images found in $source (this may be normal)"
    fi
  done

  if [ $failed -gt 0 ]; then
    warn "$failed SSH connection(s) failed. Please verify configuration."
    if ! confirm "Continue anyway?"; then
      return 1
    fi
  fi

  return 0
}

# =============================================================================
# Local Media Testing
# =============================================================================

test_local_media() {
  if [ "${CONFIG_BACKUP_TYPE:-none}" != "local" ] && [ "${CONFIG_BACKUP_TYPE:-none}" != "both" ]; then
    return 0
  fi

  echo ""
  echo "Testing local media configuration..."

  local mount_pattern="${CONFIG_LOCAL_MOUNT_PATTERN:-}"
  if [ -z "$mount_pattern" ]; then
    warn "Local mount pattern not configured"
    return 0
  fi

  echo "Mount pattern: $mount_pattern"

  # Detect platform-specific mount points
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
      # List /media/$USER and /mnt
      for base in "/media/$USER" /mnt; do
        if [ -d "$base" ]; then
          for vol in "$base"/*; do
            [ -d "$vol" ] && found_media+=("$vol")
          done
        fi
      done
      ;;
  esac

  if [ ${#found_media[@]} -gt 0 ]; then
    success "Found ${#found_media[@]} mounted volume(s)"
    echo ""
    echo "Currently mounted volumes:"
    printf '  %s\n' "${found_media[@]}"
  else
    info "No removable media currently mounted (this is normal)"
    echo "  Local backup will work when media is mounted"
  fi

  return 0
}

# =============================================================================
# Backup Dry Run
# =============================================================================

test_backup_dry_run() {
  if [ "${CONFIG_BACKUP_TYPE:-none}" = "none" ] || [ "${SKIP_BACKUP:-false}" = "true" ]; then
    info "Backup not configured. Skipping dry run test."
    return 0
  fi

  if ! command_exists borg; then
    warn "BorgBackup not available. Skipping dry run test."
    return 0
  fi

  echo ""
  echo "Testing backup configuration (dry run)..."
  echo ""

  if ! confirm "Run backup dry run test? (no data transferred)" "y"; then
    info "Skipping dry run test"
    return 0
  fi

  local repo_path="${AUDIOTOOLS_DIR:-$HOME/.audiotools}/borg-repo"
  local test_archive="test-$(date +%Y%m%d-%H%M%S)"

  case "${CONFIG_BACKUP_TYPE}" in
    remote|both)
      if [ -n "${CONFIG_REMOTE_SOURCES:-}" ]; then
        IFS=' ' read -ra sources <<< "${CONFIG_REMOTE_SOURCES}"
        local first_source="${sources[0]}"

        echo "Testing with source: $first_source"
        echo "Archive name: $test_archive"
        echo ""
        info "This is a DRY RUN - no data will be transferred"
        echo ""

        # Show what would be backed up (limited output)
        local user_host="${first_source%%:*}"
        local remote_path="${first_source#*:}"

        echo "Scanning remote directory..."
        local file_count
        file_count=$(ssh "$user_host" "find '$remote_path' -maxdepth 3 -type f 2>/dev/null | wc -l" | tr -d ' ')

        success "Dry run scan complete: $file_count file(s) would be backed up"
      fi
      ;;

    local)
      info "Local media backup configured - mount media to test"
      ;;
  esac

  success "Backup dry run test completed"
  return 0
}

# =============================================================================
# Extraction Path Validation
# =============================================================================

test_extraction_paths() {
  echo ""
  echo "Validating extraction paths..."

  local extract_path="${CONFIG_EXTRACT_PATH:-$HOME/.audiotools/sampler-export/extracted}"

  # Check if path exists
  if [ ! -d "$extract_path" ]; then
    warn "Extraction path does not exist: $extract_path"
    if confirm "Create extraction directory?" "y"; then
      mkdir -p "$extract_path"
      success "Created extraction directory"
    else
      return 1
    fi
  fi

  # Test write permissions
  local test_file="$extract_path/.write-test-$$"
  if touch "$test_file" 2>/dev/null; then
    rm -f "$test_file"
    success "Extraction path is writable: $extract_path"
  else
    error "Cannot write to extraction path: $extract_path"
    return 1
  fi

  # Check disk space
  local available_gb
  case "${PLATFORM:-darwin-arm64}" in
    darwin*)
      available_gb=$(df -g "$extract_path" | awk 'NR==2 {print $4}')
      ;;
    linux*)
      available_gb=$(df -BG "$extract_path" | awk 'NR==2 {print $4}' | sed 's/G//')
      ;;
  esac

  if [ "$available_gb" -lt 10 ]; then
    warn "Low disk space at extraction path: ${available_gb}GB available"
    echo "  Recommend 50GB+ for typical sample libraries"
  else
    success "Disk space available: ${available_gb}GB"
  fi

  return 0
}

# =============================================================================
# Configuration Validation
# =============================================================================

validate_configuration() {
  local config_file="${AUDIOTOOLS_DIR:-$HOME/.audiotools}/config.json"

  echo ""
  echo "Validating configuration..."

  # Check if config file exists
  if [ ! -f "$config_file" ]; then
    error "Configuration file not found: $config_file"
    return 1
  fi

  # Validate JSON syntax if jq available
  if command_exists jq; then
    if jq empty "$config_file" 2>/dev/null; then
      success "Configuration file is valid JSON"
    else
      error "Configuration file has invalid JSON syntax"
      return 1
    fi

    # Validate required fields
    local version
    version=$(jq -r '.version // empty' "$config_file")
    if [ -z "$version" ]; then
      warn "Configuration missing version field"
    else
      success "Configuration version: $version"
    fi
  else
    # Basic validation without jq
    if grep -q '"version"' "$config_file" && grep -q '"platform"' "$config_file"; then
      success "Configuration file appears valid"
    else
      warn "Configuration file may be incomplete (install jq for full validation)"
    fi
  fi

  return 0
}

# =============================================================================
# Main Test Phase Runner
# =============================================================================

run_test_phase() {
  section "Phase 5: Test Run"

  echo "Running non-destructive validation tests..."
  echo "This will verify your configuration without transferring data."
  echo ""

  local failed=0

  # Initialize BorgBackup repository
  initialize_borg_repo || failed=$((failed + 1))

  # Test SSH connections
  test_ssh_connections || failed=$((failed + 1))

  # Test local media detection
  test_local_media || failed=$((failed + 1))

  # Validate extraction paths
  test_extraction_paths || failed=$((failed + 1))

  # Validate configuration file
  validate_configuration || failed=$((failed + 1))

  # Run backup dry run
  test_backup_dry_run || failed=$((failed + 1))

  echo ""
  if [ $failed -eq 0 ]; then
    success "All validation tests passed"
    return 0
  else
    warn "$failed validation test(s) had warnings or failures"
    echo ""
    if confirm "Continue with installation despite warnings?"; then
      return 0
    else
      error "Installation aborted by user"
      return 1
    fi
  fi
}

# =============================================================================
# Direct Execution Support
# =============================================================================

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  # Being run directly, not sourced
  run_test_phase
fi
