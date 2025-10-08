#!/usr/bin/env bash
# Audio Tools Installer - Dependency Checks
# Validates system dependencies and requirements

# Source utilities and platform detection
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"
source "$SCRIPT_DIR/platform.sh"

# Check Node.js installation and version
# Requires: Node.js >= 18
# Exit code: 0 if valid, 1 if not found or too old
check_node() {
  if ! command_exists node; then
    echo ""
    error "Node.js not found. Please install Node.js 18 or later."
  fi

  # Get major version number
  local node_version=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)

  if [ -z "$node_version" ]; then
    error "Could not determine Node.js version"
  fi

  # Check if version is numeric
  if ! [[ "$node_version" =~ ^[0-9]+$ ]]; then
    error "Invalid Node.js version format: $node_version"
  fi

  # Require Node.js 18 or later
  if [ "$node_version" -lt 18 ]; then
    echo ""
    echo "Node.js $node_version detected, but version 18 or later is required."
    echo ""
    show_nodejs_install_instructions
    exit 1
  fi

  success "Node.js $(node --version) detected"
  return 0
}

# Show Node.js installation instructions
show_nodejs_install_instructions() {
  local platform=$(detect_platform)

  echo "Install Node.js 18 or later:"
  echo ""

  case "$platform" in
    darwin*)
      echo "Option 1: Using Homebrew (recommended)"
      echo "  brew install node"
      echo ""
      echo "Option 2: Using nvm"
      echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/latest/install.sh | bash"
      echo "  nvm install 18"
      echo ""
      echo "Option 3: Official installer"
      echo "  https://nodejs.org/en/download/"
      ;;
    linux*)
      echo "Option 1: Using nvm (recommended)"
      echo "  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/latest/install.sh | bash"
      echo "  nvm install 18"
      echo ""
      echo "Option 2: Using package manager"
      local pkg_manager=$(get_package_manager)
      case "$pkg_manager" in
        apt)
          echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
          echo "  sudo apt-get install -y nodejs"
          ;;
        dnf)
          echo "  sudo dnf install nodejs"
          ;;
        pacman)
          echo "  sudo pacman -S nodejs npm"
          ;;
        *)
          echo "  See: https://nodejs.org/en/download/package-manager/"
          ;;
      esac
      echo ""
      echo "Option 3: Official binary"
      echo "  https://nodejs.org/en/download/"
      ;;
  esac
  echo ""
}

# Check npm availability
# Exit code: 0 if found, 1 if not
check_npm() {
  if ! command_exists npm; then
    error "npm not found. npm is required and should be installed with Node.js."
  fi

  local npm_version=$(npm --version 2>/dev/null)

  if [ -z "$npm_version" ]; then
    error "Could not determine npm version"
  fi

  success "npm $npm_version detected"
  return 0
}

# Check available disk space
# Requires: >= 5GB free space (recommended: 50GB+)
# Exit code: 0 if sufficient, 1 if not
check_disk_space() {
  local target_dir="${1:-$HOME}"
  local min_space_gb=5
  local recommended_gb=50
  local available_gb

  # Platform-specific disk space check
  if is_macos; then
    # macOS: df -g returns gigabytes
    available_gb=$(df -g "$target_dir" 2>/dev/null | awk 'NR==2 {print $4}')
  else
    # Linux: df -BG returns gigabytes with 'G' suffix
    available_gb=$(df -BG "$target_dir" 2>/dev/null | awk 'NR==2 {print $4}' | sed 's/G//')
  fi

  # Handle case where df fails
  if [ -z "$available_gb" ]; then
    warn "Could not determine available disk space"
    return 0
  fi

  # Check minimum space requirement
  if [ "$available_gb" -lt "$min_space_gb" ]; then
    echo ""
    echo "Insufficient disk space: ${available_gb}GB available"
    echo "Minimum required: ${min_space_gb}GB"
    echo ""
    echo "Please free up disk space before continuing."
    exit 1
  fi

  # Warn if below recommended space
  if [ "$available_gb" -lt "$recommended_gb" ]; then
    warn "Low disk space: ${available_gb}GB available (recommended: ${recommended_gb}GB+)"
    echo ""
    echo "You may run out of space with large sampler libraries."
    echo ""

    if ! confirm "Continue anyway?"; then
      exit 1
    fi
  else
    success "Disk space: ${available_gb}GB available"
  fi

  return 0
}

# Check rsync availability
# rsync should be pre-installed on macOS and most Linux distributions
# Exit code: 0 if found, 1 if not (but continues with warning)
check_rsync() {
  if ! command_exists rsync; then
    warn "rsync not found (usually pre-installed)"
    echo ""
    echo "rsync may be required for some backup operations."
    echo ""

    local pkg_manager=$(get_package_manager)
    case "$pkg_manager" in
      brew)
        echo "Install with: brew install rsync"
        ;;
      apt)
        echo "Install with: sudo apt install rsync"
        ;;
      dnf)
        echo "Install with: sudo dnf install rsync"
        ;;
      pacman)
        echo "Install with: sudo pacman -S rsync"
        ;;
      *)
        echo "Install rsync using your package manager"
        ;;
    esac
    echo ""

    if ! confirm "Continue without rsync?"; then
      exit 1
    fi

    return 1
  fi

  local rsync_version=$(rsync --version 2>/dev/null | head -n1 | awk '{print $3}')
  success "rsync $rsync_version detected"
  return 0
}

# Check ssh availability
# ssh should be pre-installed on macOS and most Linux distributions
# Required for remote PiSCSI backup
# Exit code: 0 if found, 1 if not (but continues with warning)
check_ssh() {
  if ! command_exists ssh; then
    warn "ssh not found (usually pre-installed)"
    echo ""
    echo "SSH is required for remote PiSCSI backup."
    echo ""

    local pkg_manager=$(get_package_manager)
    case "$pkg_manager" in
      brew)
        echo "Install with: brew install openssh"
        ;;
      apt)
        echo "Install with: sudo apt install openssh-client"
        ;;
      dnf)
        echo "Install with: sudo dnf install openssh-clients"
        ;;
      pacman)
        echo "Install with: sudo pacman -S openssh"
        ;;
      *)
        echo "Install openssh-client using your package manager"
        ;;
    esac
    echo ""

    if ! confirm "Continue without SSH?"; then
      exit 1
    fi

    return 1
  fi

  local ssh_version=$(ssh -V 2>&1 | awk '{print $1}')
  success "$ssh_version detected"
  return 0
}

# Run all system checks
# Exit code: 0 if all critical checks pass, 1 otherwise
check_all_dependencies() {
  info "Checking system dependencies..."
  echo ""

  # Critical checks (must pass)
  check_node || exit 1
  check_npm || exit 1
  check_disk_space || exit 1

  # Optional checks (warnings only)
  check_rsync || true
  check_ssh || true

  echo ""
  success "All dependency checks passed"
  return 0
}

# Export functions
export -f check_node
export -f check_npm
export -f check_disk_space
export -f check_rsync
export -f check_ssh
export -f show_nodejs_install_instructions
export -f check_all_dependencies
