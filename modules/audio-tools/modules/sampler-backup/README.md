# @oletizi/sampler-backup

**Simple, reliable backups for Akai hardware samplers via rsync.**

## Installation

**Recommended: Use the installer (installs both backup and export packages)**

```bash
curl -fsSL https://github.com/oletizi/ol_dsp/releases/download/audio-tools@1.0.0-alpha.42/install.sh | bash
```

**Alternative: Install this package only**

```bash
npm install -g @oletizi/sampler-backup
```

See the [Installation Guide](../docs/1.0/INSTALLATION.md) for more options, troubleshooting, and system requirements.

## Purpose

The `sampler-backup` package provides reliable backups for vintage Akai hardware samplers. It uses rsync to create synchronized backups from remote devices (via SSH/PiSCSI) or local media (SD cards, USB drives), ensuring decades of sampled instruments are preserved safely with efficient file-level synchronization.

## Philosophy

**Simple, reliable file synchronization.** Rather than complex archiving systems, this library provides:

- **File-level synchronization**: rsync transfers only changed files efficiently
- **Fast delta transfers**: Only differences in modified files are transmitted
- **Simple directory structure**: Organized by sampler name and device for easy access
- **Remote-first design**: SSH-based backup from hardware via PiSCSI or similar SCSI emulators
- **Local media support**: Direct backup from SD cards and USB drives for floppy/SCSI emulators
- **Zero configuration**: No repository initialization or complex setup required
- **Universal availability**: rsync is pre-installed on macOS and most Linux systems

## Quick Start

### Installation

```bash
# rsync is pre-installed on macOS and most Linux distributions
# Verify installation:
rsync --version

# Install package from monorepo
pnpm --filter @oletizi/sampler-backup build
```

### Basic Usage

```bash
# Sync from remote PiSCSI device
akai-backup sync --source pi-scsi2.local:~/images/ --device images

# Sync from local SD card (Gotek/ZuluSCSI)
akai-backup sync --source /Volumes/SDCARD --sampler s5k-studio --device floppy

# List all synced backups
akai-backup list --all

# List specific sampler
akai-backup list --sampler pi-scsi2

# List specific device
akai-backup list --sampler s5k-studio --device floppy
```

### Local Media Support

**Backup disk images directly from SD cards, USB drives, and other mounted storage media.**

**Use Cases:**

**Gotek Floppy Emulator:**
```bash
# Remove SD card from Gotek, insert into computer
akai-backup sync --source /Volumes/GOTEK --sampler s3k-gotek --device floppy
```

**ZuluSCSI SCSI Emulator:**
```bash
# Remove SD card from ZuluSCSI, insert into computer
akai-backup sync --source /Volumes/ZULUSCSI --sampler s5k-zulu --device scsi0
```

**USB Drive:**
```bash
# Direct backup from any USB drive with disk images
akai-backup sync --source /Volumes/USB_DRIVE --sampler my-sampler --device usb
```

**Features:**
- Auto-detects `.hds`, `.img`, and `.iso` files
- Efficient delta transfers (only changed bytes transmitted)
- Simple directory structure for easy access
- Cross-platform (macOS and Linux)

## Unified Configuration System

**NEW:** This package supports the unified audio-tools configuration system for zero-flag workflows.

### Using with Unified CLI

If you installed `@oletizi/audiotools`, you can use the unified CLI:

```bash
# Configure once
audiotools config

# Run backups without flags
audiotools backup                 # Backup all enabled sources
audiotools backup pi-scsi2        # Backup specific source
```

See the [Unified CLI Guide](../audiotools-cli/README.md) for complete documentation.

### Using Config-Based Workflows

Even when using `akai-backup` directly, you can use configuration:

```bash
# Create configuration
audiotools config
# Or use the backup command's config wizard
akai-backup config

# Run config-based backup
akai-backup backup                # Backup all enabled sources
akai-backup backup pi-scsi2       # Backup specific source by name
```

### Configuration File

Configuration is stored in `~/.audiotools/config.json`:

```json
{
  "version": "1.0",
  "backup": {
    "backupRoot": "~/.audiotools/backup",
    "sources": [
      {
        "name": "pi-scsi2",
        "type": "remote",
        "source": "pi-scsi2.local:~/images/",
        "device": "images",
        "enabled": true
      },
      {
        "name": "s5k-gotek",
        "type": "local",
        "source": "/Volumes/GOTEK",
        "device": "floppy",
        "sampler": "s5k-studio",
        "enabled": true
      }
    ]
  }
}
```

### Dual Workflow Support

Both workflows are supported:

**Flag-based (original):**
```bash
akai-backup sync --source pi-scsi2.local:~/images/ --device images
```

**Config-based (new):**
```bash
akai-backup backup                # All enabled sources
akai-backup backup pi-scsi2       # Specific source by name
```

**Benefits of config-based workflow:**
- No flags needed for regular backups
- Manage multiple sources easily
- Enable/disable sources without changing commands
- Shared configuration with export tool
- Auto-discovery of existing backups

See [@oletizi/audiotools-config](../audiotools-config/README.md) for configuration API documentation.

