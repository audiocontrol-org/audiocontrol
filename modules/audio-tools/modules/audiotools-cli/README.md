# @oletizi/audiotools

**Unified CLI for audio-tools - backup, extract, and convert Akai sampler data.**

## Purpose

The `audiotools` package provides a single command-line interface for all audio-tools functionality. It unifies the backup, export, and configuration tools under one command with consistent subcommands and shared configuration.

## Features

- **Single CLI**: All tools accessible via `audiotools` command
- **Unified configuration**: Configure once, use everywhere
- **Zero-flag workflows**: Run backups and exports without specifying flags
- **Interactive setup**: User-friendly wizard for configuration
- **Backward compatible**: Existing tool-specific commands still work
- **Extensible**: Easy to add new tools as subcommands

## Installation

### Recommended: Global Installation

```bash
npm install -g @oletizi/audiotools
```

This installs:
- `audiotools` - Unified CLI command
- `akai-backup` - Standalone backup CLI (for backward compatibility)
- `akai-export` - Standalone export CLI (for backward compatibility)

### Verify Installation

```bash
audiotools --version
audiotools --help
```

## Quick Start

### 1. Configure Audio Tools

Run the interactive configuration wizard:

```bash
audiotools config
```

The wizard will:
1. **Detect existing backups** and offer to import them
2. **Add backup sources** (remote SSH devices or local media)
3. **Configure export settings** (output formats, paths)
4. **Validate configuration** (test SSH connections, check paths)
5. **Save to** `~/.audiotools/config.json`

### 2. Run Backups

```bash
# Backup all enabled sources
audiotools backup

# Backup specific source
audiotools backup pi-scsi2

# Override with flags (backward compatible)
audiotools backup --source pi-scsi2.local:~/images/ --device images
```

### 3. Extract and Convert

```bash
# Extract all enabled sources
audiotools export

# Extract specific source
audiotools export s5k-studio

# Override with flags (backward compatible)
audiotools export --input ~/disk.hds --format sfz
```

## Available Commands

### `audiotools backup [source] [options]`

Backup sampler disk images from remote devices or local media.

**Arguments:**
- `[source]` - Optional: Specific source name to backup (from config)

**Options:**
- `-s, --source <path>` - Override: source path (SSH or local)
- `-d, --device <name>` - Override: device name
- `--sampler <name>` - Override: sampler name
- `--dry-run` - Show what would be backed up without running

**Examples:**

```bash
# Config-based workflows (no flags needed)
audiotools backup                 # Backup all enabled sources
audiotools backup pi-scsi2        # Backup specific source by name
audiotools backup s5k-gotek       # Backup local media source

# Flag-based workflows (backward compatible)
audiotools backup --source pi-scsi2.local:~/images/ --device images
audiotools backup --source /Volumes/GOTEK --device floppy --sampler s5k

# Dry run
audiotools backup pi-scsi2 --dry-run
```

**How it Works:**

1. **Config-based**: If no `--source` flag, loads sources from `~/.audiotools/config.json`
2. **Filters**: Processes only enabled sources (unless specific source named)
3. **Executes**: Runs rsync backup for each source
4. **Reports**: Shows summary of backed up files and sizes

### `audiotools export [source] [options]`

Extract and convert disk images to modern formats.

**Arguments:**
- `[source]` - Optional: Specific source name to export (from config)

**Options:**
- `-i, --input <path>` - Override: input disk image or directory
- `-f, --format <format>` - Override: output format (sfz, decentsampler)
- `-o, --output <path>` - Override: output directory
- `--skip-unchanged` - Skip disk images that haven't changed
- `--force` - Force re-extraction of unchanged disks

**Examples:**

```bash
# Config-based workflows (no flags needed)
audiotools export                  # Export all enabled sources
audiotools export pi-scsi2         # Export specific source by name
audiotools export s5k-studio       # Export specific sampler

# Flag-based workflows (backward compatible)
audiotools export --input ~/disk.hds --format sfz
audiotools export --input ~/backups/ --format decentsampler
audiotools export --input disk.hds --format sfz --output ~/converted/

# With options
audiotools export pi-scsi2 --skip-unchanged
audiotools export --input ~/disk.hds --format sfz,decentsampler
```

