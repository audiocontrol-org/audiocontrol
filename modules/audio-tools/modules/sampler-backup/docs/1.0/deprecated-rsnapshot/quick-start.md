# Quick Start

Get your first backup running in 5 minutes.

## Prerequisites

Ensure you have installed:

- BorgBackup
- SSHFS (for remote backups)
- macFUSE (macOS only)

See [Installation](./installation.md) for details.

## First Backup

### Remote Backup (Default)

```bash
# Run daily backup from default sources
akai-backup batch

# This backs up from:
#   - pi-scsi2.local:/home/orion/images/
#
# To local BorgBackup repository:
#   ~/.audiotools/borg-repo
```

The backup:
1. Mounts remote directory via SSHFS
2. Backs up with BorgBackup (chunk-level deduplication)
3. Unmounts SSHFS
4. Prunes old archives based on retention policy

### Custom Remote Source

```bash
# Backup from specific SSH host
akai-backup backup --source pi@myhost:/path/to/images
```

### Local Media Backup

```bash
# Backup from SD card or USB drive
akai-backup backup --source /Volumes/SDCARD
```

## View Backups

```bash
# List all backup archives
akai-backup list

# Show repository statistics
akai-backup info
```

## Verify Backup

```bash
# Check repository integrity
akai-backup check
```

## Restore Files

```bash
# List available archives
akai-backup list

# Restore specific archive
akai-backup restore daily-2025-10-06-pi-scsi2 ~/restored-files
```

## What Just Happened?

When you run `akai-backup batch`:

1. **SSHFS Mount**: Remote directory is mounted locally (e.g., to `/tmp/akai-backup/pi-scsi2-local`)
2. **Borg Backup**: BorgBackup reads mounted path, chunks and deduplicates data
3. **Incremental Storage**: Only changed chunks are stored in local repository
4. **Pruning**: Old archives are removed based on retention policy (7 daily, 4 weekly, 12 monthly)
5. **Unmount**: SSHFS mount is cleanly unmounted

## File Locations

- **Local Repository**: `~/.audiotools/borg-repo/`
- **SSHFS Mounts**: `/tmp/akai-backup/<hostname>/` (temporary)

## Next Steps

- See [CLI Commands](./cli-commands.md) for all available commands
- See [Examples](./examples.md) for common backup scenarios
- See [Troubleshooting](./troubleshooting.md) for common issues

## Scheduling Backups

### macOS (launchd)

Create `~/Library/LaunchAgents/com.oletizi.sampler-backup.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.oletizi.sampler-backup</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/akai-backup</string>
        <string>batch</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>2</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
</dict>
</plist>
```

Load it:
```bash
launchctl load ~/Library/LaunchAgents/com.oletizi.sampler-backup.plist
```

### Linux (cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2am
0 2 * * * /usr/local/bin/akai-backup batch
```
