# Installation Guide

Complete installation guide for audio-tools packages (sampler-backup and sampler-export).

## Table of Contents

- [System Requirements](#system-requirements)
- [Installation Methods](#installation-methods)
  - [Method 1: One-Line Install (Recommended)](#method-1-one-line-install-recommended)
  - [Method 2: Download and Inspect](#method-2-download-and-inspect)
  - [Method 3: Version-Specific Installation](#method-3-version-specific-installation)
  - [Method 4: npm Installation](#method-4-npm-installation)
- [Installer Verification](#installer-verification)
- [Version Compatibility](#version-compatibility)
- [Post-Installation](#post-installation)
- [Platform-Specific Notes](#platform-specific-notes)
- [Troubleshooting](#troubleshooting)
- [Uninstallation](#uninstallation)

---

## System Requirements

### Required

- **Node.js**: 18 or higher
- **npm**: 9 or higher (ships with Node.js 18+)
- **Disk Space**: ~100MB for packages and dependencies

### Platform Support

- **macOS**: macOS 11+ (Big Sur or later)
  - Intel (x64): darwin-x64
  - Apple Silicon (ARM64): darwin-arm64
- **Linux**: Ubuntu 20.04+, Debian 11+, RHEL 8+, or equivalent
  - x64: linux-x64
  - ARM64: linux-arm64
- **Windows**: Via WSL2 (Windows Subsystem for Linux)

### Optional Dependencies

**For sampler-backup:**
- **BorgBackup** >= 1.2.0 - Required for backup functionality
  - macOS: `brew install borgbackup`
  - Linux: `sudo apt install borgbackup` or `sudo yum install borgbackup`

**For sampler-export:**
- **mtools** - Required for DOS/FAT32 disk image extraction
  - macOS Apple Silicon: Bundled automatically (zero-config)
  - Other platforms: `brew install mtools` or `sudo apt install mtools`

**For remote backups:**
- **SSH access** to remote hosts (PiSCSI, etc.)
- Configured SSH keys for passwordless authentication

---

## Installation Methods

### Method 1: One-Line Install (Recommended)

Install the latest stable version directly from GitHub Releases:

```bash
curl -fsSL https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh | bash
```

**What this does:**
1. Checks installer version and updates if needed
2. Verifies Node.js version (18+)
3. Checks available disk space
4. Installs packages globally via npm
5. Provides quick start instructions

**Advantages:**
- Always installs latest stable version
- Tested and verified release
- Includes version compatibility checks
- Fastest installation method
- Automatic requirement verification

**Installation time:** 2-5 minutes (depending on network speed)

---

### Method 2: Download and Inspect

For security-conscious users who want to review the installer first:

```bash
# Download installer
curl -fsSL https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh -o install.sh

# Review the installer
less install.sh
# or
cat install.sh

# Run installer
chmod +x install.sh
./install.sh
```

**Advantages:**
- Full transparency - review code before execution
- Can be run offline after download
- Suitable for air-gapped or restricted environments

---

### Method 3: Version-Specific Installation

Install a specific version for compatibility with existing workflows:

```bash
# Replace VERSION with desired version (e.g., 1.0.0-alpha.4)
VERSION="1.0.0-alpha.4"
curl -fsSL "https://github.com/oletizi/ol_dsp/releases/download/audio-tools@${VERSION}/install.sh" -o install.sh
chmod +x install.sh
./install.sh
```

**Use cases:**
- Maintaining version consistency across multiple machines
- Rolling back to a known working version
- Testing specific versions before upgrading

**Available versions:** See [GitHub Releases](https://github.com/oletizi/ol_dsp/releases?q=audio-tools)

---

### Method 4: npm Installation

Install packages individually via npm (advanced users):

```bash
# Install both packages
npm install -g @oletizi/sampler-backup @oletizi/sampler-export

# Or install individually
npm install -g @oletizi/sampler-backup
npm install -g @oletizi/sampler-export
```

**Note:** This method requires manual configuration and dependency installation.

**Additional steps required:**
1. Install BorgBackup manually (for backup functionality)
2. Install mtools manually (for extraction on non-Apple Silicon platforms)
3. Configure SSH access for remote backups
4. Create configuration directories manually

**Advantages:**
- Fine-grained control over package versions
- Suitable for CI/CD pipelines
- No installer script execution

**Disadvantages:**
- No automatic dependency checks
- No guided setup
- Manual configuration required

---

## Installer Verification

Verify installer integrity using SHA256 checksums:

### Download and Verify

```bash
# Download installer and checksum
curl -fsSL https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh -o install.sh
curl -fsSL https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh.sha256 -o install.sh.sha256

# Verify checksum (macOS/Linux)
shasum -a 256 -c install.sh.sha256

# Expected output: install.sh: OK
```

### Manual Verification

```bash
# Generate checksum of downloaded installer
shasum -a 256 install.sh

# Compare with published checksum
cat install.sh.sha256
```

If checksums match, the installer is authentic and unmodified.

---

## Version Compatibility

### Installer and Package Version Matrix

| Installer Version | Compatible Package Versions | Notes |
|-------------------|----------------------------|-------|
| 1.0.0-alpha.4     | 1.0.0-alpha.4              | Initial alpha release |
| 1.0.0-alpha.5     | 1.0.0-alpha.5+             | Added local media support |

**Recommendation:** Always use the installer version that matches your target package version.

### Version Checking

The installer automatically checks for version compatibility:

```bash
# Installer checks:
# 1. Latest installer version available
# 2. Package version compatibility
# 3. Warns if newer version exists
```

**Version mismatch handling:**
- **Minor mismatch**: Warning displayed, installation continues
- **Major mismatch**: Error displayed, installation halted
- **Newer installer available**: Optional upgrade prompt

---

## Post-Installation

### Verify Installation

```bash
# Check installed versions
akai-backup --version
akai-extract --version

# Check binary locations
which akai-backup
which akai-extract
```

**Expected output:**
```
/usr/local/bin/akai-backup
/usr/local/bin/akai-extract
```

### Test Basic Functionality

**Test backup command:**
```bash
# Check BorgBackup availability
akai-backup check 2>/dev/null || echo "No repository yet (expected)"

# Expected: "Repository does not exist" (normal before first backup)
```

**Test extract command:**
```bash
# List available extractors
akai-extract --help

# Expected: Help text with available commands
```

### Initial Setup

**For sampler-backup:**
```bash
# No configuration needed - uses sensible defaults
# First backup will create repository automatically

# Optional: Test SSH connectivity to remote hosts
ssh pi@pi-scsi2.local echo "Connection successful"
```

**For sampler-export:**
```bash
# No configuration needed
# Create extraction directory structure automatically on first run
```

### Directory Structure

After installation, audio-tools uses the following directory structure:

```
~/.audiotools/
├── borg-repo/                 # BorgBackup repository
├── sampler-export/            # Extraction output
│   └── extracted/
│       ├── s5k/              # S5000/S6000 extractions
│       └── s3k/              # S3000XL extractions
└── logs/                     # Operation logs (optional)
```

---

## Platform-Specific Notes

### macOS

**Homebrew recommended for dependencies:**
```bash
# Install BorgBackup
brew install borgbackup

# mtools (only needed for non-Apple Silicon)
brew install mtools  # Bundled on Apple Silicon
```

**Gatekeeper may block installer on first run:**
```bash
# If blocked, allow in System Preferences → Security & Privacy
# Or run with explicit permission:
chmod +x install.sh
xattr -d com.apple.quarantine install.sh
./install.sh
```

**Node.js installation:**
```bash
# Via Homebrew (recommended)
brew install node@18

# Via official installer
# Download from https://nodejs.org/
```

---

### Linux

**Install dependencies via package manager:**

**Debian/Ubuntu:**
```bash
# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install BorgBackup
sudo apt install borgbackup

# Install mtools
sudo apt install mtools
```

**RHEL/CentOS/Fedora:**
```bash
# Install Node.js 18+
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install BorgBackup
sudo yum install borgbackup

# Install mtools
sudo yum install mtools
```

**Arch Linux:**
```bash
# Install dependencies
sudo pacman -S nodejs npm borgbackup mtools
```

---

### Windows (WSL2)

**Install WSL2 first:**
```powershell
# In PowerShell as Administrator
wsl --install
```

**Then follow Linux installation steps inside WSL2:**
```bash
# Inside WSL2
curl -fsSL https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh | bash
```

**Note:** Direct Windows installation (non-WSL) is not currently supported.

---

## Troubleshooting

### Installer Version Mismatch

**Problem:**
```
⚠  Package version 1.0.1 may not be compatible with this installer
   Maximum tested version: 1.0.0
```

**Solution:** Download the latest installer:
```bash
curl -fsSL https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh | bash
```

---

### Network Issues During Installation

**Problem:**
```
⚠  Could not check for installer updates (network issue or GitHub rate limit)
```

**This is non-fatal.** The installation will continue with the current installer version.

**Solutions:**
1. Check internet connectivity
2. Retry after a few minutes
3. Download installer manually and run offline

---

### GitHub Rate Limiting

**Problem:**
```
⚠  Could not check for installer updates (network issue or GitHub rate limit)
```

**Solutions:**
1. Wait 60 minutes and retry
2. Download installer manually and run locally
3. Authenticate with GitHub CLI: `gh auth login`

**Rate limits:**
- **Unauthenticated**: 60 requests/hour per IP
- **Authenticated**: 5,000 requests/hour

---

### Node.js Version Too Old

**Problem:**
```
Error: Node.js 18 or higher required (current: 16.x.x)
```

**Solutions:**

**macOS:**
```bash
brew install node@18
```

**Linux:**
```bash
# Use NodeSource for latest version
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Verify:**
```bash
node --version  # Should show v18.x.x or higher
```

---

### Insufficient Disk Space

**Problem:**
```
Error: Insufficient disk space (required: 100MB, available: 50MB)
```

**Solutions:**
1. Free up disk space
2. Install on different partition with more space
3. Use npm install with custom prefix:
   ```bash
   npm config set prefix /path/to/larger/partition
   npm install -g @oletizi/sampler-backup @oletizi/sampler-export
   ```

---

### Permission Denied

**Problem:**
```
Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solutions:**

**Option 1: Fix npm permissions (recommended):**
```bash
# Create directory for global packages in home directory
mkdir -p ~/.npm-global
npm config set prefix ~/.npm-global

# Add to PATH in ~/.bashrc or ~/.zshrc
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Retry installation
curl -fsSL https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh | bash
```

**Option 2: Use sudo (not recommended):**
```bash
sudo npm install -g @oletizi/sampler-backup @oletizi/sampler-export
```

---

### BorgBackup Not Found

**Problem:**
```
Error: BorgBackup binary not found
```

**Solution:** Install BorgBackup:
```bash
# macOS
brew install borgbackup

# Linux
sudo apt install borgbackup    # Debian/Ubuntu
sudo yum install borgbackup    # RHEL/CentOS
```

**Verify:**
```bash
borg --version  # Should show 1.2.x or higher
```

---

### mtools Not Found

**Problem:**
```
Error: mtools binary not found
```

**Solution:** Install mtools:
```bash
# macOS
brew install mtools

# Linux
sudo apt install mtools        # Debian/Ubuntu
sudo yum install mtools        # RHEL/CentOS
```

**Note:** macOS Apple Silicon includes bundled mtools - this error should not occur.

---

### SSH Connection Failure

**Problem:**
```
Error: Cannot connect to remote host pi@pi-scsi2.local
```

**Solutions:**
1. Verify host is reachable: `ping pi-scsi2.local`
2. Test SSH connection: `ssh pi@pi-scsi2.local`
3. Check SSH key: `ssh-add -l`
4. Configure SSH config in `~/.ssh/config`:
   ```
   Host pi-scsi2
       HostName pi-scsi2.local
       User pi
       IdentityFile ~/.ssh/id_rsa
   ```

---

## Uninstallation

### Remove Packages

```bash
# Remove global packages
npm uninstall -g @oletizi/sampler-backup @oletizi/sampler-export
```

### Remove Configuration (Optional)

**Warning:** This preserves backups but removes configuration.

```bash
# Remove configuration only
rm -rf ~/.audiotools/config.json
rm -rf ~/.audiotools/.install-state
```

### Remove All Data (Danger)

**Warning:** This deletes ALL backup data. Only do this if you're certain.

```bash
# Remove everything including backups
rm -rf ~/.audiotools/
```

### Verify Uninstallation

```bash
# Check commands are gone
which akai-backup  # Should return nothing
which akai-extract # Should return nothing

# Check packages are removed
npm list -g --depth=0 | grep oletizi
# Should return nothing
```

---

## Getting Help

If you encounter issues not covered in this guide:

- **GitHub Issues**: https://github.com/oletizi/ol_dsp/issues
- **Documentation**: `/docs/1.0/`
- **Package READMEs**: See individual package directories
- **Discussions**: https://github.com/oletizi/ol_dsp/discussions

When reporting issues, please include:
1. Operating system and version
2. Node.js version (`node --version`)
3. npm version (`npm --version`)
4. Installer version (from installer output)
5. Full error message and stack trace
6. Steps to reproduce

---

## Next Steps

After successful installation:

1. **Set up backups**: See [sampler-backup README](../sampler-backup/README.md)
2. **Extract disk images**: See [sampler-export README](../sampler-export/README.md)
3. **Configure SSH**: For remote backup functionality
4. **Install BorgBackup**: For backup operations
5. **Test functionality**: Run test commands to verify setup

---

## Additional Resources

- [Main README](../../README.md) - Project overview
- [sampler-backup README](../../sampler-backup/README.md) - Backup documentation
- [sampler-export README](../../sampler-export/README.md) - Extraction documentation
- [GitHub Releases](https://github.com/oletizi/ol_dsp/releases?q=audio-tools) - All versions
- [npm Packages](https://www.npmjs.com/~oletizi) - Published packages
