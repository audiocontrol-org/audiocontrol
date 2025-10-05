# Task 6.3: Required Documentation Updates

Based on cross-platform testing results, these documentation updates are recommended before v1.0.0 publication.

---

## Priority 1: REQUIRED for v1.0.0

### 1. sampler-export/README.md - Platform Support Section

Add this section after "Installation":

```markdown
## Platform Support

### Fully Supported (Zero-Configuration)

- **macOS Apple Silicon (M1/M2/M3)**: darwin-arm64
  - Bundled mtools binary included
  - No additional installation required
  - Tested and verified

### Partial Support (Requires mtools Installation)

The following platforms require manual mtools installation:

- **macOS Intel**: darwin-x64
  - Install: `brew install mtools`

- **Linux 64-bit**: linux-x64 (Ubuntu, Debian, RHEL, CentOS, etc.)
  - Install: `sudo apt install mtools` (Debian/Ubuntu)
  - Install: `sudo yum install mtools` (RHEL/CentOS)

- **Linux ARM64**: linux-arm64 (Raspberry Pi, ARM servers)
  - Install: `sudo apt install mtools` (Raspberry Pi OS, Ubuntu)

- **Windows 64-bit**: win32-x64
  - Recommended: Use WSL2 (Windows Subsystem for Linux)
  - Alternative: Install mtools from https://www.gnu.org/software/mtools/

### Binary Fallback Behavior

If a bundled binary is not available for your platform:
1. The tool automatically tries to use system-installed `mcopy`
2. If neither is found, you'll see clear installation instructions
3. Native Akai disk extraction works without mtools (DOS/FAT disks require mtools)

### Roadmap

- **v1.1.0** (Q1 2026): Add darwin-x64 and linux-x64 binaries
- **v1.2.0** (Q2 2026): Add linux-arm64 binary
```

### 2. sampler-export/README.md - Update Installation Section

Add platform-specific notes:

```markdown
## Installation

```bash
npm install -g @oletizi/sampler-export
```

**macOS Apple Silicon users**: Zero-configuration! Everything works out of the box.

**Other platforms**: You may need to install mtools separately. See [Platform Support](#platform-support) section below.
```

### 3. Root README.md - Update Package Descriptions

Update the sampler-export description:

```markdown
- **@oletizi/sampler-export**: Disk extraction and format conversion
  - Supports Akai native and DOS/FAT32 disk images
  - Converts programs to SFZ and DecentSampler formats
  - Zero-configuration installation on macOS Apple Silicon
  - Cross-platform with mtools fallback
```

---

## Priority 2: RECOMMENDED for v1.0.0

### 4. Create PLATFORM-SUPPORT.md (Root Level)

Comprehensive platform support documentation:

