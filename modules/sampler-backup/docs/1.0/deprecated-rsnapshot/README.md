# sampler-backup v1.0 Documentation

## Overview

Version 1.0 provides BorgBackup-based incremental backups for Akai samplers. Supports both remote backup (via SSHFS + SSH) and local media (SD cards, USB drives).

## Key Capabilities

- **Incremental Backups**: BorgBackup with chunk-level deduplication for maximum efficiency
- **Smart Rotation**: Same-day resume logic prevents duplicate backups
- **Remote & Local**: SSHFS-mounted remote backup or direct media access
- **Configurable Retention**: Daily/weekly/monthly archive retention
- **Batch Processing**: One-command backup for multiple samplers
- **Compression**: zstd compression for optimal size/speed balance

## Documentation

1. **[Installation](./installation.md)** - Package and BorgBackup setup
2. **[Quick Start](./quick-start.md)** - First backup in 5 minutes
3. **[CLI Commands](./cli-commands.md)** - Command-line interface reference
4. **[Examples](./examples.md)** - Common backup scenarios
5. **[API Reference](./api-reference.md)** - Programmatic usage
6. **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

## Backup Strategy

v1.0 implements BorgBackup retention strategy:

- **Daily archives**: 7 retained
- **Weekly archives**: 4 retained
- **Monthly archives**: 12 retained

Chunk-level deduplication ensures archives share unchanged data, minimizing disk usage.

## Architecture

### Remote Backups (SSHFS + BorgBackup)

```
[Remote Host: /home/orion/images]
    ↓ (mounted via SSHFS)
[Local Mount: /tmp/akai-backup/pi-scsi2-local]
    ↓ (Borg reads and chunks)
[Local Borg Repo: ~/.audiotools/borg-repo]
```

**How It Works:**
1. SSHFS mounts remote directory locally
2. Borg reads from mount point (appears as local filesystem)
3. Borg chunks, compresses, and hashes data
4. Only changed chunks are transferred over SSH
5. Deduplicated data stored in local repository
6. SSHFS unmounts after backup completes

### Local Backups

Local media (SD cards, USB drives) are backed up directly without SSHFS.

## Getting Started

```bash
npm install -g @audiocontrol/sampler-backup

# macOS
# 1. Download macFUSE from https://macfuse.github.io/
# 2. Allow in System Preferences → Privacy & Security
# 3. Restart Mac
brew install sshfs borgbackup

# Linux
sudo apt install sshfs borgbackup

# Run backup
akai-backup batch
```

See [Quick Start](./quick-start.md) for detailed setup.

## Migration from rsnapshot

If you're upgrading from a previous version that used rsnapshot:

1. Old rsnapshot backups remain in `~/.audiotools/backup/`
2. New BorgBackup archives go to `~/.audiotools/borg-repo/`
3. Both can coexist - BorgBackup doesn't touch rsnapshot data
4. Consider archiving old rsnapshot backups once BorgBackup is working

## Contributing

See main [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

Apache-2.0
