# Configuration

## ⚠️ DEPRECATED

**This document is deprecated.** The rsnapshot configuration system has been replaced with BorgBackup + SSHFS.

**BorgBackup does not require a configuration file.** Instead, use command-line flags to customize backups.

---

## Migration Guide

### Old Way (rsnapshot - DEPRECATED)

```bash
# Generate config file
akai-backup config

# Edit ~/.audiotools/rsnapshot.conf manually
# Add backup sources, customize retention

# Run backup
akai-backup batch
```

### New Way (BorgBackup - CURRENT)

```bash
# No configuration file needed!

# Backup from default sources
akai-backup batch

# Backup from custom source
akai-backup backup --source pi@myhost:/path/to/images

# Backup from local media
akai-backup backup --source /Volumes/SDCARD

# Custom retention policy
akai-backup prune --daily 14 --weekly 8 --monthly 24
```

## Configuration Options

### Backup Sources

**Old (rsnapshot):**
```conf
# ~/.audiotools/rsnapshot.conf
backup    pi-scsi2.local:/home/orion/images/    pi-scsi2/
backup    s3k.local:/home/orion/images/         s3k/
```

**New (BorgBackup):**
```bash
# Edit default sources in code (or use --source flag)
# Default sources defined in: sampler-backup/src/cli/backup.ts

# Or override at runtime
akai-backup backup --source pi-scsi2.local:/home/orion/images/
akai-backup backup --source s3k.local:/home/orion/images/
```

### Retention Policy

**Old (rsnapshot):**
```conf
# ~/.audiotools/rsnapshot.conf
retain    daily    7
retain    weekly   4
retain    monthly  12
```

**New (BorgBackup):**
```bash
# Use prune command with flags
akai-backup prune --daily 7 --weekly 4 --monthly 12

# Or modify default in code
# Edit: sampler-backup/src/cli/backup.ts
const DEFAULT_RETENTION: BorgRetentionPolicy = {
  daily: 7,
  weekly: 4,
  monthly: 12
};
```

### Programmatic API

**Old (rsnapshot):**
```typescript
import { getDefaultRsnapshotConfig, writeRsnapshotConfig } from '@audiocontrol/sampler-backup';

const config = getDefaultRsnapshotConfig();
config.samplers.push({ /* ... */ });
writeRsnapshotConfig(config);
```

**New (BorgBackup):**
```typescript
import { BackupSourceFactory } from '@audiocontrol/sampler-backup';

// Create backup source
const source = BackupSourceFactory.fromPath('pi@host:/path', {
  backupSubdir: 'my-sampler'
});

// Run backup
await source.backup('daily');
```

## Why the Change?

BorgBackup provides several advantages over rsnapshot:

1. **Chunk-level Deduplication** - Only changed chunks are stored, not entire files
2. **Compression** - zstd compression reduces storage requirements
3. **No Configuration File** - Simpler command-line interface
4. **Better Incremental Efficiency** - Superior to rsync for large binary files
5. **Repository Integrity Checks** - Built-in verification

## See Also

- [Quick Start](./quick-start.md) - Get started with BorgBackup in 5 minutes
- [CLI Commands](./cli-commands.md) - Complete command reference
- [Examples](./examples.md) - Common backup scenarios