**How it Works:**

1. **Config-based**: If no `--input` flag, loads sources from `~/.audiotools/config.json`
2. **Discovery**: Finds disk images in backup directories for each source
3. **Change detection**: Skips unchanged disks (if `skipUnchanged: true` in config)
4. **Extraction**: Extracts disk contents (native Akai or DOS/FAT32)
5. **Conversion**: Converts programs to SFZ/DecentSampler, samples to WAV
6. **Reports**: Shows summary of extracted disks and converted files

### `audiotools config [options]`

Configure audio tools interactively or display/reset configuration.

**Options:**
- `--list` - Display current configuration
- `--reset` - Reset configuration to defaults
- `--path <path>` - Use custom config file path

**Examples:**

```bash
# Interactive wizard (recommended)
audiotools config

# Display current configuration
audiotools config --list

# Reset to defaults
audiotools config --reset

# Use custom config location
audiotools config --path ~/my-config.json
```

**Interactive Wizard Menu:**

```
┌─────────────────────────────────────────┐
│ Audio Tools Configuration               │
├─────────────────────────────────────────┤
│ 1. Manage Backup Sources                │
│ 2. Configure Export Settings            │
│ 3. View Current Configuration           │
│ 4. Test Backup Source Connection        │
│ 5. Import Existing Backups              │
│ 6. Save and Exit                        │
└─────────────────────────────────────────┘
```

**Manage Backup Sources** allows you to:
- Add new backup source (remote SSH or local media)
- Edit existing source
- Enable/disable sources
- Remove sources
- Test SSH connections

**Configure Export Settings** allows you to:
- Set output formats (SFZ, DecentSampler)
- Choose output directory
- Enable/disable sources for export
- Configure change detection

## Configuration

### Configuration File Location

`~/.audiotools/config.json`

This single file configures all audio-tools packages.

### Configuration Structure

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
        "sampler": "pi-scsi2",
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
  },
  "export": {
    "outputRoot": "~/.audiotools/sampler-export/extracted",
    "formats": ["sfz", "decentsampler"],
    "skipUnchanged": true,
    "enabledSources": ["pi-scsi2", "s5k-gotek"]
  }
}
```

### Configuration Fields

**Backup Configuration:**
- `backupRoot`: Root directory for all backups (default: `~/.audiotools/backup`)
- `sources`: Array of backup sources
  - `name`: Unique identifier for this source
  - `type`: `"remote"` (SSH) or `"local"` (mounted media)
  - `source`: Source path (e.g., `"host:path/"` or `"/Volumes/MEDIA"`)
  - `device`: Device identifier (e.g., `"images"`, `"floppy"`, `"scsi0"`)
  - `sampler`: Sampler name (optional, defaults to source name)
  - `enabled`: Whether to include in backups

**Export Configuration:**
- `outputRoot`: Root directory for extracted files
- `formats`: Output formats - `["sfz"]`, `["decentsampler"]`, or both
- `skipUnchanged`: Skip disk images that haven't changed since last extraction
- `enabledSources`: Source names to include in exports

### Manual Configuration Editing

You can edit `~/.audiotools/config.json` directly:

```bash
# Open in your editor
nano ~/.audiotools/config.json
# or
vim ~/.audiotools/config.json
# or
code ~/.audiotools/config.json
```

After editing, validate with:

```bash
audiotools config --list
```

## Workflows

### Complete Workflow: Setup → Backup → Extract

```bash
# 1. Install
npm install -g @oletizi/audiotools

# 2. Configure
audiotools config
# - Add backup source (e.g., pi-scsi2.local:~/images/)
# - Configure export formats (SFZ, DecentSampler)
# - Enable sources for export

