#!/usr/bin/env bash
# Audio Tools Configuration Generator - Phase 4
# Generates configuration files and directory structure based on wizard responses

set -euo pipefail

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATES_DIR="$(dirname "$SCRIPT_DIR")/templates"

# Source utilities
source "$SCRIPT_DIR/utils.sh"

# =============================================================================
# Directory Structure Creation
# =============================================================================

create_directory_structure() {
  echo ""
  echo "Creating directory structure..."

  local base_dir="${AUDIOTOOLS_DIR:-$HOME/.audiotools}"

  local dirs=(
    "$base_dir"
    "$base_dir/borg-repo"
    "$base_dir/sampler-export/extracted/s3k"
    "$base_dir/sampler-export/extracted/s5k"
    "$base_dir/sampler-export/logs"
    "$base_dir/logs"
    "$base_dir/cache"
    "$base_dir/scripts"
  )

  for dir in "${dirs[@]}"; do
    if [ ! -d "$dir" ]; then
      mkdir -p "$dir"
      echo "  Created: $dir"
    else
      echo "  Exists: $dir"
    fi
  done

  success "Directory structure created"
}

# =============================================================================
# JSON Array Builder Utilities
# =============================================================================

build_json_array() {
  local items=("$@")
  local json="["

  for i in "${!items[@]}"; do
    json+="\"${items[$i]}\""
    if [ $i -lt $((${#items[@]} - 1)) ]; then
      json+=", "
    fi
  done

  json+="]"
  echo "$json"
}

build_remote_sources_json() {
  local sources=("$@")
  local json="["

  for i in "${!sources[@]}"; do
    local uri="${sources[$i]}"
    local label="${sources[$i]%%:*}"  # Extract label from uri
    label="${label##*@}"  # Remove user@ prefix

    json+="{\"uri\": \"$uri\", \"label\": \"$label\"}"
    if [ $i -lt $((${#sources[@]} - 1)) ]; then
      json+=", "
    fi
  done

  json+="]"
  echo "$json"
}

# =============================================================================
# Configuration File Generation
# =============================================================================

generate_config_json() {
  local config_file="${1:-$HOME/.audiotools/config.json}"
  local template_file="$TEMPLATES_DIR/config.template.json"

  echo ""
  echo "Generating configuration file..."

  # Validate template exists
  if [ ! -f "$template_file" ]; then
    error "Configuration template not found: $template_file"
    return 1
  fi

  # Build JSON arrays
  local samplers_json=$(build_json_array "${CONFIG_SAMPLERS[@]}")
  local formats_array=()
  IFS=',' read -ra formats_array <<< "$CONFIG_OUTPUT_FORMATS"
  local formats_json=$(build_json_array "${formats_array[@]}")
  local remote_sources_json="[]"

  if [ ${#CONFIG_REMOTE_SOURCES[@]} -gt 0 ]; then
    remote_sources_json=$(build_remote_sources_json "${CONFIG_REMOTE_SOURCES[@]}")
  fi

  # Convert boolean values
  local library_enabled="false"
  [ -n "$CONFIG_LIBRARY_PATH" ] && library_enabled="true"

  local scheduling_enabled="false"
  [ "$CONFIG_SCHEDULE" != "manual" ] && scheduling_enabled="true"

  # Expand tilde in paths
  local extract_path="${CONFIG_EXTRACT_PATH/#\~/$HOME}"
  local library_path="${CONFIG_LIBRARY_PATH/#\~/$HOME}"
  local borg_repo="$HOME/.audiotools/borg-repo"

  # Generate config from template
  sed \
    -e "s|{{CREATED_DATE}}|$(date -u +"%Y-%m-%dT%H:%M:%SZ")|g" \
    -e "s|{{PLATFORM}}|${PLATFORM}|g" \
    -e "s|{{SAMPLERS_JSON}}|${samplers_json}|g" \
    -e "s|{{BACKUP_TYPE}}|${CONFIG_BACKUP_TYPE}|g" \
    -e "s|{{REMOTE_SOURCES_JSON}}|${remote_sources_json}|g" \
    -e "s|{{LOCAL_MOUNT_PATTERN}}|${CONFIG_LOCAL_MOUNT_PATTERN}|g" \
    -e "s|{{BORG_REPO}}|${borg_repo}|g" \
    -e "s|{{EXTRACT_PATH}}|${extract_path}|g" \
    -e "s|{{OUTPUT_FORMATS_JSON}}|${formats_json}|g" \
    -e "s|{{LIBRARY_ENABLED}}|${library_enabled}|g" \
    -e "s|{{LIBRARY_PATH}}|${library_path}|g" \
    -e "s|{{SYMLINK_STRATEGY}}|${CONFIG_SYMLINK_STRATEGY}|g" \
    -e "s|{{SCHEDULING_ENABLED}}|${scheduling_enabled}|g" \
    -e "s|{{SCHEDULE_CRON}}|${CONFIG_SCHEDULE_CRON}|g" \
    "$template_file" > "$config_file"

  # Set proper permissions (600 = read/write for owner only)
  chmod 600 "$config_file"

  success "Configuration saved to $config_file"

  # Validate JSON
  if command -v jq >/dev/null 2>&1; then
    if jq empty "$config_file" 2>/dev/null; then
      success "Configuration JSON is valid"
    else
      warn "Configuration JSON validation failed (jq check)"
    fi
  fi
}

# =============================================================================
# Wrapper Scripts Generation
# =============================================================================

create_wrapper_scripts() {
  local scripts_dir="$HOME/.audiotools/scripts"
  local logs_dir="$HOME/.audiotools/logs"
  local config_file="$HOME/.audiotools/config.json"

  echo ""
  echo "Creating wrapper scripts..."

  # Get CLI binary paths
  local akai_backup_path=$(command -v akai-backup 2>/dev/null || echo "akai-backup")
  local akai_extract_path=$(command -v akai-extract 2>/dev/null || echo "akai-extract")

  # Create backup wrapper from template
  local wrapper_template="$TEMPLATES_DIR/backup-wrapper.template.sh"
  local wrapper_script="$scripts_dir/backup-and-extract.sh"

  if [ -f "$wrapper_template" ]; then
    sed \
      -e "s|{{CONFIG_FILE}}|${config_file}|g" \
      -e "s|{{LOGS_DIR}}|${logs_dir}|g" \
      -e "s|{{AKAI_BACKUP_PATH}}|${akai_backup_path}|g" \
      -e "s|{{AKAI_EXTRACT_PATH}}|${akai_extract_path}|g" \
      -e "s|{{RUN_EXTRACTION}}|true|g" \
      "$wrapper_template" > "$wrapper_script"

    chmod 755 "$wrapper_script"
    success "Created wrapper script: $wrapper_script"
  else
    warn "Wrapper template not found: $wrapper_template"
  fi

  # Create backup-only script
  local backup_script="$scripts_dir/backup.sh"
  cat > "$backup_script" <<'EOF'
#!/usr/bin/env bash
# Audio Tools Backup Script
set -euo pipefail

LOGS_DIR="$HOME/.audiotools/logs"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

echo "[$TIMESTAMP] Running backup..." | tee -a "$LOGS_DIR/backup.log"
akai-backup batch >> "$LOGS_DIR/backup.log" 2>&1
echo "[$TIMESTAMP] Backup completed" | tee -a "$LOGS_DIR/backup.log"
EOF
  chmod 755 "$backup_script"
  success "Created backup script: $backup_script"

  # Create extraction-only script
  local extract_script="$scripts_dir/extract.sh"
  cat > "$extract_script" <<'EOF'
#!/usr/bin/env bash
# Audio Tools Extraction Script
set -euo pipefail

LOGS_DIR="$HOME/.audiotools/logs"
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")

echo "[$TIMESTAMP] Running extraction..." | tee -a "$LOGS_DIR/extraction.log"
akai-extract batch >> "$LOGS_DIR/extraction.log" 2>&1
echo "[$TIMESTAMP] Extraction completed" | tee -a "$LOGS_DIR/extraction.log"
EOF
  chmod 755 "$extract_script"
  success "Created extraction script: $extract_script"
}

# =============================================================================
# Scheduling Setup
# =============================================================================

setup_scheduling() {
  if [ "$CONFIG_SCHEDULE" = "manual" ]; then
    echo ""
    echo "Automated scheduling not configured"
    return 0
  fi

  echo ""
  echo "Setting up automated scheduling..."

  case "$PLATFORM" in
    darwin*)
      setup_launchd_schedule
      ;;
    linux*)
      setup_cron_schedule
      ;;
    *)
      warn "Automated scheduling not supported on platform: $PLATFORM"
      ;;
  esac
}

setup_launchd_schedule() {
  local plist_path="$HOME/Library/LaunchAgents/com.oletizi.audiotools.backup.plist"
  local template_file="$TEMPLATES_DIR/launchd.template.plist"

  if [ ! -f "$template_file" ]; then
    warn "LaunchAgent template not found: $template_file"
    return 1
  fi

  # Parse cron expression to get hour and minute
  local cron_parts=($CONFIG_SCHEDULE_CRON)
  local minute="${cron_parts[0]}"
  local hour="${cron_parts[1]}"

  local akai_backup_path=$(command -v akai-backup 2>/dev/null || echo "akai-backup")
  local logs_dir="$HOME/.audiotools/logs"

  sed \
    -e "s|{{AKAI_BACKUP_PATH}}|${akai_backup_path}|g" \
    -e "s|{{SCHEDULE_HOUR}}|${hour}|g" \
    -e "s|{{SCHEDULE_MINUTE}}|${minute}|g" \
    -e "s|{{LOGS_DIR}}|${logs_dir}|g" \
    "$template_file" > "$plist_path"

  # Load the LaunchAgent
  if launchctl load "$plist_path" 2>/dev/null; then
    success "Scheduled daily backup via launchd (${hour}:${minute})"
  else
    warn "Failed to load LaunchAgent. Run manually: launchctl load $plist_path"
  fi
}

setup_cron_schedule() {
  local akai_backup_path=$(command -v akai-backup 2>/dev/null || echo "akai-backup")
  local logs_dir="$HOME/.audiotools/logs"
  local cron_command="$akai_backup_path batch >> $logs_dir/backup.log 2>&1"
  local cron_entry="$CONFIG_SCHEDULE_CRON $cron_command"

  # Check if entry already exists
  if crontab -l 2>/dev/null | grep -q "akai-backup batch"; then
    warn "Crontab entry already exists for akai-backup"
    return 0
  fi

  # Add to crontab
  (crontab -l 2>/dev/null || true; echo "$cron_entry") | crontab -

  success "Scheduled backup via cron: $CONFIG_SCHEDULE_CRON"
}

# =============================================================================
# Library Symlinks
# =============================================================================

create_symlinks() {
  if [ -z "$CONFIG_LIBRARY_PATH" ]; then
    echo ""
    echo "Library integration not configured"
    return 0
  fi

  echo ""
  echo "Creating library symlinks..."

  local extract_path="${CONFIG_EXTRACT_PATH/#\~/$HOME}"
  local library_path="${CONFIG_LIBRARY_PATH/#\~/$HOME}"

  # Create library directory if it doesn't exist
  if [ ! -d "$library_path" ]; then
    mkdir -p "$library_path"
    echo "  Created library directory: $library_path"
  fi

  case "$CONFIG_SYMLINK_STRATEGY" in
    directory|1)
      # Link sampler directories
      for sampler_dir in "$extract_path"/*; do
        [ ! -d "$sampler_dir" ] && continue
        local sampler_name=$(basename "$sampler_dir")
        local link_target="$library_path/$sampler_name"

        if [ -L "$link_target" ]; then
          echo "  Symlink exists: $link_target"
        elif [ -e "$link_target" ]; then
          warn "  Path exists (not symlink): $link_target"
        else
          ln -s "$sampler_dir" "$link_target"
          success "  Created: $link_target -> $sampler_dir"
        fi
      done
      ;;
    individual|2)
      warn "Individual file symlinking will be created after extraction"
      ;;
    *)
      warn "Unknown symlink strategy: $CONFIG_SYMLINK_STRATEGY"
      ;;
  esac
}

# =============================================================================
# Quick Start Guide Generation
# =============================================================================

generate_quickstart() {
  local quickstart_file="$HOME/.audiotools/QUICKSTART.md"

  echo ""
  echo "Generating quick start guide..."

  cat > "$quickstart_file" <<'EOF'
# Audio Tools Quick Start

## Common Commands

### Backup
```bash
# Run backup from all configured sources
akai-backup batch

# List backup archives
akai-backup list

# Show repository info
akai-backup info
```

### Extraction
```bash
# Extract all disk images from backups
akai-extract batch

# Extract specific disk image
akai-extract single /path/to/disk.hds
```

### One-Command Workflow
```bash
# Backup all sources and extract disk images
~/.audiotools/scripts/backup-and-extract.sh
```

## Directory Structure

```
~/.audiotools/
├── config.json                    # Your configuration
├── borg-repo/                     # Backup repository
├── sampler-export/extracted/      # Extracted programs
│   ├── s3k/                       # S3000XL programs
│   └── s5k/                       # S5000/S6000 programs
├── scripts/                       # Convenience scripts
└── logs/                          # Log files
```

## Troubleshooting

### View Logs
```bash
# Backup logs
tail -f ~/.audiotools/logs/backup.log

# Error logs
tail -f ~/.audiotools/logs/backup.error.log
```

### Configuration
Edit configuration: `~/.audiotools/config.json`

## Documentation

- Full documentation: https://github.com/oletizi/ol_dsp/tree/main/modules/audio-tools
- Report issues: https://github.com/oletizi/ol_dsp/issues
EOF

  success "Quick start guide created: $quickstart_file"
}

# =============================================================================
# Main Phase 4 Orchestration
# =============================================================================

run_configuration_generation() {
  echo ""
  echo "=========================================="
  echo "  Phase 4: Configuration Generation"
  echo "=========================================="

  # Step 1: Create directory structure
  create_directory_structure

  # Step 2: Generate configuration file
  generate_config_json "$HOME/.audiotools/config.json"

  # Step 3: Create wrapper scripts
  create_wrapper_scripts

  # Step 4: Setup scheduling
  setup_scheduling

  # Step 5: Create library symlinks
  create_symlinks

  # Step 6: Generate quick start guide
  generate_quickstart

  echo ""
  success "Phase 4: Configuration generation completed successfully"
  echo ""
  echo "Configuration files created:"
  echo "  - $HOME/.audiotools/config.json"
  echo "  - $HOME/.audiotools/scripts/backup-and-extract.sh"
  echo "  - $HOME/.audiotools/scripts/backup.sh"
  echo "  - $HOME/.audiotools/scripts/extract.sh"
  echo "  - $HOME/.audiotools/QUICKSTART.md"
}

# Allow running this script standalone for testing
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  # Load test configuration if available
  if [ -f "$SCRIPT_DIR/.test-config" ]; then
    source "$SCRIPT_DIR/.test-config"
  else
    error "No configuration loaded. Run wizard first or source test config."
    exit 1
  fi

  run_configuration_generation
fi
