#!/usr/bin/env bash
# Audio Tools Installer - Phase 2: Package Installation
# Handles npm package installation with permission management

set -euo pipefail

# Package list
readonly PACKAGES=(
  "@oletizi/sampler-backup"
  "@oletizi/sampler-export"
  "@oletizi/sampler-lib"
  "@oletizi/sampler-devices"
)

# Binary verification list
readonly BINARIES=(
  "akai-backup"
  "akai-extract"
)

# Install all audio-tools packages globally
install_packages() {
  echo ""
  echo "Installing audio-tools packages..."
  echo ""

  # Check npm prefix to determine installation location
  local npm_prefix
  npm_prefix=$(npm config get prefix)
  local need_sudo=false

  if [[ "$npm_prefix" == "/usr/local" ]] || [[ "$npm_prefix" == "/usr" ]]; then
    # System-wide installation requires sudo on Linux
    if [[ "$PLATFORM" == linux* ]]; then
      need_sudo=true
      echo "Note: System-wide installation requires sudo"
    fi
  fi

  # Try to install packages
  local install_failed=false
  for package in "${PACKAGES[@]}"; do
    echo "Installing $package..."
    if [ "$need_sudo" = true ]; then
      if ! sudo npm install -g "$package"; then
        install_failed=true
        break
      fi
    else
      if ! npm install -g "$package"; then
        install_failed=true
        break
      fi
    fi
  done

  if [ "$install_failed" = true ]; then
    # Try fallback to user-local installation
    echo ""
    warn "Global installation failed. Trying user-local installation..."
    handle_permissions
  else
    success "All packages installed successfully"
  fi
}

# Handle npm permissions by falling back to user-local installation
handle_permissions() {
  echo ""
  echo "Configuring npm for user-local installation..."
  echo ""

  # Get current npm prefix
  local current_prefix
  current_prefix=$(npm config get prefix)

  # Set user-local prefix if needed
  local user_prefix="$HOME/.npm-global"

  if [[ "$current_prefix" != "$user_prefix" ]]; then
    echo "Setting npm prefix to: $user_prefix"
    npm config set prefix "$user_prefix"

    # Add to PATH instructions
    echo ""
    echo "IMPORTANT: Add npm binaries to your PATH by running:"
    echo ""
    echo "  export PATH=\"$user_prefix/bin:\$PATH\""
    echo ""
    echo "Add this line to your shell profile (~/.bashrc, ~/.zshrc, etc.)"
    echo ""
    read -p "Press Enter to continue after updating your PATH..."
  fi

  # Retry installation with user-local prefix
  echo ""
  echo "Retrying installation with user-local prefix..."
  for package in "${PACKAGES[@]}"; do
    echo "Installing $package..."
    npm install -g "$package" || error "Failed to install $package"
  done

  success "All packages installed successfully (user-local)"
}

# Verify that CLI binaries are accessible in PATH
verify_binaries() {
  echo ""
  echo "Verifying CLI tools..."

  local missing=()

  for binary in "${BINARIES[@]}"; do
    if ! command -v "$binary" >/dev/null 2>&1; then
      missing+=("$binary")
    fi
  done

  if [ ${#missing[@]} -gt 0 ]; then
    error "Binaries not found in PATH: ${missing[*]}"
    echo ""
    echo "Troubleshooting:"
    echo ""
    echo "1. Check npm global bin directory:"
    echo "   npm config get prefix"
    echo ""
    echo "2. Add npm global bin directory to PATH:"
    local npm_prefix
    npm_prefix=$(npm config get prefix)
    echo "   export PATH=\"$npm_prefix/bin:\$PATH\""
    echo ""
    echo "3. Add this to your shell profile (~/.bashrc, ~/.zshrc, etc.)"
    echo ""
    echo "4. Reload your shell:"
    echo "   source ~/.bashrc  # or ~/.zshrc"
    echo ""

    # Offer to add to PATH automatically
    echo "Would you like to add the npm bin directory to your PATH now?"
    read -p "[y/N]: " add_to_path
    if [[ "$add_to_path" =~ ^[Yy] ]]; then
      add_npm_to_path "$npm_prefix"
    else
      exit 1
    fi
  fi

  success "CLI tools available: ${BINARIES[*]}"
}

# Add npm bin directory to PATH in user's shell profile
add_npm_to_path() {
  local npm_prefix=$1
  local shell_profile

  # Detect shell profile
  if [ -n "${ZSH_VERSION:-}" ]; then
    shell_profile="$HOME/.zshrc"
  elif [ -n "${BASH_VERSION:-}" ]; then
    if [ -f "$HOME/.bashrc" ]; then
      shell_profile="$HOME/.bashrc"
    else
      shell_profile="$HOME/.bash_profile"
    fi
  else
    shell_profile="$HOME/.profile"
  fi

  echo ""
  echo "Adding npm bin directory to $shell_profile..."

  # Check if already present
  if grep -q "npm.*global.*bin" "$shell_profile" 2>/dev/null; then
    echo "PATH already contains npm global bin directory"
  else
    # Add to profile
    echo "" >> "$shell_profile"
    echo "# Added by audio-tools installer" >> "$shell_profile"
    echo "export PATH=\"$npm_prefix/bin:\$PATH\"" >> "$shell_profile"

    success "Updated $shell_profile"
    echo ""
    echo "Please reload your shell or run:"
    echo "  source $shell_profile"
  fi
}

# Verify package installation by checking package.json files
verify_package_installation() {
  echo ""
  echo "Verifying package installation..."

  local npm_prefix
  npm_prefix=$(npm config get prefix)

  local installed_count=0
  for package in "${PACKAGES[@]}"; do
    # Extract package name without scope
    local pkg_name="${package##*/}"

    # Check if package is installed
    if npm list -g --depth=0 "$package" >/dev/null 2>&1; then
      echo "  ✓ $package"
      ((installed_count++))
    else
      echo "  ✗ $package"
    fi
  done

  if [ "$installed_count" -eq ${#PACKAGES[@]} ]; then
    success "All ${#PACKAGES[@]} packages verified"
  else
    error "Only $installed_count of ${#PACKAGES[@]} packages installed"
    exit 1
  fi
}

# Show installation summary
show_installation_summary() {
  echo ""
  echo "=========================================="
  echo "  Package Installation Summary"
  echo "=========================================="
  echo ""
  echo "Installed packages:"
  for package in "${PACKAGES[@]}"; do
    echo "  ✓ $package"
  done
  echo ""
  echo "Available commands:"
  for binary in "${BINARIES[@]}"; do
    local binary_path
    binary_path=$(command -v "$binary" 2>/dev/null || echo "not found")
    echo "  ✓ $binary → $binary_path"
  done
  echo ""
}

# Main installation flow
run_package_installation() {
  echo ""
  echo "=========================================="
  echo "  Phase 2: Package Installation"
  echo "=========================================="
  echo ""

  # Install packages
  install_packages

  # Verify package installation
  verify_package_installation

  # Verify binaries are in PATH
  verify_binaries

  # Show summary
  show_installation_summary
}