```markdown
# Platform Support

This document details platform support across all audio-tools packages.

## Overview

| Platform      | sampler-export | sampler-backup | sampler-devices |
|---------------|----------------|----------------|-----------------|
| darwin-arm64  | ✅ Full        | ✅ Full        | ✅ Full         |
| darwin-x64    | ⚠️ Partial*    | ✅ Full        | ✅ Full         |
| linux-x64     | ⚠️ Partial*    | ✅ Full        | ✅ Full         |
| linux-arm64   | ⚠️ Partial*    | ✅ Full        | ✅ Full         |
| win32-x64     | ⚠️ Partial*    | ❌ Untested    | ✅ Full         |

*Partial support: Requires system mtools installation

## sampler-export Platform Details

### Bundled mtools Binaries

The sampler-export package bundles mtools (`mcopy`) for DOS/FAT disk extraction:

- **darwin-arm64**: ✅ Bundled (GNU mtools 4.0.49, 194KB)
- **darwin-x64**: ❌ Not bundled (planned for v1.1.0)
- **linux-x64**: ❌ Not bundled (planned for v1.1.0)
- **linux-arm64**: ❌ Not bundled (planned for v1.2.0)
- **win32-x64**: ❌ Not bundled (WSL2 recommended)

### Installing mtools

#### macOS (Intel)
```bash
brew install mtools
```

#### Linux (Debian/Ubuntu)
```bash
sudo apt update
sudo apt install mtools
```

#### Linux (RHEL/CentOS/Fedora)
```bash
sudo yum install mtools
# or
sudo dnf install mtools
```

#### Windows
**Recommended**: Use WSL2 (Windows Subsystem for Linux)
```powershell
wsl --install
# Then inside WSL:
sudo apt install mtools
```

**Alternative**: Install mtools from https://www.gnu.org/software/mtools/

### Fallback Behavior

sampler-export uses a 3-tier fallback system:

1. **Bundled binary**: Checked first (`bin/mtools/{platform}/mcopy`)
2. **System binary**: Falls back to system-installed mtools
3. **Error with instructions**: Clear installation guidance if neither found

### Testing Status

- ✅ **darwin-arm64**: Fully tested, binary verified
- ⚠️ **darwin-x64**: Code tested, binary path tested, awaiting binary
- ⚠️ **linux-x64**: Code tested, binary path tested, awaiting binary
- ⚠️ **linux-arm64**: Code tested, binary path tested, awaiting binary
- ⚠️ **win32-x64**: Code tested, binary path tested, platform detection verified

## sampler-backup Platform Details

Depends on system-installed `rsnapshot`:

- **macOS**: `brew install rsnapshot`
- **Linux**: `sudo apt install rsnapshot` or `sudo yum install rsnapshot`
- **Windows**: Not supported (use WSL2)

## sampler-devices Platform Details

Pure TypeScript library - works on all Node.js platforms.

## Contributing Platform Support

See [bin/mtools/README.md](./sampler-export/bin/mtools/README.md) for instructions on adding binaries for additional platforms.
```

### 5. Update CONTRIBUTING.md

Add section on platform testing:

```markdown
## Platform Testing

When adding features that use platform-specific binaries:

1. Test on your current platform
2. Verify platform detection logic
3. Ensure fallback chain works correctly
4. Update PLATFORM-SUPPORT.md
5. Add binary to bin/ directory if available

## Adding Platform Binaries

See [sampler-export/bin/mtools/README.md](./sampler-export/bin/mtools/README.md) for instructions.
```

---

## Priority 3: OPTIONAL for v1.0.0

### 6. Add Platform Badges to README.md

Add badges for supported platforms:

```markdown
[![macOS](https://img.shields.io/badge/macOS-arm64-blue.svg)](https://github.com/oletizi/audio-tools)
[![Linux](https://img.shields.io/badge/Linux-partial-yellow.svg)](https://github.com/oletizi/audio-tools/blob/main/PLATFORM-SUPPORT.md)
```

### 7. Create ROADMAP.md

```markdown
# audio-tools Roadmap

## v1.0.0 (Current)
- ✅ Core functionality complete
- ✅ macOS Apple Silicon fully supported
- ✅ Cross-platform fallback system

## v1.1.0 (Q1 2026)
- [ ] Add darwin-x64 (macOS Intel) bundled binary
- [ ] Add linux-x64 bundled binary
- [ ] CI/CD multi-platform testing
- [ ] Expanded test coverage

## v1.2.0 (Q2 2026)
- [ ] Add linux-arm64 (Raspberry Pi) bundled binary
- [ ] Windows WSL2 documentation
- [ ] Performance optimizations
- [ ] Additional sample format support
```

---

## Implementation Checklist

Before publishing v1.0.0:

- [ ] Update sampler-export/README.md (Priority 1, items 1-2)
- [ ] Update root README.md (Priority 1, item 3)
- [ ] Create PLATFORM-SUPPORT.md (Priority 2, item 4)
- [ ] Update CONTRIBUTING.md (Priority 2, item 5)
- [ ] Review and finalize all documentation
- [ ] Verify all links work
- [ ] Spell check

Optional (can be done post-v1.0.0):
- [ ] Add platform badges (Priority 3, item 6)
- [ ] Create ROADMAP.md (Priority 3, item 7)

---

**Note**: These updates set appropriate expectations for users and provide clear guidance for contributing platform support.
