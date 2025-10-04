# @oletizi/sampler-backup

Rsnapshot-based backup utility for Akai hardware samplers via PiSCSI. Provides automated, incremental backups with intelligent same-day resume capability.

## Features

- **Rsnapshot-powered backups**: Leverages rsnapshot for space-efficient incremental backups
- **Smart rotation logic**: Automatically resumes same-day backups instead of creating duplicates
- **Hard-linking**: Multiple snapshots share unchanged files, minimizing disk usage
- **Configurable retention**: 7 daily, 4 weekly, 12 monthly snapshots (configurable)
- **SSH-based transfer**: Secure remote backup via rsync over SSH
- **Partial transfer resume**: Interrupted transfers resume from where they left off

## Installation

```bash
# Install from the audio-tools monorepo
pnpm install

# Build the package
pnpm --filter sampler-backup build
```

## Quick Start

```bash
# Generate rsnapshot configuration
akai-backup config --test

# Run daily backup
akai-backup batch

# Or manually specify interval
akai-backup backup daily
```

## CLI Commands

### `akai-backup config`

Generate rsnapshot configuration file.

```bash
akai-backup config [options]
```

**Options:**
- `-c, --config <path>` - Config file path (default: `~/.audiotools/rsnapshot.conf`)
- `--test` - Test the configuration after generating

**Example:**
```bash
# Generate and test configuration
akai-backup config --test
```

### `akai-backup test`

Test rsnapshot configuration validity.

```bash
akai-backup test [options]
```

**Options:**
- `-c, --config <path>` - Config file path (default: `~/.audiotools/rsnapshot.conf`)

### `akai-backup backup`

Run rsnapshot backup with specified interval.

```bash
akai-backup backup [interval] [options]
```

**Arguments:**
- `interval` - Backup interval: `daily`, `weekly`, `monthly` (default: `daily`)

**Options:**
- `-c, --config <path>` - Config file path (default: `~/.audiotools/rsnapshot.conf`)

**Example:**
```bash
# Run daily backup
akai-backup backup daily

# Run weekly backup
akai-backup backup weekly
```

### `akai-backup batch`

Alias for `backup daily`. Designed for easy one-click operation.

```bash
akai-backup batch [options]
```

**Options:**
- `-c, --config <path>` - Config file path (default: `~/.audiotools/rsnapshot.conf`)

## Smart Rotation Logic

The backup system intelligently handles multiple invocations per day:

**Same-day behavior:**
- Checks if `daily.0` snapshot is from today
- **Resumes backup in-place** without rotation
- Rsync's `--partial` flag enables resuming interrupted transfers
- No duplicate partial files are created

**Next-day behavior:**
- Detects snapshot is from previous day
- **Rotates snapshots**: `daily.0` → `daily.1`, etc.
- Creates fresh `daily.0` for new backup
- Hard-links unchanged files from previous snapshot

This design allows you to run `akai-backup batch` multiple times throughout the day - it will always resume where it left off.

## Configuration

Default configuration is generated at `~/.audiotools/rsnapshot.conf`:

```conf
snapshot_root    /Users/you/.audiotools/backup/

# Retention policy
retain    daily    7
retain    weekly   4
retain    monthly  12

# Backup sources
backup    pi-scsi2.local:/home/orion/images/    pi-scsi2/
```

### Customizing Backup Sources

Edit the configuration file to add or modify backup sources:

```typescript
import { getDefaultRsnapshotConfig, writeRsnapshotConfig } from '@oletizi/sampler-backup';

const config = getDefaultRsnapshotConfig();

// Add S3000XL sampler
config.samplers.push({
    type: "s3k",
    host: "pi-scsi3.local",
    sourcePath: "/home/orion/images/",
    backupSubdir: "pi-scsi3"
});

writeRsnapshotConfig(config, '~/.audiotools/rsnapshot.conf');
```

## Directory Structure

Rsnapshot creates time-based snapshot directories:

```
~/.audiotools/backup/
├── daily.0/           # Most recent daily snapshot (today)
│   └── pi-scsi2/
│       └── home/orion/images/
│           ├── HD0.hds
│           ├── HD1.hds
│           └── ...
├── daily.1/           # Yesterday's snapshot
├── daily.2/           # 2 days ago
├── ...
├── daily.6/           # 6 days ago
├── weekly.0/          # Most recent weekly snapshot
├── weekly.1/
├── ...
└── monthly.0/         # Most recent monthly snapshot
```

**Space efficiency:** Files that haven't changed between snapshots are hard-linked, not duplicated. A 22GB disk image might only consume 22GB total across all snapshots if unchanged.

## Retention Policy

Default retention:
- **7 daily snapshots** (last 7 days)
- **4 weekly snapshots** (last 4 weeks)
- **12 monthly snapshots** (last year)

Retention rotates automatically when running different intervals:
- `akai-backup backup daily` - Rotates daily snapshots
- `akai-backup backup weekly` - Promotes daily.6 → weekly.0
- `akai-backup backup monthly` - Promotes weekly.3 → monthly.0

## Integration with sampler-export

This package is designed to work seamlessly with `@oletizi/sampler-export`:

```bash
# One-click backup and extract workflow
pnpm backup-and-extract
```

This command:
1. Runs `akai-backup batch` to create/update snapshots
2. Runs `akai-extract batch` to extract disk images from `daily.0`

## Programmatic Usage

```typescript
import { runBackup, getLatestSnapshotDir } from '@oletizi/sampler-backup';

// Run daily backup
const result = await runBackup({
    interval: 'daily',
    configPath: '~/.audiotools/rsnapshot.conf'
});

if (result.success) {
    console.log('Backup completed successfully');

    // Get latest snapshot directory
    const latestSnapshot = getLatestSnapshotDir(result.snapshotPath, 'daily');
    console.log(`Latest snapshot: ${latestSnapshot}`);
}
```

## Requirements

- **rsnapshot** - Install via Homebrew: `brew install rsnapshot`
- **rsync** - Usually pre-installed on macOS/Linux
- **SSH access** to PiSCSI host
- **Node.js** >= 18

## Troubleshooting

**"rsnapshot command not found":**
```bash
brew install rsnapshot
```

**"Source directory doesn't exist":**
- Verify SSH access: `ssh pi-scsi2.local`
- Check remote path: `ssh pi-scsi2.local "ls ~/images/"`
- Update sourcePath in configuration if needed

**Partial transfers not resuming:**
- Ensure you're using `akai-backup batch` (not raw rsnapshot)
- The smart rotation logic only works when invoked via this CLI

## License

Apache-2.0
