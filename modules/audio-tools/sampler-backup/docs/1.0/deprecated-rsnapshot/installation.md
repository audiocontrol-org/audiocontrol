# Installation

## Prerequisites

### macOS

```bash
# 1. Download and install macFUSE manually
# Visit https://macfuse.github.io/ and download the latest release
# Double-click the .dmg and run the installer

# 2. Allow macFUSE in System Preferences
# Go to System Preferences → Privacy & Security
# Click "Allow" next to the macFUSE system extension message

# 3. Restart your Mac
# This is required for the kernel extension to load

# 4. Install SSHFS and BorgBackup via Homebrew
brew install sshfs borgbackup
```

### Linux

```bash
# Debian/Ubuntu
sudo apt install sshfs borgbackup

# RHEL/CentOS
sudo yum install fuse-sshfs borgbackup
```

### Verify Installation

```bash
# Check SSHFS
sshfs --version

# Check BorgBackup
borg --version
```

## Package Installation

### From Monorepo

```bash
# Install dependencies
pnpm install

# Build the package
pnpm --filter @oletizi/sampler-backup build

# Test the CLI
pnpm --filter @oletizi/sampler-backup backup --help
```

### From npm (when published)

```bash
npm install -g @oletizi/sampler-backup
```

## Requirements

- **BorgBackup** - Deduplicating backup program
- **SSHFS** - SSH filesystem for remote mounts (remote backups only)
- **macFUSE** - Required for SSHFS on macOS (macOS only)
- **SSH access** - Passwordless SSH keys recommended for remote backups
- **Node.js** >= 18

## SSH Setup (Remote Backups)

For passwordless remote backups:

```bash
# Generate SSH key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Copy public key to remote host
ssh-copy-id pi-scsi2.local

# Test connection
ssh pi-scsi2.local
```

## Troubleshooting Installation

### macOS: "macFUSE system extension blocked"

1. Go to System Preferences → Privacy & Security
2. Click "Allow" next to macFUSE message
3. Restart your Mac
4. Try `brew install sshfs` again

### Linux: "FUSE kernel module not loaded"

```bash
# Load FUSE module
sudo modprobe fuse

# Add to boot
echo "fuse" | sudo tee -a /etc/modules
```

### BorgBackup not found

```bash
# Verify installation
which borg

# If not found, check PATH
echo $PATH

# On macOS with Homebrew
export PATH="/opt/homebrew/bin:$PATH"
```

## Next Steps

See [Quick Start](./quick-start.md) for your first backup.
