# @oletizi/sampler-backup

**Efficient, deduplicated backups for Akai hardware samplers via BorgBackup.**

## Installation

**Recommended: Use the installer (installs both backup and export packages)**

```bash
curl -fsSL https://github.com/oletizi/ol_dsp/releases/latest/download/install.sh | bash
```

**Alternative: Install this package only**

```bash
npm install -g @oletizi/sampler-backup
```

See the [Installation Guide](../docs/1.0/INSTALLATION.md) for more options, troubleshooting, and system requirements.

## Purpose

The `sampler-backup` package provides reliable, space-efficient backups for vintage Akai hardware samplers. It uses BorgBackup to create automated incremental backups from remote devices (via SSH/PiSCSI) or local media (SD cards, USB drives), ensuring decades of sampled instruments are preserved safely with block-level deduplication and compression.

## Philosophy

**Incremental preservation with minimal space.** Rather than copying entire disk images repeatedly, this library provides:

- **Block-level deduplication**: Borg automatically deduplicates identical data blocks across all backups
- **Efficient compression**: zstd compression provides excellent balance of speed and ratio
- **Intelligent same-day resume**: Prevents duplicate backups if interrupted and resumed
- **Remote-first design**: SSH-based backup from hardware via PiSCSI or similar SCSI emulators
- **Local media support**: Direct backup from SD cards and USB drives for floppy/SCSI emulators
- **Configurable retention**: Daily, weekly, and monthly intervals with customizable retention policies
- **Extreme efficiency**: Block-level deduplication means unchanged disk images transfer only metadata

## Quick Start

### Installation

```bash
# Install BorgBackup (required dependency)
brew install borgbackup          # macOS
# or
sudo apt install borgbackup      # Linux

# Install package from monorepo
pnpm --filter @oletizi/sampler-backup build
```

### Basic Usage

```bash
# Backup from default remote sources (pi-scsi2.local, s3k.local)
akai-backup backup

# Backup from local SD card
akai-backup backup --source /Volumes/SDCARD

# Backup from custom SSH host
akai-backup backup --source pi@myhost.local:/home/orion/images/

# List all backup archives
akai-backup list

# Show repository statistics
akai-backup info

# Restore an archive
akai-backup restore daily-2025-10-06-pi-scsi2 /tmp/restored

# Check repository integrity
akai-backup check

# Prune old archives manually
akai-backup prune
```

### Local Media Support

**Backup disk images directly from SD cards, USB drives, and other mounted storage media.**

**Use Cases:**

**Gotek Floppy Emulator:**
```bash
# Remove SD card from Gotek, insert into computer
akai-backup backup --source /Volumes/GOTEK --subdir gotek-s3000xl
```

**ZuluSCSI SCSI Emulator:**
```bash
# Remove SD card from ZuluSCSI, insert into computer
akai-backup backup --source /Volumes/ZULUSCSI --subdir zulu-s5000
```

**USB Drive:**
```bash
# Direct backup from any USB drive with disk images
akai-backup backup --source /Volumes/USB_DRIVE --subdir my-backups
```

**Features:**
- Auto-detects `.hds`, `.img`, and `.iso` files
- Block-level deduplication (unchanged files = near-zero transfer)
- Compression with zstd
- Cross-platform (macOS and Linux)

## Why BorgBackup?

**Migration from rsnapshot:** Version 1.0 migrated from rsnapshot to BorgBackup for superior efficiency and features:

### Key Advantages

- **Block-level deduplication**: Borg deduplicates at the chunk level, not file level. Unchanged 4GB disk images transfer only a few KB of metadata.
- **Efficient compression**: zstd compression provides excellent balance of speed and compression ratio
- **Single repository**: All archives stored in one repository with automatic deduplication across all backups
- **Integrity verification**: Built-in `borg check` ensures repository consistency
- **Encryption support**: Optional encryption for sensitive data (disabled by default for simplicity)
- **SSH-native**: Direct SSH support without requiring remote rsync installation

### Efficiency Gains

BorgBackup's block-level deduplication provides dramatic efficiency improvements:

- **Unchanged disk images**: Transfer ~10KB metadata instead of 4GB
- **Small changes**: Only modified blocks transferred (e.g., 5MB change in 4GB image = 5MB transfer)
- **Cross-archive deduplication**: Identical blocks shared across all archives automatically
- **Compression**: zstd typically achieves 20-40% compression on disk images

