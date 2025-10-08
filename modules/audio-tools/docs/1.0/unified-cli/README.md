# Unified CLI and Configuration System

**Complete guide to the audio-tools unified CLI and configuration system.**

## Overview

The audio-tools unified CLI provides a single command (`audiotools`) for all audio-tools functionality with shared configuration across all tools. This eliminates the need for repetitive command-line flags and enables zero-configuration workflows.

### Key Features

- **Single CLI**: All tools accessible via `audiotools` command
- **Shared configuration**: `~/.audiotools/config.json` configures all tools
- **Zero-flag workflows**: Run commands without specifying options
- **Interactive setup**: User-friendly configuration wizard
- **Auto-discovery**: Automatically detect existing backups
- **Backward compatible**: Individual tool commands still work
- **Extensible**: Easy to add new tools

## Architecture

### Three-Layer Design

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: Unified CLI (@oletizi/audiotools)         │
│  - audiotools backup                                │
│  - audiotools export                                │
│  - audiotools config                                │
└───────────────────────┬─────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────┐
│ Layer 2: Shared Configuration                       │
│  (@oletizi/audiotools-config)                       │
│  - ~/.audiotools/config.json                        │
│  - CRUD operations                                  │
│  - Validation                                       │
│  - Auto-discovery                                   │
│  - Interactive wizard                               │
└───────────────────────┬─────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
┌───────▼────────┐            ┌─────────▼────────┐
│ Layer 3: Tools │            │ Layer 3: Tools   │
│ (sampler-      │            │ (sampler-        │
│  backup)       │            │  export)         │
│ - Library API  │            │ - Library API    │
│ - CLI wrapper  │            │ - CLI wrapper    │
└────────────────┘            └──────────────────┘
```

### Package Relationships

```
@oletizi/audiotools (unified CLI)
├── depends on @oletizi/audiotools-config
├── depends on @oletizi/sampler-backup
└── depends on @oletizi/sampler-export

@oletizi/audiotools-config (shared configuration)
└── provides configuration to all tools

@oletizi/sampler-backup (backup tool)
├── depends on @oletizi/audiotools-config
└── exports library API + CLI

@oletizi/sampler-export (export tool)
├── depends on @oletizi/audiotools-config
└── exports library API + CLI
```

## Installation

### Unified CLI (Recommended)

```bash
npm install -g @oletizi/audiotools
```

This installs:
- `audiotools` - Unified CLI
- `akai-backup` - Backup CLI (backward compatibility)
- `akai-export` - Export CLI (backward compatibility)

### Individual Packages

```bash
# Backup only
npm install -g @oletizi/sampler-backup

# Export only
npm install -g @oletizi/sampler-export