## Why rsync?

**Simple and reliable:** rsync provides straightforward file synchronization without complex setup:

### Key Advantages

- **File-level delta transfers**: Only changed portions of files are transmitted
- **Universal availability**: Pre-installed on macOS and most Linux distributions
- **Simple directory structure**: Direct access to files without extraction or restore commands
- **Zero configuration**: No repository initialization or setup required
- **SSH-native**: Efficient remote synchronization over SSH
- **Proven reliability**: Decades of use in backup systems worldwide

### Efficiency

rsync's delta-transfer algorithm provides efficient backups:

- **Unchanged files**: Skipped entirely (no transfer)
- **Modified files**: Only changed bytes transferred using rolling checksums
- **Direct access**: Files stored in normal directories, no special tools needed
- **Incremental by default**: Only differences transferred on each run

**Example:** Syncing 100GB of mostly-unchanged disk images:
- **First sync**: Full 100GB transfer
- **Subsequent syncs**: Only modified bytes (typically 100MB-1GB for daily changes)
- **Storage**: Latest version always available in simple directory structure

## Architecture

```
┌──────────────────────┐
│ akai-backup CLI      │  Command-line interface
│  sync / backup       │  - sync, backup (config-based)
│  list                │  - list backups
│  config              │  - configure backups
└──────────┬───────────┘
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
    │ rsync            │  Synchronize files
    │  - delta xfer    │  - Only changed bytes
    │  - SSH support   │  - Direct file access
    │  - checksum      │
    └──────┬───────────┘
           │
    ┌──────▼───────────┐
    │ Backup Directory │  Simple directory structure
    │  ~/.audiotools/  │  - sampler/device/files
    │  backup/         │  - Direct access
    └──────────────────┘
```

### Component Overview

- **CLI** (`src/cli/backup.ts`): Commander-based interface with sync, backup, and list commands
- **RemoteSource** (`src/lib/sources/remote-source.ts`): SSH-based backup using rsync over SSH
- **LocalSource** (`src/lib/sources/local-source.ts`): Local media backup with MediaDetector for auto-discovery
- **MediaDetector** (`src/lib/media/media-detector.ts`): Auto-discovers disk images on local media
- **rsync**: System rsync binary (pre-installed on macOS/Linux)

## Configuration

### Default Settings

```typescript
{
  backupRoot: '~/.audiotools/backup',  // Root backup directory
}
```

### Directory Structure

Backups are organized hierarchically:

```
~/.audiotools/backup/
├── pi-scsi2/              # Sampler name (from hostname or --sampler)
│   └── images/            # Device name (from --device)
│       ├── HD0.hds
│       ├── HD1.hds
│       └── akai.img
└── s5k-studio/            # Another sampler
    └── floppy/            # Floppy emulator device
        └── DSK0.img
```

### Command-Line Options

```bash
# Sync with required options
akai-backup sync --source <path> --device <name>

# Optional sampler name (required for local, auto-detected for remote)
akai-backup sync --source /Volumes/SD --sampler my-sampler --device floppy

# Dry run to preview changes
akai-backup sync --source <path> --device <name> --dry-run
```

## CLI Commands

### `akai-backup backup [source] [options]`

**NEW:** Config-based backup command. Runs backups using configuration from `~/.audiotools/config.json`.

```bash
# Backup all enabled sources
akai-backup backup

# Backup specific source by name
akai-backup backup pi-scsi2
akai-backup backup s5k-gotek

# Override with flags
akai-backup backup --source pi-scsi2.local:~/images/ --device images
```

**Arguments:**
- `[source]` - Optional: specific source name from configuration

**Options:**
- `--source <path>`: Override: source path (falls back to flag-based mode)
- `--device <name>`: Override: device name (required with --source)
- `--sampler <name>`: Override: sampler name
- `--dry-run`: Preview changes without syncing

**How it works:**
1. If no `--source` flag, loads configuration from `~/.audiotools/config.json`
2. Runs enabled sources (or specific source if named)
3. Falls back to flag-based mode if `--source` provided

### `akai-backup sync`

Original flag-based sync command. Requires explicit flags.

```bash
# Remote PiSCSI backup
akai-backup sync --source pi-scsi2.local:~/images/ --device images

# Remote with custom sampler name
akai-backup sync --source pi@host:/data --device scsi0 --sampler my-s5000

# Local SD card backup
akai-backup sync --source /Volumes/SDCARD --sampler s5k-studio --device floppy

# Dry run (preview only)
akai-backup sync --source /Volumes/USB --sampler test --device usb --dry-run
```

**Required Options:**
- `--source <path>`: Source path (local directory or remote SSH path)
- `--device <name>`: Device identifier (images, scsi0, floppy, etc.)

**Optional:**
- `--sampler <name>`: Sampler identifier (required for local, auto-detected for remote)
- `--dry-run`: Preview changes without actually syncing

### `akai-backup list`

List all synced backups with file counts and sizes.

```bash
# List all samplers and devices
akai-backup list --all

# List specific sampler
akai-backup list --sampler pi-scsi2

# List specific device
akai-backup list --sampler s5k-studio --device floppy

# JSON output
akai-backup list --json
```

