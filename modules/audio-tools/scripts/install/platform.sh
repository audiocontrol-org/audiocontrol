#!/usr/bin/env bash
# Audio Tools Installer - Platform Detection
# Detects platform, architecture, and package manager

# Source utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"

# Detect platform and architecture
# Returns: darwin-arm64, darwin-x64, linux-x64, linux-arm64
# Exit code: 0 on success, 1 on unsupported platform
detect_platform() {
  local os=$(uname -s | tr '[:upper:]' '[:lower:]')
  local arch=$(uname -m)

  case "$os" in
    darwin)
      case "$arch" in
        arm64)
          echo "darwin-arm64"
          return 0
          ;;
        x86_64)
          echo "darwin-x64"
          return 0
          ;;
        *)
          error "Unsupported macOS architecture: $arch"
          ;;
      esac
      ;;
    linux)
      case "$arch" in
        x86_64)
          echo "linux-x64"
          return 0
          ;;
        aarch64|arm64)
          echo "linux-arm64"
          return 0
          ;;
        *)
          error "Unsupported Linux architecture: $arch"
          ;;
      esac
      ;;
    *)
      echo ""
      echo "Unsupported operating system: $os"
      echo ""
      echo "Audio Tools requires macOS or Linux."
      echo ""
      echo "For Windows users:"
      echo "  Install WSL2 (Windows Subsystem for Linux)"
      echo "  https://docs.microsoft.com/en-us/windows/wsl/install"
      echo ""
      exit 1
      ;;
  esac
}

# Detect package manager on Linux systems
# Returns: brew, apt, dnf, pacman, yum, or unknown
# Exit code: 0 always (unknown is valid)
get_package_manager() {
  # Check for Homebrew (macOS and Linux)
  if command_exists brew; then
    echo "brew"
    return 0
  fi

  # Linux package managers
  if command_exists apt; then
    echo "apt"
    return 0
  elif command_exists dnf; then
    echo "dnf"
    return 0
  elif command_exists pacman; then
    echo "pacman"
    return 0
  elif command_exists yum; then
    echo "yum"
    return 0
  elif command_exists zypper; then
    echo "zypper"
    return 0
  else
    echo "unknown"
    return 0
  fi
}

# Validate platform is supported
# Usage: validate_platform "darwin-arm64"
# Exit code: 0 if supported, 1 if not
validate_platform() {
  local platform=$1

  case "$platform" in
    darwin-arm64|darwin-x64|linux-x64|linux-arm64)
      return 0
      ;;
    *)
      error "Invalid platform: $platform"
      ;;
  esac
}

# Get OS name for display
# Usage: get_os_name "darwin-arm64"
# Returns: "macOS (ARM64)", "Linux (x64)", etc.
get_os_name() {
  local platform=$1

  case "$platform" in
    darwin-arm64)
      echo "macOS (ARM64)"
      ;;
    darwin-x64)
      echo "macOS (Intel)"
      ;;
    linux-x64)
      echo "Linux (x64)"
      ;;
    linux-arm64)
      echo "Linux (ARM64)"
      ;;
    *)
      echo "Unknown"
      ;;
  esac
}

# Check if running on macOS
# Usage: is_macos && do_macos_thing
# Exit code: 0 if macOS, 1 if not
is_macos() {
  [[ "$(uname -s)" == "Darwin" ]]
}

# Check if running on Linux
# Usage: is_linux && do_linux_thing
# Exit code: 0 if Linux, 1 if not
is_linux() {
  [[ "$(uname -s)" == "Linux" ]]
}

# Get CPU architecture
# Returns: arm64, x86_64
get_arch() {
  uname -m
}

# Detect Linux distribution
# Returns: ubuntu, debian, fedora, arch, centos, etc.
# Only works on Linux systems
get_linux_distro() {
  if ! is_linux; then
    echo "unknown"
    return 1
  fi

  # Try reading /etc/os-release (standard)
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    echo "$ID" | tr '[:upper:]' '[:lower:]'
    return 0
  fi

  # Fallback: check for specific release files
  if [ -f /etc/debian_version ]; then
    echo "debian"
  elif [ -f /etc/redhat-release ]; then
    echo "redhat"
  elif [ -f /etc/arch-release ]; then
    echo "arch"
  else
    echo "unknown"
  fi
}

# Show installation instructions for package manager
# Usage: show_package_manager_info
show_package_manager_info() {
  local pkg_manager=$(get_package_manager)
  local platform=$(detect_platform)

  echo ""
  echo "Package Manager: $pkg_manager"

  if [ "$pkg_manager" = "unknown" ]; then
    warn "Could not detect package manager"
    echo ""
    echo "You may need to install packages manually."
    echo ""
  fi
}

# Export functions
export -f detect_platform
export -f get_package_manager
export -f validate_platform
export -f get_os_name
export -f is_macos
export -f is_linux
export -f get_arch
export -f get_linux_distro
export -f show_package_manager_info
