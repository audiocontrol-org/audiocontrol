# CLI Commands

## `akai-backup backup`

Run backup from remote hosts or local media using BorgBackup + SSHFS.

```bash
akai-backup backup [interval] [options]
```

**Arguments:**
- `interval` - Backup interval: `daily`, `weekly`, `monthly` (default: `daily`)

**Options:**
- `-s, --source <path>` - Override default sources with specific path (local or remote SSH)
- `--subdir <name>` - Backup subdirectory name (default: auto-generated from source)

**Examples:**
```bash
# Backup from default sources (pi-scsi2.local)
akai-backup backup

# Daily backup (explicit)
akai-backup backup daily

# Weekly backup
akai-backup backup weekly

# Backup from custom SSH host
akai-backup backup --source pi@myhost:/path/to/images

# Backup from local SD card
akai-backup backup --source /Volumes/SDCARD

# Backup with custom subdirectory name
akai-backup backup --source /Volumes/GOTEK --subdir gotek-s3000xl
```

## `akai-backup batch`

Run daily backup from default sources. Alias for `backup daily`.

```bash
akai-backup batch [options]
```

**Options:**
- `-s, --source <path>` - Override default sources with specific path
- `--subdir <name>` - Backup subdirectory name (default: auto-generated from source)

**Examples:**
```bash
# Quick daily backup from defaults
akai-backup batch

# Perfect for cron jobs or scheduled tasks
0 2 * * * /usr/local/bin/akai-backup batch
```

## `akai-backup list`

List all backup archives in repository.

```bash
akai-backup list [options]
```

**Options:**
- `--json` - Output in JSON format

**Examples:**
```bash
# List all archives (human-readable)
akai-backup list

# List archives in JSON format
akai-backup list --json
```

**Output:**
```
Found 3 archive(s):

  daily-2025-10-06-pi-scsi2
    Date: 2025-10-06T21:17:49.000Z
    Files: 8
    Original size: 21.54 GB
    Compressed size: 18.23 GB
    Deduplicated size: 18.23 GB
    Compression ratio: 15.4%
    Deduplication ratio: 15.4%

  daily-2025-10-07-pi-scsi2
    Date: 2025-10-07T00:43:49.000Z
    Files: 8
    Original size: 21.55 GB
    Compressed size: 18.24 GB
    Deduplicated size: 0.42 MB
    Compression ratio: 15.3%
    Deduplication ratio: 99.9%
```

## `akai-backup info`

Show repository statistics and information.

```bash
akai-backup info
```

**Output:**
```
Repository Information:
  Path: /Users/orion/.audiotools/borg-repo
  ID: a3f8b9c2...
  Last modified: 2025-10-07T00:45:30.000Z
  Encryption: none

Statistics:
  Total archives: 3
  Original size: 64.63 GB
  Compressed size: 54.71 GB
  Deduplicated size: 18.65 GB
  Compression ratio: 15.4%
  Space saved by deduplication: 71.2%
```

## `akai-backup restore`

Restore a specific archive to destination directory.

```bash
akai-backup restore <archive> <destination>
```

**Arguments:**
- `archive` - Archive name to restore (use `list` to see available archives)
- `destination` - Destination directory for restored files

**Examples:**
```bash
# Restore specific archive
akai-backup restore daily-2025-10-06-pi-scsi2 ~/restored-files

# Restore to current directory
akai-backup restore daily-2025-10-06-pi-scsi2 .
```

## `akai-backup check`

Verify repository integrity and consistency.

```bash
akai-backup check
```

**Example:**
```bash
# Check repository
akai-backup check
```

**Output:**
```
Checking repository integrity...
This may take a while for large repositories.

✓ Repository check passed - no errors found
```

## `akai-backup prune`

Manually prune old archives based on retention policy.

```bash
akai-backup prune [options]
```

**Options:**
- `--daily <n>` - Keep last N daily backups (default: 7)
- `--weekly <n>` - Keep last N weekly backups (default: 4)
- `--monthly <n>` - Keep last N monthly backups (default: 12)

**Examples:**
```bash
# Prune with default policy
akai-backup prune

# Custom retention policy
akai-backup prune --daily 14 --weekly 8 --monthly 24
```

**Note:** Pruning is automatically run after each backup, so manual pruning is rarely needed.

## Deprecated Commands

The following commands are deprecated and no longer available:

### `akai-backup config` (REMOVED)

**Reason:** rsnapshot has been replaced with BorgBackup. Configuration is no longer needed.

**Migration:** Use `--source` flag instead:
```bash
# Old way
akai-backup config  # Edit ~/.audiotools/rsnapshot.conf
akai-backup backup

# New way
akai-backup backup --source pi@host:/path
```

### `akai-backup test` (REMOVED)

**Reason:** rsnapshot configuration testing is no longer applicable.

**Migration:** Use `akai-backup check` to verify repository integrity instead.

## Default Sources

By default, `akai-backup` backs up from:

- `pi-scsi2.local:/home/orion/images/`

Override with `--source` flag for custom sources.

## Repository Location

- **Default:** `~/.audiotools/borg-repo/`

## See Also

- [Quick Start](./quick-start.md) - Get started in 5 minutes
- [Examples](./examples.md) - Common backup scenarios
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
