#!/usr/bin/env bash
# Audio Tools Installer - Main Entry Point
# Orchestrates all installation phases

set -euo pipefail

# Script directory
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Color codes for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Output functions
success() {
  echo -e "${GREEN}✓${NC} $1"
}

error() {
  echo -e "${RED}✗${NC} $1" >&2
}

warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

# Detect platform (darwin-arm64, darwin-x64, linux-x64, linux-arm64)
detect_platform() {
  local os
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  local arch
  arch=$(uname -m)

  case "$os" in
    darwin)
      case "$arch" in
        arm64) echo "darwin-arm64" ;;
        x86_64) echo "darwin-x64" ;;
        *) error "Unsupported macOS architecture: $arch" ; exit 1 ;;
      esac
      ;;
    linux)
      case "$arch" in
        x86_64) echo "linux-x64" ;;
        aarch64|arm64) echo "linux-arm64" ;;
        *) error "Unsupported Linux architecture: $arch" ; exit 1 ;;
      esac
      ;;
    *)
      error "Unsupported OS: $os (only macOS and Linux are supported)"
      echo ""
      echo "Windows users: Please use WSL2 (Windows Subsystem for Linux)"
      exit 1
      ;;
  esac
}

# Check Node.js version (requires >= 18)
check_nodejs() {
  if ! command -v node >/dev/null 2>&1; then
    error "Node.js not found. Please install Node.js 18 or later."
    echo ""
    show_nodejs_install_instructions
    exit 1
  fi

  local node_version
  node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$node_version" -lt 18 ]; then
    error "Node.js $node_version detected. Please upgrade to Node.js 18 or later."
    echo ""
    show_nodejs_upgrade_instructions
    exit 1
  fi

  success "Node.js $(node --version) detected"
}

# Show Node.js installation instructions
show_nodejs_install_instructions() {
  echo "Install Node.js:"
  echo ""
  case "$PLATFORM" in
    darwin*)
      echo "  Option 1 - Homebrew (recommended):"
      echo "    brew install node"
      echo ""
      echo "  Option 2 - nvm:"
      echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
      echo "    nvm install 18"
      echo ""
      echo "  Option 3 - Official installer:"
      echo "    https://nodejs.org/"
      ;;
    linux*)
      echo "  Option 1 - nvm (recommended):"
      echo "    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
      echo "    nvm install 18"
      echo ""
      echo "  Option 2 - Package manager:"
      echo "    # Debian/Ubuntu"
      echo "    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
      echo "    sudo apt-get install -y nodejs"
      echo ""
      echo "    # Fedora"
      echo "    sudo dnf install nodejs"
      echo ""
      echo "    # Arch"
      echo "    sudo pacman -S nodejs npm"
      ;;
  esac
}

# Show Node.js upgrade instructions
show_nodejs_upgrade_instructions() {
  echo "Upgrade Node.js:"
  echo ""
  case "$PLATFORM" in
    darwin*)
      echo "  Using Homebrew:"
      echo "    brew upgrade node"
      echo ""
      echo "  Using nvm:"
      echo "    nvm install 18"
      echo "    nvm use 18"
      echo "    nvm alias default 18"
      ;;
    linux*)
      echo "  Using nvm:"
      echo "    nvm install 18"
      echo "    nvm use 18"
      echo "    nvm alias default 18"
      ;;
  esac
}

# Check npm version (requires >= 9)
check_npm() {
  if ! command -v npm >/dev/null 2>&1; then
    error "npm not found. Please install npm."
    exit 1
  fi

  local npm_version
  npm_version=$(npm --version | cut -d'.' -f1)
  if [ "$npm_version" -lt 9 ]; then
    warn "npm $npm_version detected. Recommend npm 9 or later."
    echo "  Upgrade: npm install -g npm@latest"
  else
    success "npm $(npm --version) detected"
  fi
}

# Check disk space (requires >= 5GB)
check_disk_space() {
  local available_gb

  case "$PLATFORM" in
    darwin*)
      available_gb=$(df -g "$HOME" | awk 'NR==2 {print $4}')
      ;;
    linux*)
      available_gb=$(df -BG "$HOME" | awk 'NR==2 {print $4}' | sed 's/G//')
      ;;
  esac

  if [ "$available_gb" -lt 5 ]; then
    error "Insufficient disk space: ${available_gb}GB available, 5GB minimum required"
    exit 1
  elif [ "$available_gb" -lt 50 ]; then
    warn "Low disk space: ${available_gb}GB available. Recommend 50GB+ for typical sampler libraries."
    read -p "Continue anyway? [y/N]: " continue_install
    [[ ! "$continue_install" =~ ^[Yy] ]] && exit 1
  else
    success "Disk space: ${available_gb}GB available"
  fi
}