# 3. Backup
audiotools backup
# Backs up all enabled sources to ~/.audiotools/backup/

# 4. Extract and Convert
audiotools export
# Extracts disks and converts to SFZ/DecentSampler
# Output: ~/.audiotools/sampler-export/extracted/
```

### Ongoing Workflow

```bash
# Regular backups (run daily, weekly, etc.)
audiotools backup

# Extract new or changed disks
audiotools export
# (automatically skips unchanged disks if skipUnchanged: true)
```

### Source-Specific Workflow

```bash
# Add multiple sources with different purposes
audiotools config
# - pi-scsi2: Remote SCSI device (always enabled)
# - s5k-gotek: Gotek floppy (enabled when SD card inserted)
# - s3k-zulu: ZuluSCSI (enabled when SD card inserted)

# Backup specific source
audiotools backup s5k-gotek

# Export specific source
audiotools export s5k-gotek

# Or use all enabled
audiotools backup  # Backs up all enabled sources
audiotools export  # Exports all enabled sources
```

### Flag-Based Workflow (One-Off Tasks)

```bash
# No configuration needed for one-off tasks
audiotools backup --source pi-scsi2.local:~/images/ --device images
audiotools export --input ~/disk.hds --format sfz --output ~/converted/
```

## Migration from Individual Tools

If you previously used `@oletizi/sampler-backup` or `@oletizi/sampler-export` individually:

### Option 1: Continue Using Existing Commands

The individual tool commands still work exactly as before:

```bash
# These continue to work
akai-backup sync --source pi-scsi2.local:~/images/ --device images
akai-export extract ~/disk.hds --format sfz
```

### Option 2: Migrate to Unified CLI

1. **Install unified CLI:**
   ```bash
   npm install -g @oletizi/audiotools
   ```

2. **Import existing backups:**
   ```bash
   audiotools config
   # Select "Import Existing Backups"
   # Wizard will detect your backup structure and import it
   ```

3. **Use new commands:**
   ```bash
   # Instead of: akai-backup sync --source ... --device ...
   audiotools backup

   # Instead of: akai-export extract ... --format ...
   audiotools export
   ```

### Option 3: Hybrid Approach

Use both styles as needed:

```bash
# Use config for regular workflows
audiotools backup
audiotools export

# Use flags for one-off tasks
akai-backup sync --source other-host:~/path/ --device test
akai-export extract ~/special-disk.hds --format sfz
```

## Command Reference

### Global Options

All commands support:
- `-h, --help` - Show help for command
- `-V, --version` - Show version number

### Help System

```bash
# Top-level help
audiotools --help

# Command-specific help
audiotools backup --help
audiotools export --help
audiotools config --help
```

### Exit Codes

- `0` - Success
- `1` - General error (invalid config, missing source, etc.)
- `2` - Validation error (invalid configuration)

## Troubleshooting

### Configuration Not Found

```
Error: No configuration found at ~/.audiotools/config.json
Run: audiotools config
```

**Solution:** Run `audiotools config` to create configuration.

### Source Not Found

```
Error: Source not found: pi-scsi2
Available sources: s5k-gotek, s3k-studio
```

**Solution:** Check source name in config with `audiotools config --list` or use `audiotools config` to add the source.

### No Enabled Sources

```
Warning: No backup sources enabled
Please enable at least one source in configuration
```

**Solution:** Run `audiotools config` and enable sources, or use flag-based workflow.

### SSH Connection Failed

```
Error: Failed to connect to pi-scsi2.local
```

**Solution:**
1. Test connection manually: `ssh pi-scsi2.local`
2. Check hostname is correct in config
3. Ensure SSH keys are set up
4. Use `audiotools config` → "Test Backup Source Connection"

### Invalid Configuration

```
Error: Configuration validation failed:
  - backup.sources[0].name is required
  - export.formats must be non-empty array