# Configuration library only (for development)
npm install @oletizi/audiotools-config
```

## Configuration System

### Configuration File

All configuration is stored in `~/.audiotools/config.json`:

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

### Configuration Structure

#### Backup Configuration

**`backup.backupRoot`**: Root directory for all backups
- Default: `~/.audiotools/backup`
- Backups organized as `<backupRoot>/<sampler>/<device>/`

**`backup.sources[]`**: Array of backup sources
- `name`: Unique identifier (e.g., "pi-scsi2", "s5k-gotek")
- `type`: "remote" (SSH) or "local" (mounted media)
- `source`: Source path (SSH path or local directory)
- `device`: Device identifier (e.g., "images", "floppy", "scsi0")
- `sampler`: Sampler name (optional, defaults to name)
- `enabled`: Include in backups (true/false)

#### Export Configuration

**`export.outputRoot`**: Root directory for extracted files
- Default: `~/.audiotools/sampler-export/extracted`
- Output organized as `<outputRoot>/<sampler>/<device>/`

**`export.formats`**: Output formats for conversion
- Values: `["sfz"]`, `["decentsampler"]`, or both
- Determines which sampler formats to generate

**`export.skipUnchanged`**: Skip unchanged disk images
- `true`: Only process disks modified since last extraction
- `false`: Re-process all disks every time

**`export.enabledSources`**: Sources to include in extraction
- Array of source names from `backup.sources`
- Can differ from backup enabled sources

### Interactive Configuration

#### Running the Wizard

```bash
audiotools config
# or
akai-backup config
# or
akai-export config
```

All three commands launch the same configuration wizard.

#### Wizard Flow

```
┌─────────────────────────────────────────┐
│ Audio Tools Configuration               │
├─────────────────────────────────────────┤
│                                         │
│ Step 1: Detect Existing Backups        │
│  → Scan ~/.audiotools/backup/           │
│  → Offer to import discovered sources   │
│                                         │
│ Step 2: Main Menu                       │
│  1. Manage Backup Sources               │
│  2. Configure Export Settings           │
│  3. View Current Configuration          │
│  4. Test Backup Source Connection       │
│  5. Import Existing Backups             │
│  6. Save and Exit                       │
│                                         │
└─────────────────────────────────────────┘
```

#### Managing Backup Sources

**Add Source:**
1. Choose source type (remote or local)
2. Enter source path
3. Enter device name
4. Optional: sampler name
5. Enable/disable for backups

**Edit Source:**
1. Select source from list
2. Modify any field
3. Test connection (for remote sources)

**Remove Source:**
1. Select source from list
2. Confirm removal

#### Configuring Export Settings

1. **Output formats**: Select SFZ, DecentSampler, or both
2. **Output directory**: Set custom output path
3. **Skip unchanged**: Enable/disable change detection
4. **Enabled sources**: Choose which sources to export

### Auto-Discovery

The configuration wizard can automatically discover existing backups:

```
Found existing backups:
  1. pi-scsi2/images/ (15 files, 3.2 GB)
  2. s5k-studio/floppy/ (8 files, 1.5 GB)

Import these as backup sources? (Y/n) y
```

Discovery process:
1. Scans `~/.audiotools/backup/` directory
2. Identifies sampler/device directories
3. Counts files and calculates sizes
4. Infers source type (remote vs local) from name
5. Creates backup source configurations

## Complete Workflow

### Setup: Installation and Configuration

```bash
# 1. Install unified CLI
npm install -g @oletizi/audiotools

# 2. Run configuration wizard
audiotools config

# Wizard steps:
# - Detects existing backups (if any)
# - Add backup sources
#   → Remote: pi-scsi2.local:~/images/ (device: images)
#   → Local: /Volumes/GOTEK (device: floppy, sampler: s5k-studio)
# - Configure export
#   → Formats: SFZ, DecentSampler
#   → Skip unchanged: Yes
#   → Enable sources: pi-scsi2, s5k-gotek
# - Save configuration
```

### Workflow 1: Remote PiSCSI Backup and Export

```bash
# Backup all enabled sources
audiotools backup
# → Syncs pi-scsi2.local:~/images/ to ~/.audiotools/backup/pi-scsi2/images/

# Export all enabled sources
audiotools export
# → Discovers disks in ~/.audiotools/backup/pi-scsi2/images/
# → Extracts to ~/.audiotools/sampler-export/extracted/pi-scsi2/images/
# → Converts programs to SFZ and DecentSampler
```

### Workflow 2: Local Media (Gotek/ZuluSCSI)

```bash
# Insert SD card into computer

# Backup specific source
audiotools backup s5k-gotek
# → Syncs /Volumes/GOTEK to ~/.audiotools/backup/s5k-studio/floppy/

# Export specific source
audiotools export s5k-gotek
# → Extracts disk images from backup
# → Converts to configured formats
```

### Workflow 3: Source-Specific Operations

```bash
# Backup only pi-scsi2
audiotools backup pi-scsi2

# Export only pi-scsi2
audiotools export pi-scsi2

# List all backups
akai-backup list --all

