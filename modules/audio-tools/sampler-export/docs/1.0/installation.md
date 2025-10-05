# Installation - sampler-export v1.0

## Package Installation

```bash
# Using npm
npm install @oletizi/sampler-export

# Using pnpm
pnpm add @oletizi/sampler-export

# Using yarn
yarn add @oletizi/sampler-export
```

## Platform Requirements

- **Node.js**: 16.x or higher
- **Operating System**: macOS, Linux, or Windows
- **mtools**: Bundled for darwin-arm64, optional for other platforms

## Optional: System mtools Installation

While `sampler-export` bundles mtools binaries for most platforms, you can also use system-installed mtools as a fallback:

```bash
# macOS
brew install mtools

# Debian/Ubuntu Linux
sudo apt install mtools

# RHEL/CentOS Linux
sudo yum install mtools

# Windows
# Download from https://www.gnu.org/software/mtools/
```

## Platform Support

### Fully Supported (Bundled Binary)

- **darwin-arm64**: macOS Apple Silicon (M1/M2/M3) - Zero configuration required

### Partial Support (System mtools Required)

- **darwin-x64**: macOS Intel - Install via Homebrew
- **linux-x64**: Linux 64-bit - Install via apt/yum
- **linux-arm64**: Linux ARM64 (Raspberry Pi) - Install via apt
- **win32-x64**: Windows 64-bit - Manual installation or WSL2 recommended

### Binary Fallback Chain

1. **Bundled binary** - Checked first (`bin/mtools/{platform}/mcopy`)
2. **System binary** - Falls back to system-installed mtools
3. **Error with instructions** - Clear, platform-specific guidance

## Verification

```bash
# Verify installation
node -e "require('@oletizi/sampler-export')"

# Check platform
node -p "process.platform + '-' + process.arch"
```

## Next Steps

- [Quick Start Guide](./quick-start.md)
- [API Reference](./api-reference.md)
- [Troubleshooting](./troubleshooting.md)