**Example:** Backing up 100GB of mostly-unchanged disk images daily:
- **rsnapshot**: ~100GB storage per backup (hard links help but still copy changed files entirely)
- **BorgBackup**: ~100GB for first backup, then ~100MB-1GB per day for typical changes

## Architecture

```
┌──────────────────────┐
│ akai-backup CLI      │  Command-line interface
│  backup              │  - backup, batch, list, info
│  list, info          │  - restore, check, prune
│  restore, check      │
│  prune               │
└──────────┬───────────┘
           │
    ┌──────▼──────────────┐
    │ BackupSourceFactory │  Create appropriate source
    └──────┬──────────────┘
           │
     ┌─────┴──────┐
     │            │
┌────▼─────┐  ┌──▼──────┐
│ Remote   │  │ Local   │  Source implementations
│ Source   │  │ Source  │  - RemoteSource (SSH)
└────┬─────┘  └──┬──────┘  - LocalSource (SD/USB)
     │           │
     └─────┬─────┘
           │
    ┌──────▼───────────┐
    │ BorgBackupAdapter│  Core Borg integration
    │  - initRepository│  - Execute borg commands
    │  - createArchive │  - Handle progress
    │  - listArchives  │  - Parse statistics
    │  - restoreArchive│
    │  - pruneArchives │
    │  - checkRepository│
    └──────┬───────────┘
           │
    ┌──────▼───────┐
    │ BorgBackup   │  System borg binary
    │  - dedupe    │  (installed via brew/apt)
    │  - compress  │
    │  - encrypt   │
    └──────────────┘
```

### Component Overview

- **CLI** (`src/cli/backup.ts`): Commander-based interface with all commands
- **BackupSourceFactory** (`src/sources/backup-source-factory.ts`): Creates RemoteSource or LocalSource based on path
- **RemoteSource** (`src/sources/remote-source.ts`): SSH-based backup using Borg over SSH
- **LocalSource** (`src/sources/local-source.ts`): Local media backup with MediaDetector for auto-discovery
- **BorgBackupAdapter** (`src/backup/borg-backup-adapter.ts`): Core Borg integration with full API
- **MediaDetector** (`src/media/media-detector.ts`): Auto-discovers disk images on local media

## Configuration

### Default Settings

```typescript
{
  repoPath: '~/.audiotools/borg-repo',
  compression: 'zstd',              // Balanced speed/ratio
  encryption: 'none',               // Local trust model
  retention: {
    daily: 7,                       // Keep last 7 daily backups
    weekly: 4,                      // Keep last 4 weekly backups
    monthly: 12                     // Keep last 12 monthly backups
  }
}
```

### Default Remote Sources

```typescript
[
  'pi@pi-scsi2.local:/home/orion/images/',
  'pi@s3k.local:/home/orion/images/'
]
```

### Custom Configuration

Override defaults with command-line flags:

```bash
# Use custom source
akai-backup backup --source /custom/path

# Use custom subdirectory name
akai-backup backup --source /Volumes/SD --subdir my-backup

# Custom retention policy
akai-backup prune --daily 14 --weekly 8 --monthly 24
```

## CLI Commands

### `akai-backup backup [interval]`

Run backup from remote hosts or local media.

```bash
# Default sources, daily interval
akai-backup backup

# Weekly backup (promotes daily archives)
akai-backup backup weekly

# Monthly backup (promotes weekly archives)
akai-backup backup monthly

# Custom source
akai-backup backup --source /Volumes/SDCARD --subdir my-s3000
```

### `akai-backup batch`

Alias for `akai-backup backup daily`. Perfect for cron jobs.

```bash
akai-backup batch
```

### `akai-backup list [--json]`

List all backup archives in repository.

```bash
# Human-readable list
akai-backup list

# JSON output
akai-backup list --json
```

### `akai-backup info`

Show repository statistics and information.

```bash
akai-backup info
```

Output includes:
- Repository ID and path
- Archive count
- Total size (original, compressed, deduplicated)
- Compression and deduplication ratios

### `akai-backup restore <archive> <destination>`

Restore a specific archive to destination directory.

```bash
akai-backup restore daily-2025-10-06-pi-scsi2 /tmp/restored
```

### `akai-backup check`

Verify repository integrity and consistency.

```bash
akai-backup check
```

### `akai-backup prune`

Manually prune old archives based on retention policy.