# View configuration
audiotools config --list
```

## Command Reference

### Unified CLI Commands

#### `audiotools backup [source] [options]`

Backup sampler disk images from configured sources.

**Arguments:**
- `[source]` - Optional: specific source name

**Config-based examples:**
```bash
audiotools backup                 # All enabled sources
audiotools backup pi-scsi2        # Specific source
```

**Flag-based examples (backward compatible):**
```bash
audiotools backup --source pi-scsi2.local:~/images/ --device images
audiotools backup --source /Volumes/GOTEK --device floppy --sampler s5k
```

**Options:**
- `-s, --source <path>` - Override: source path
- `-d, --device <name>` - Override: device name
- `--sampler <name>` - Override: sampler name
- `--dry-run` - Preview without executing

#### `audiotools export [source] [options]`

Extract and convert disk images from configured sources.

**Arguments:**
- `[source]` - Optional: specific source name

**Config-based examples:**
```bash
audiotools export                 # All enabled sources
audiotools export pi-scsi2        # Specific source
```

**Flag-based examples (backward compatible):**
```bash
audiotools export --input ~/disk.hds --format sfz
audiotools export --input ~/backups/ --format decentsampler --output ~/converted/
```

**Options:**
- `-i, --input <path>` - Override: input disk or directory
- `-f, --format <format>` - Override: output format
- `-o, --output <path>` - Override: output directory
- `--skip-unchanged` - Skip unchanged disks
- `--force` - Force re-extraction

#### `audiotools config [options]`

Configure audio tools.

**Examples:**
```bash
audiotools config                 # Interactive wizard
audiotools config --list          # Display configuration
audiotools config --reset         # Reset to defaults
```

**Options:**
- `--list` - Display current configuration
- `--reset` - Reset configuration to defaults
- `--path <path>` - Use custom config file path

### Individual Tool Commands

#### Backup Commands

**Config-based:**
```bash
akai-backup backup                # All enabled sources
akai-backup backup pi-scsi2       # Specific source
```

**Flag-based:**
```bash
akai-backup sync --source pi-scsi2.local:~/images/ --device images
```

**List backups:**
```bash
akai-backup list --all
akai-backup list --sampler pi-scsi2
akai-backup list --json
```

#### Export Commands

**Config-based:**
```bash
akai-export extract               # All enabled sources
akai-export extract pi-scsi2      # Specific source
```

**Flag-based:**
```bash
akai-export disk ~/disk.hds --format sfz
akai-export batch ~/backups/ --format decentsampler
```

**Other commands:**
```bash
akai-export converter sample ~/sample.a3s
akai-export converter program ~/program.a3p --format sfz
```

## Troubleshooting

### Configuration Issues

**Configuration not found:**
```
Error: No configuration found at ~/.audiotools/config.json
Run: audiotools config
```

**Solution:** Run `audiotools config` to create configuration.

**Invalid configuration:**
```
Error: Configuration validation failed:
  - backup.sources[0].name is required
  - export.formats must be non-empty array
```

**Solution:** Run `audiotools config` to fix, or edit `~/.audiotools/config.json` manually.

### Source Issues

**Source not found:**
```
Error: Source not found: pi-scsi2
Available sources: s5k-gotek, s3k-studio
```

**Solution:** Check source name with `audiotools config --list` or add source with `audiotools config`.

**No enabled sources:**
```
Warning: No backup sources enabled
Please enable at least one source in configuration
```

**Solution:** Run `audiotools config` and enable sources.

### Connection Issues

**SSH connection failed:**
```
Error: Failed to connect to pi-scsi2.local
```

**Solution:**
1. Test SSH connection: `ssh pi-scsi2.local`
2. Verify hostname in configuration
3. Check SSH keys are set up
4. Use wizard's "Test Connection" feature

**Local media not found:**
```
Error: Source path does not exist: /Volumes/GOTEK
```

**Solution:**
1. Verify media is mounted: `ls /Volumes/`
2. Update source path in configuration
3. Check media is properly connected

### Command Not Found

```
audiotools: command not found
```

**Solution:**
1. Verify installation: `npm list -g @oletizi/audiotools`
2. Check npm global bin: `npm bin -g`
3. Ensure npm global bin in PATH
4. Reinstall: `npm install -g @oletizi/audiotools`

## Migration Guide

### From Individual Tools

If you previously used `@oletizi/sampler-backup` or `@oletizi/sampler-export`:

#### Option 1: Keep Using Individual Commands

No migration needed. Individual commands still work:

```bash
akai-backup sync --source pi-scsi2.local:~/images/ --device images
akai-export extract ~/disk.hds --format sfz
```

#### Option 2: Adopt Unified CLI

1. **Install unified CLI:**
   ```bash
   npm install -g @oletizi/audiotools
   ```

2. **Configure:**
   ```bash
   audiotools config
   # Wizard will detect existing backups and import them
   ```

3. **Use new commands:**
   ```bash
   audiotools backup
   audiotools export
   ```

#### Option 3: Hybrid Approach

Use both as needed:

```bash
# Regular workflows: config-based
audiotools backup
audiotools export

