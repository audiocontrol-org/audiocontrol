# Audio Tools Installer Scripts - Phase 1: Environment Discovery

**Status:** ✅ **COMPLETED** - 2025-10-07

This directory contains the shell scripts for Phase 1 of the audio-tools one-line installer implementation.

## Files

### Core Scripts

1. **`utils.sh`** (136 lines) - Shared utility functions
   - Color-coded terminal output (error, warn, info, success)
   - Command existence checking (`command_exists`)
   - Version comparison utilities (`version_ge`)
   - User confirmation prompts (`confirm`)
   - Directory creation with error handling (`create_dir`)
   - All functions exported for use in other scripts

2. **`platform.sh`** (209 lines) - Platform detection
   - `detect_platform()` - Detects: darwin-arm64, darwin-x64, linux-x64, linux-arm64
   - `get_package_manager()` - Detects: brew, apt, dnf, pacman, yum, zypper
   - `validate_platform()` - Validates platform string
   - `get_os_name()` - Returns human-readable OS name
   - `is_macos()`, `is_linux()` - Platform checks
   - `get_linux_distro()` - Linux distribution detection
   - Unsupported platforms provide WSL2 guidance for Windows users

3. **`checks.sh`** (273 lines) - Dependency validation
   - `check_node()` - Validates Node.js >= 18 with installation instructions
   - `check_npm()` - Validates npm availability
   - `check_disk_space()` - Ensures >= 5GB available (recommends 50GB+)
   - `check_rsync()` - Validates rsync (optional, with warnings)
   - `check_ssh()` - Validates ssh (optional, with warnings)
   - `check_all_dependencies()` - Comprehensive validation function
   - `show_nodejs_install_instructions()` - Platform-specific Node.js installation guide

### Test Scripts

4. **`test-phase1.sh`** (70 lines) - Test harness
   - Tests platform detection
   - Tests package manager detection
   - Tests utility functions
   - Tests command checks
   - Runs comprehensive dependency validation

## Usage

### Source the scripts

```bash
#!/usr/bin/env bash

# Source utilities and checks
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/utils.sh"
source "$SCRIPT_DIR/platform.sh"
source "$SCRIPT_DIR/checks.sh"

# Use the functions
PLATFORM=$(detect_platform)
info "Detected platform: $PLATFORM"

check_all_dependencies
success "All checks passed!"
```

### Run the test suite

```bash
cd scripts/install
./test-phase1.sh
```

## Testing Results

All Phase 1 functionality has been verified on macOS ARM64:

- Platform detection: ✅ darwin-arm64
- Package manager: ✅ brew
- Node.js: ✅ v22.19.0 (exceeds v18 requirement)
- npm: ✅ 10.9.3
- Disk space: ✅ 147GB available
- rsync: ✅ 3.4.1
- SSH: ✅ OpenSSH_9.9p2

Example output:
```
==========================================
  Phase 1: Environment Discovery Tests
==========================================

Test 1: Platform Detection
--------------------------
Detected platform: darwin-arm64
OS name: macOS (ARM64)
Architecture: arm64

...

✓ All dependency checks passed

==========================================
  All Tests Completed
==========================================
```

## Design Decisions

### POSIX Compatibility

All scripts strive for POSIX compatibility where possible:
- Use `#!/usr/bin/env bash` shebang
- Avoid bash-specific features unless necessary
- Tested on bash 3.2+ (macOS default) and bash 5.x

### Error Handling

- Functions use consistent return codes (0 = success, 1 = failure)
- Critical errors call `error()` which exits with code 1
- Warnings use `warn()` which continues execution
- All error messages are actionable and include guidance

### Function Export

All public functions are exported to make them available to scripts that source these files:

```bash
export -f error warn info success
export -f detect_platform get_package_manager
export -f check_node check_npm check_disk_space
```

## Success Criteria Met

- ✅ All platform checks pass
- ✅ Node.js 18+ detected
- ✅ Optional dependencies (rsync, ssh) handled gracefully
- ✅ Sufficient disk space verified
- ✅ Clear, actionable error messages
- ✅ Functions are testable and modular
- ✅ POSIX-compatible bash code
- ✅ All functions exported for reuse

## Known Limitations

1. **BorgBackup detection not yet implemented** - Deferred to Phase 2 (will be added to checks.sh)
2. **Linux platform testing pending** - Only macOS ARM64 tested so far
3. **Installation instructions displayed but not automated** - Phase 2 will add automated installation

## Next Steps

Phase 2 (Package Installation) can now proceed with:
- Reliable platform detection
- Validated critical dependencies
- Error handling framework in place
- Utility functions available for reuse

The next phase will add:
- `npm-install.sh` - npm package installation logic
- `wizard.sh` - Interactive configuration wizard
- `config.sh` - Configuration file generation
- `complete.sh` - Completion messages and next steps

## References

- **Workplan**: `../../docs/1.0/installer/implementation/workplan.md`
- **Phase 1 Specification**: Lines 32-201 in workplan.md