```bash
# Use default retention
akai-backup prune

# Custom retention
akai-backup prune --daily 14 --weekly 8 --monthly 24
```

## Supported Platforms

- macOS (darwin-arm64, darwin-x64)
- Linux (x64, ARM64)
- Windows via WSL2

## Requirements

- **BorgBackup** >= 1.2.0 - Install via `brew install borgbackup` or `apt install borgbackup`
- **SSH access** to remote hosts (for remote backups)
- **Node.js** >= 18

## Troubleshooting

### Repository is locked

```
Error: Repository is locked by another process
```

**Solution:** Wait for other backup to complete, or if stuck:
```bash
borg break-lock ~/.audiotools/borg-repo
```

### Cannot connect to remote host

```
Error: Cannot connect to remote host
```

**Solutions:**
- Verify SSH connection: `ssh pi@pi-scsi2.local`
- Check SSH config in `~/.ssh/config`
- Ensure remote host is powered on and reachable

### No space left on device

```
Error: Not enough disk space for backup
```

**Solutions:**
- Free up disk space on backup destination
- Prune old archives: `akai-backup prune`
- Change repository location to disk with more space

### BorgBackup not installed

```
Error: BorgBackup binary not found
```

**Solution:** Install BorgBackup:
```bash
brew install borgbackup          # macOS
sudo apt install borgbackup      # Linux
```

### No disk images found

```
No disk images found in source path
```

**Solutions:**
- Verify source path is correct and mounted
- Check for supported extensions: `.hds`, `.img`, `.iso`
- Ensure SD card or USB drive is properly connected

## Migration from rsnapshot

**IMPORTANT:** Version 1.0 completely replaced rsnapshot with BorgBackup. The old rsnapshot-based implementation is no longer supported.

### What Changed

- **Removed commands**: `akai-backup config` and `akai-backup test` (rsnapshot-specific)
- **New backend**: BorgBackup instead of rsnapshot
- **New commands**: `list`, `info`, `restore`, `check`, `prune`
- **Configuration**: No more rsnapshot.conf, settings are now command-line flags
- **Repository format**: Borg repositories (not rsnapshot directories)

### Migration Steps

If you have existing rsnapshot backups:

1. **Keep your old rsnapshot backups** - They're still valid for restoration
2. **Start fresh with Borg** - Run `akai-backup backup` to create new Borg repository
3. **Verify new backups** - Use `akai-backup list` to confirm archives
4. **Archive old rsnapshot data** - After verifying Borg backups work, you can archive old `~/.audiotools/backup/` directory

### Why Migrate?

- **Block-level deduplication**: Save massive amounts of storage and bandwidth
- **Better compression**: zstd compression is faster and more efficient
- **Simpler configuration**: No config files to manage
- **Built-in integrity checks**: `borg check` verifies backup integrity
- **Better error handling**: Clearer error messages and recovery

**Documentation:**

- 📦 [Installation Guide](./docs/1.0/installation.md)
- 🚀 [Quick Start](./docs/1.0/quick-start.md)
- 📟 [CLI Commands](./docs/1.0/cli-commands.md)
- ⚙️ [Configuration](./docs/1.0/configuration.md)
- 💡 [Examples](./docs/1.0/examples.md)
- 📚 [API Reference](./docs/1.0/api-reference.md)
- 🔧 [Troubleshooting](./docs/1.0/troubleshooting.md)
- 📖 [Complete v1.0 Documentation](./docs/1.0/README.md)

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

**Development Setup:**
```bash
git clone https://github.com/yourusername/audio-tools.git
cd audio-tools/sampler-backup
pnpm install
pnpm run build
pnpm test
```

## License

Apache-2.0

## Credits

**Author:** Orion Letizi

**Related Projects:**
- [@oletizi/sampler-export](https://www.npmjs.com/package/@oletizi/sampler-export) - Disk image extraction and format conversion
- [@oletizi/sampler-devices](https://www.npmjs.com/package/@oletizi/sampler-devices) - Akai device abstraction

**External Dependencies:**
- [BorgBackup](https://www.borgbackup.org/) - Deduplicating backup program with compression and encryption

---

**Need Help?**

- 📖 [Documentation](./docs/1.0/README.md)
- 🐛 [Report Issues](https://github.com/yourusername/audio-tools/issues)
- 💬 [Discussions](https://github.com/yourusername/audio-tools/discussions)