**Output includes:**
- Directory paths
- File counts
- Total sizes (formatted and raw)

### `akai-backup config`

**NEW:** Launch interactive configuration wizard.

```bash
# Interactive configuration
akai-backup config

# Display current configuration
akai-backup config --list

# Reset to defaults
akai-backup config --reset
```

Delegates to the unified configuration system. See [@oletizi/audiotools-config](../audiotools-config/README.md) for details.

## Supported Platforms

- macOS (darwin-arm64, darwin-x64)
- Linux (x64, ARM64)
- Windows via WSL2

## Requirements

- **rsync** - Pre-installed on macOS and most Linux distributions
- **SSH access** to remote hosts (for remote backups)
- **Node.js** >= 18

## Troubleshooting

### Cannot connect to remote host

```
Error: Cannot connect to remote host
```

**Solutions:**
- Verify SSH connection: `ssh pi@pi-scsi2.local`
- Check SSH config in `~/.ssh/config`
- Ensure remote host is powered on and reachable
- Test with password-less SSH keys: `ssh-copy-id pi@host`

### No space left on device

```
Error: Not enough disk space for backup
```

**Solutions:**
- Free up disk space on backup destination
- Check backup directory size: `du -sh ~/.audiotools/backup`
- Delete old backups manually if needed

### rsync not found

```
Error: rsync command not found
```

**Solution:** rsync should be pre-installed, but if missing:
```bash
brew install rsync          # macOS
sudo apt install rsync      # Linux
```

### Permission denied

```
Error: Permission denied
```

**Solutions:**
- Verify file permissions on source directory
- For remote hosts, ensure SSH user has read access
- For local media, ensure mount point is readable

### No disk images found

```
No disk images found in source path
```

**Solutions:**
- Verify source path is correct and mounted
- Check for supported extensions: `.hds`, `.img`, `.iso`
- Ensure SD card or USB drive is properly connected
- List source directory: `ls -la /Volumes/SDCARD`

### Configuration not found

```
Error: No configuration found
Run: akai-backup config
```

**Solution:** Run `akai-backup config` to create configuration, or use flag-based `sync` command.

## Backup Strategy

### How rsync Works

rsync uses a delta-transfer algorithm to efficiently synchronize files:

1. **File comparison**: Compares source and destination using size and modification time
2. **Delta transfer**: For modified files, transfers only the changed bytes
3. **Direct writes**: Updates files in place in the backup directory
4. **Simple structure**: Files stored in regular directories, no special format

### Recommended Workflow

**For Remote PiSCSI devices:**
```bash
# Configure once
akai-backup config
# Add remote source: pi-scsi2.local:~/images/

# Regular syncs (weekly or after major changes)
akai-backup backup
```

**For Local Media (Gotek/ZuluSCSI):**
```bash
# Configure local source
akai-backup config
# Add local source: /Volumes/GOTEK

# After each session, sync the SD card
akai-backup backup s5k-gotek
```

### Accessing Backed-Up Files

Files are stored in a simple directory structure and can be accessed directly:

```bash
# Navigate to backups
cd ~/.audiotools/backup

# Copy a disk image
cp pi-scsi2/images/HD0.hds /tmp/

# Use with sampler-export
akai-export extract ~/.audiotools/backup/pi-scsi2/images/HD0.hds
```

### Storage Considerations

- **First sync**: Full copy of all files
- **Subsequent syncs**: Only changed bytes transferred
- **Storage usage**: One copy of each file (latest version)
- **No versioning**: Previous versions are overwritten
- **Manual snapshots**: Use `cp -R` or Time Machine for versioning if needed

## Related Packages

- **[@oletizi/audiotools](../audiotools-cli/README.md)** - Unified CLI for all audio-tools
- **[@oletizi/audiotools-config](../audiotools-config/README.md)** - Shared configuration system
- **[@oletizi/sampler-export](../sampler-export/README.md)** - Disk image extraction and format conversion
- **[@oletizi/sampler-devices](../sampler-devices/README.md)** - Akai device abstraction

## Documentation

- 📦 [Installation Guide](./docs/1.0/installation.md)
- 🚀 [Quick Start](./docs/1.0/quick-start.md)
- 📟 [CLI Commands](./docs/1.0/cli-commands.md)
- ⚙️ [Configuration](./docs/1.0/configuration.md)
- 💡 [Examples](./docs/1.0/examples.md)
- 📚 [API Reference](./docs/1.0/api-reference.md)
- 🔧 [Troubleshooting](./docs/1.0/troubleshooting.md)
- 📖 [Complete v1.0 Documentation](./docs/1.0/README.md)
- 🔗 [Unified CLI Guide](../docs/1.0/unified-cli/README.md)

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
- [rsync](https://rsync.samba.org/) - Fast and versatile file copying tool with delta-transfer algorithm

---

**Need Help?**

- 📖 [Documentation](./docs/1.0/README.md)
- 🐛 [Report Issues](https://github.com/yourusername/audio-tools/issues)
- 💬 [Discussions](https://github.com/yourusername/audio-tools/discussions)
