#!/usr/bin/env bash
# Audio Tools Installer - Utility Functions
# Shared utility functions for logging and error handling

# Color codes for terminal output
if [ -t 1 ]; then
  # Terminal supports colors
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m' # No Color
else
  # No color support
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

# Print error message and exit
# Usage: error "message"
# Exit code: 1
error() {
  local message=$1
  echo -e "${RED}ERROR:${NC} $message" >&2
  exit 1
}

# Print warning message
# Usage: warn "message"
# Does not exit
warn() {
  local message=$1
  echo -e "${YELLOW}WARNING:${NC} $message" >&2
}

# Print info message
# Usage: info "message"
info() {
  local message=$1
  echo -e "${BLUE}INFO:${NC} $message"
}

# Print success message
# Usage: success "message"
success() {
  local message=$1
  echo -e "${GREEN}✓${NC} $message"
}

# Print section header
# Usage: section "Section Name"
section() {
  local title=$1
  echo ""
  echo "=========================================="
  echo "  $title"
  echo "=========================================="
  echo ""
}

# Check if command exists
# Usage: command_exists "command"
# Returns: 0 if exists, 1 if not
command_exists() {
  local cmd=$1
  command -v "$cmd" >/dev/null 2>&1
}

# Compare version strings
# Usage: version_ge "1.2.3" "1.2.0"
# Returns: 0 if first >= second, 1 otherwise
version_ge() {
  local version=$1
  local required=$2

  # Use printf to compare version strings
  printf '%s\n%s\n' "$required" "$version" | sort -V -C
}

# Confirm action with user
# Usage: confirm "Do something?" && do_something
# Returns: 0 if yes, 1 if no
confirm() {
  local prompt=$1
  local default=${2:-n}

  local yn
  if [ "$default" = "y" ]; then
    read -p "$prompt [Y/n]: " yn
    yn=${yn:-y}
  else
    read -p "$prompt [y/N]: " yn
    yn=${yn:-n}
  fi

  [[ "$yn" =~ ^[Yy] ]]
}

# Create directory with error handling
# Usage: create_dir "/path/to/dir"
create_dir() {
  local dir=$1

  if [ -d "$dir" ]; then
    return 0
  fi

  if ! mkdir -p "$dir" 2>/dev/null; then
    error "Failed to create directory: $dir"
  fi
}

# Check if running with sufficient permissions
# Usage: check_permissions "/path/to/check"
check_permissions() {
  local path=$1

  if [ ! -w "$path" ]; then
    error "Insufficient permissions for: $path"
  fi
}

# Export functions for use in other scripts
export -f error
export -f warn
export -f info
export -f success
export -f section
export -f command_exists
export -f version_ge
export -f confirm
export -f create_dir
export -f check_permissions