# One-off tasks: flag-based
akai-backup sync --source other-host:~/path/ --device test
akai-export disk ~/special-disk.hds --format sfz
```

### From Flag-Based Workflows

**Before (flag-based):**
```bash
akai-backup sync --source pi-scsi2.local:~/images/ --device images
akai-backup sync --source /Volumes/GOTEK --device floppy --sampler s5k

akai-export extract ~/backups/pi-scsi2/ --format sfz
akai-export extract ~/backups/s5k-studio/ --format decentsampler
```

**After (config-based):**
```bash
# One-time setup
audiotools config
# Add sources:
#  - pi-scsi2: pi-scsi2.local:~/images/, device: images
#  - s5k-gotek: /Volumes/GOTEK, device: floppy, sampler: s5k-studio
# Configure export:
#  - Formats: sfz, decentsampler
#  - Enable sources: pi-scsi2, s5k-gotek

# Regular usage (no flags!)
audiotools backup
audiotools export
```

## Adding New Tools

The unified configuration system is designed for extensibility. Future tools can integrate easily.

### For Tool Developers

**1. Define configuration type:**

```typescript
// my-tool/src/types.ts
export interface MyToolConfig {
  setting1: string;
  setting2: number;
  enabled: boolean;
}
```

**2. Add to unified config:**

The configuration system supports arbitrary tool configs:

```typescript
// ~/.audiotools/config.json
{
  "version": "1.0",
  "backup": { /* ... */ },
  "export": { /* ... */ },
  "myTool": {
    "setting1": "value",
    "setting2": 42,
    "enabled": true
  }
}
```

**3. Load configuration in tool:**

```typescript
import { loadConfig, getToolConfig } from '@oletizi/audiotools-config';

const config = await loadConfig();
const myConfig = getToolConfig<MyToolConfig>(config, 'myTool');

if (!myConfig) {
  console.error('Not configured. Run: audiotools config');
  process.exit(1);
}

// Use myConfig...
```

**4. Add wizard support (optional):**

```typescript
import { loadConfig, saveConfig, setToolConfig } from '@oletizi/audiotools-config';
import inquirer from 'inquirer';

export async function configureMyTool() {
  const config = await loadConfig();

  const answers = await inquirer.prompt([
    { type: 'input', name: 'setting1', message: 'Enter setting1:' },
    { type: 'number', name: 'setting2', message: 'Enter setting2:' },
  ]);

  const myConfig: MyToolConfig = {
    setting1: answers.setting1,
    setting2: answers.setting2,
    enabled: true,
  };

  const updated = setToolConfig(config, 'myTool', myConfig);
  await saveConfig(updated);
}
```

**5. Register with unified CLI:**

```typescript
// audiotools-cli/src/commands/my-tool.ts
import { Command } from 'commander';
import { loadConfig, getToolConfig } from '@oletizi/audiotools-config';

export const myToolCommand = new Command('my-tool')
  .description('Run my tool')
  .action(async () => {
    const config = await loadConfig();
    const toolConfig = getToolConfig<MyToolConfig>(config, 'myTool');

    if (!toolConfig) {
      console.error('Not configured. Run: audiotools config');
      process.exit(1);
    }

    // Run tool with toolConfig...
  });