# Run Phase 1: Environment Discovery
run_phase1() {
  echo ""
  echo "=========================================="
  echo "  Phase 1: Environment Discovery"
  echo "=========================================="
  echo ""

  # Platform detection
  PLATFORM=$(detect_platform)
  success "Platform: $PLATFORM"

  # Node.js check
  check_nodejs

  # npm check
  check_npm

  # Disk space check
  check_disk_space

  success "Environment checks passed"
}

# Source Phase 2 script
source_phase2() {
  if [ -f "$SCRIPT_DIR/npm-install.sh" ]; then
    # shellcheck source=./npm-install.sh
    source "$SCRIPT_DIR/npm-install.sh"
  else
    error "Phase 2 script not found: $SCRIPT_DIR/npm-install.sh"
    exit 1
  fi
}

# Cleanup on error
cleanup_on_error() {
  echo ""
  error "Installation failed. Rolling back changes..."

  # Uninstall npm packages
  echo "Uninstalling packages..."
  for package in "${PACKAGES[@]}"; do
    npm uninstall -g "$package" 2>/dev/null || true
  done

  # Remove partial installation state
  rm -f "$HOME/.audiotools/.install-state" 2>/dev/null || true

  echo ""
  echo "Rollback complete. Logs preserved for debugging."
  echo ""
  echo "Please check the error messages above and try again."
  echo "If you need help, please open an issue:"
  echo "  https://github.com/oletizi/ol_dsp/issues"
}

# Save installation state for resume capability
save_state() {
  local phase=$1
  local state_file="$HOME/.audiotools/.install-state"

  mkdir -p "$HOME/.audiotools"
  cat > "$state_file" <<EOF
# Audio Tools Installation State
INSTALL_PLATFORM="$PLATFORM"
INSTALL_PHASE="$phase"
INSTALL_TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
EOF
}

# Check for previous installation state
check_previous_state() {
  local state_file="$HOME/.audiotools/.install-state"

  if [ -f "$state_file" ]; then
    echo ""
    warn "Previous installation detected"
    echo ""
    read -p "Resume previous installation? [Y/n]: " resume
    if [[ ! "$resume" =~ ^[Nn] ]]; then
      # shellcheck source=/dev/null
      source "$state_file"
      echo "Resuming from phase: $INSTALL_PHASE"
      return 0
    else
      rm "$state_file"
    fi
  fi
  return 1
}

# Display welcome banner
show_banner() {
  echo ""
  echo "=========================================="
  echo "  Audio Tools Installer"
  echo "=========================================="
  echo ""
  echo "This installer will set up the audio-tools suite for"
  echo "Akai sampler backup and extraction."
  echo ""
  echo "Installation includes:"
  echo "  - @oletizi/sampler-backup (audiotools)"
  echo "  - @oletizi/sampler-export (audiotools)"
  echo "  - @oletizi/sampler-lib"
  echo "  - @oletizi/sampler-devices"
  echo ""
  echo "Press Ctrl+C at any time to cancel."
  echo ""
  read -p "Press Enter to continue..."
}

# Display completion message
show_completion() {
  echo ""
  echo "=========================================="
  echo "  Installation Complete!"
  echo "=========================================="
  echo ""
  echo "Audio Tools has been successfully installed."
  echo ""
  echo "Installed Packages:"
  for package in "${PACKAGES[@]}"; do
    echo "  ✓ $package"
  done
  echo ""
  echo "Available Commands:"
  for binary in "${BINARIES[@]}"; do
    echo "  ✓ $binary"
  done
  echo ""
  echo "Next Steps:"
  echo ""
  echo "  1. Run your first backup:"
  echo "     $ audiotools --help"
  echo ""
  echo "  2. Extract disk images:"
  echo "     $ audiotools --help"
  echo ""
  echo "Documentation:"
  echo "  https://github.com/oletizi/ol_dsp/tree/main/modules/audio-tools"
  echo ""
  echo "Need help? Open an issue:"
  echo "  https://github.com/oletizi/ol_dsp/issues"
  echo ""
}

# Main installation flow
main() {
  # Set up error handling
  trap cleanup_on_error ERR

  # Show welcome banner
  show_banner

  # Check for previous installation state
  check_previous_state || true

  # Phase 1: Environment Discovery
  run_phase1
  save_state "phase1_complete"

  # Source and run Phase 2: Package Installation
  source_phase2
  run_package_installation
  save_state "phase2_complete"

  # Show completion message
  show_completion

  # Clean up installation state
  rm -f "$HOME/.audiotools/.install-state"

  echo "Installation completed successfully!"
}

# Export platform for use by sourced scripts
export PLATFORM

# Run main if executed directly (not sourced)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