```

**Solution:**
1. Run `audiotools config --list` to see current config
2. Fix manually or run `audiotools config` to reconfigure
3. Or reset: `audiotools config --reset`

### Command Not Found

```
audiotools: command not found
```

**Solution:**
1. Ensure installed globally: `npm install -g @oletizi/audiotools`
2. Check npm global bin path: `npm bin -g`
3. Ensure npm global bin is in PATH

## Advanced Usage

### Custom Configuration Location

```bash
# Use custom config file
export AUDIOTOOLS_CONFIG=~/my-config.json
audiotools config
audiotools backup
audiotools export

# Or use --path flag
audiotools config --path ~/my-config.json
```

### Programmatic Usage

The CLI can be used programmatically:

```typescript
import { backupCommand } from '@oletizi/audiotools/commands/backup';
import { exportCommand } from '@oletizi/audiotools/commands/export';

// Execute backup programmatically
await backupCommand.parseAsync(['node', 'audiotools', 'backup', 'pi-scsi2']);

// Execute export programmatically
await exportCommand.parseAsync(['node', 'audiotools', 'export', '--format', 'sfz']);
```

### Scripting

```bash
#!/bin/bash
# backup-and-extract.sh

# Backup all sources
audiotools backup

# Extract changed disks
audiotools export

# Show summary
echo "Backup and extraction complete"
ls -lh ~/.audiotools/backup/
ls -lh ~/.audiotools/sampler-export/extracted/
```

### CI/CD Integration

```yaml
# .github/workflows/backup.yml
name: Backup Samplers
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install audiotools
        run: npm install -g @oletizi/audiotools

      - name: Setup config
        run: |
          mkdir -p ~/.audiotools
          echo '${{ secrets.AUDIOTOOLS_CONFIG }}' > ~/.audiotools/config.json

      - name: Run backup
        run: audiotools backup

      - name: Run export
        run: audiotools export

      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: sampler-backups
          path: ~/.audiotools/backup/
```

## Package Contents

This package includes:
- **Unified CLI**: `audiotools` command with subcommands
- **Configuration library**: `@oletizi/audiotools-config` (dependency)
- **Backup tool**: `@oletizi/sampler-backup` (dependency)
- **Export tool**: `@oletizi/sampler-export` (dependency)

## Architecture

```
@oletizi/audiotools (this package)
├── commands/
│   ├── backup.ts    → delegates to @oletizi/sampler-backup
│   ├── export.ts    → delegates to @oletizi/sampler-export
│   └── config.ts    → delegates to @oletizi/audiotools-config
├── index.ts         → CLI entry point
└── dependencies:
    ├── @oletizi/audiotools-config  → Shared configuration
    ├── @oletizi/sampler-backup     → Backup functionality
    └── @oletizi/sampler-export     → Export functionality
```

## Related Packages

- **[@oletizi/audiotools-config](../audiotools-config/README.md)** - Configuration library
- **[@oletizi/sampler-backup](../sampler-backup/README.md)** - Backup functionality
- **[@oletizi/sampler-export](../sampler-export/README.md)** - Export functionality

## Documentation

- **[Unified CLI Guide](../docs/1.0/unified-cli/README.md)** - Complete guide to the unified CLI system
- **[Installation Guide](../docs/1.0/INSTALLATION.md)** - Detailed installation instructions
- **[Backup Documentation](../sampler-backup/README.md)** - Backup tool details
- **[Export Documentation](../sampler-export/README.md)** - Export tool details

## Version History

- **1.0.0** - Initial release of unified CLI
  - Single command interface for backup and export
  - Unified configuration system
  - Interactive configuration wizard
  - Backward compatible with individual tools

## License

Apache-2.0

## Repository

Part of the [ol_dsp](https://github.com/oletizi/ol_dsp) monorepo.

## Author

Orion Letizi

## Support

- **Issues**: [GitHub Issues](https://github.com/oletizi/ol_dsp/issues)
- **Documentation**: [ol_dsp/modules/audio-tools](https://github.com/oletizi/ol_dsp/tree/main/modules/audio-tools)