// audiotools-cli/src/index.ts
import { myToolCommand } from './commands/my-tool.js';
program.addCommand(myToolCommand);
```

Now users can:
```bash
audiotools config       # Configure my-tool
audiotools my-tool      # Run my-tool
```

## Best Practices

### Configuration Management

**DO:**
- Use the interactive wizard for initial setup
- Test connections after configuration changes
- Enable only sources you actively use
- Use descriptive source names (e.g., "pi-scsi2", "s5k-gotek")

**DON'T:**
- Manually edit configuration without validation
- Use spaces in source names (use hyphens or underscores)
- Enable all sources for export if you only need some

### Workflow Patterns

**Regular backups:**
```bash
# Daily/weekly automated backups
audiotools backup
```

**After sampler session:**
```bash
# Backup then export immediately
audiotools backup && audiotools export
```

**Source-specific operations:**
```bash
# Only backup changed source
audiotools backup s5k-gotek

# Only export that source
audiotools export s5k-gotek
```

**One-off tasks:**
```bash
# Use flags for special cases
akai-export disk ~/special-disk.hds --format sfz --output ~/special/
```

### Automation and Scripting

**Scheduled backups (cron):**
```bash
# Daily at 2 AM
0 2 * * * /usr/local/bin/audiotools backup

# Weekly export on Sunday at 3 AM
0 3 * * 0 /usr/local/bin/audiotools export
```

**Backup script:**
```bash
#!/bin/bash
# backup-and-extract.sh

set -e

echo "Starting backup..."
audiotools backup

echo "Starting extraction..."
audiotools export

echo "Complete!"
ls -lh ~/.audiotools/backup/
ls -lh ~/.audiotools/sampler-export/extracted/
```

## Performance and Optimization

### Backup Performance

**rsync efficiency:**
- First backup: Full transfer (can be slow for large disks)
- Subsequent backups: Only changed bytes (very fast)
- Network: SSH compression reduces bandwidth usage

**Tips:**
- Run backups during off-peak hours for large transfers
- Use `--dry-run` to preview changes before syncing
- Consider backup frequency based on usage patterns

### Export Performance

**Change detection:**
- Enable `skipUnchanged: true` to avoid re-processing
- Tracks modification times of disk images
- Significantly faster for incremental exports

**Batch processing:**
- Processes multiple sources in sequence
- Aggregates statistics across all sources
- Continues on error (doesn't stop on single disk failure)

**Tips:**
- Enable skip unchanged for regular exports
- Use `--force` only when necessary
- Export only needed sources (disable others)

## Security Considerations

### SSH Keys

**Setup password-less authentication:**
```bash
# Generate SSH key (if needed)
ssh-keygen -t ed25519

# Copy to remote host
ssh-copy-id pi@pi-scsi2.local

# Test connection
ssh pi@pi-scsi2.local
```

**Benefits:**
- No password prompts during automated backups
- More secure than password authentication
- Required for cron jobs and scripts

### Configuration File Permissions

The configuration file may contain sensitive paths:

```bash
# Ensure proper permissions
chmod 600 ~/.audiotools/config.json

# Check permissions
ls -la ~/.audiotools/config.json
```

### Backup Storage

**Recommendations:**
- Store backups on encrypted volumes
- Regular backups of `~/.audiotools/` directory
- Consider off-site backup of extracted samples

## Support and Resources

### Documentation

- **[audiotools-config README](../../audiotools-config/README.md)** - Configuration API
- **[audiotools CLI README](../../audiotools-cli/README.md)** - Unified CLI
- **[sampler-backup README](../../sampler-backup/README.md)** - Backup tool
- **[sampler-export README](../../sampler-export/README.md)** - Export tool

### Getting Help

- **Issues**: [GitHub Issues](https://github.com/oletizi/ol_dsp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/oletizi/ol_dsp/discussions)
- **Documentation**: [ol_dsp/modules/audio-tools](https://github.com/oletizi/ol_dsp/tree/main/modules/audio-tools)

### Contributing

Contributions welcome! See [CONTRIBUTING.md](../../../CONTRIBUTING.md) for:
- Development setup
- Code quality standards
- Pull request process
- Adding new tools

## License

Apache-2.0

## Credits

**Author:** Orion Letizi

**Packages:**
- [@oletizi/audiotools](../../audiotools-cli/) - Unified CLI
- [@oletizi/audiotools-config](../../audiotools-config/) - Configuration system
- [@oletizi/sampler-backup](../../sampler-backup/) - Backup tool
- [@oletizi/sampler-export](../../sampler-export/) - Export tool
