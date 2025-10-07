# Simple rsync-based File Sync

**Version:** 1.0
**Status:** Planning
**Date:** 2025-10-06

## Overview

Simple file-level synchronization using rsync. No snapshots, no rotation, no deduplication - just fast, simple sync of sampler disk images to local storage.

## Problem Statement

### What We Don't Need

- ❌ Incremental snapshots with rotation
- ❌ Block-level deduplication
- ❌ Repository management and archives
- ❌ Complex backup/restore workflows
- ❌ Slow operations

### What We Actually Need

- ✅ Simple file-level sync
- ✅ Fast synchronization (rsync algorithm)
- ✅ Only sync changed files
- ✅ Single copy of data (current state)
- ✅ Hierarchical organization by sampler/device
- ✅ Support for remote (SSH) and local sources

## Solution: Simple rsync Wrapper

### Architecture

```
rsync [source] → ~/.audiotools/backup/{sampler}/{device}/
```

**That's it.** No complexity, no overhead, just rsync.

### Directory Structure

```
~/.audiotools/backup/
├── pi-scsi2/              # Remote sampler (hostname)
│   ├── scsi0/             # SCSI ID 0
│   │   ├── HD1.hds
│   │   └── HD2.hds
│   ├── scsi1/             # SCSI ID 1
│   │   └── HD3.hds
│   └── floppy/            # Floppy emulator
│       └── DSK0.img
├── s5k-studio/            # Local sampler (via --sampler)
│   ├── scsi0/
│   │   └── samples.hds
│   └── floppy/
│       └── sounds.img
└── s3k-zulu/
    └── scsi0/
        └── programs.hds
```

### Key Features

1. **Hierarchical Structure** - Same as BorgBackup design: `{sampler}/{device}/`
2. **File-level Sync** - rsync only transfers changed files
3. **Single Copy** - No snapshots, just current state
4. **Fast** - rsync is much faster than BorgBackup
5. **Simple** - Easy to understand and maintain

## Implementation Plan

### Phase 1: Path Resolution (REUSE FROM BORG)

We can reuse `repo-path-resolver.ts` but change the base directory:

```typescript
// Change from:
const baseDir = join(homedir(), '.audiotools', 'borg');

// To:
const baseDir = join(homedir(), '.audiotools', 'backup');
```

**Status:** Already implemented, just needs base directory change.

### Phase 2: rsync Wrapper

Create simple rsync wrapper adapter:

**File:** `src/backup/rsync-adapter.ts`

```typescript
import { spawn } from 'node:child_process';
import { join } from 'node:path';

export interface RsyncConfig {
  sourcePath: string;      // Local path or user@host:/path
  destPath: string;        // Local destination
  verbose?: boolean;
  dryRun?: boolean;
}

export class RsyncAdapter {
  async sync(config: RsyncConfig): Promise<void> {
    const args = [
      '-av',                    // Archive mode, verbose
      '--delete',               // Delete files that don't exist in source
      '--progress',             // Show progress
    ];

    if (config.dryRun) {
      args.push('--dry-run');
    }

    args.push(config.sourcePath);
    args.push(config.destPath);

    return new Promise((resolve, reject) => {
      const rsync = spawn('rsync', args, { stdio: 'inherit' });

      rsync.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`rsync failed with code ${code}`));
        }
      });

      rsync.on('error', reject);
    });
  }
}
```

**That's the entire backup implementation.** ~50 lines of code.

### Phase 3: Update Source Classes

**RemoteSource:**

```typescript
export class RemoteSource implements BackupSource {
  private readonly rsyncAdapter: RsyncAdapter;
  private readonly backupPath: string;

  constructor(private readonly config: RemoteSourceConfig) {
    this.rsyncAdapter = new RsyncAdapter();

    // Resolve backup path: ~/.audiotools/backup/{sampler}/{device}/
    this.backupPath = resolveRepositoryPath({
      sourceType: 'remote',
      host: config.host,
      sampler: config.sampler,
      device: config.device,
    });
  }

  async backup(): Promise<void> {
    // Simple rsync: user@host:/source → ~/.audiotools/backup/{sampler}/{device}/
    const source = `${config.host}:${config.sourcePath}`;

    await this.rsyncAdapter.sync({
      sourcePath: source,
      destPath: this.backupPath,
    });
  }

  async test(): Promise<boolean> {
    // Test SSH connection
    const ssh = spawn('ssh', [config.host, 'echo', 'ok']);
    return new Promise((resolve) => {
      ssh.on('close', (code) => resolve(code === 0));
    });
  }
}
```

**LocalSource:**

```typescript
export class LocalSource implements BackupSource {
  private readonly rsyncAdapter: RsyncAdapter;
  private readonly backupPath: string;

  constructor(private readonly config: LocalSourceConfig) {
    this.rsyncAdapter = new RsyncAdapter();

    // Resolve backup path: ~/.audiotools/backup/{sampler}/{device}/
    this.backupPath = resolveRepositoryPath({
      sourceType: 'local',
      sampler: config.sampler,
      device: config.device,
    });
  }

  async backup(): Promise<void> {
    // Simple rsync: /Volumes/DSK0 → ~/.audiotools/backup/{sampler}/{device}/
    await this.rsyncAdapter.sync({
      sourcePath: config.sourcePath,
      destPath: this.backupPath,
    });
  }

  async test(): Promise<boolean> {
    // Test if source path exists
    return existsSync(config.sourcePath);
  }
}
```

### Phase 4: CLI Commands

**Backup command:**

```bash
# Remote
akai-backup sync --source pi-scsi2.local:/home/orion/images/ --device scsi0

# Local
akai-backup sync --source /Volumes/DSK0 --sampler s5k-studio --device floppy
```

**List command:**

```bash
# List all synced data
akai-backup list --all

# Output:
# ~/.audiotools/backup/
# ├── pi-scsi2/scsi0/  (2 files, 20GB)
# ├── pi-scsi2/scsi1/  (3 files, 30GB)
# └── s5k-studio/floppy/  (1 file, 1.4MB)
```

**No restore command needed** - files are already in plain directory structure. Just copy them directly.

## Comparison: BorgBackup vs rsync

| Feature | BorgBackup | rsync |
|---------|-----------|-------|
| Speed | Slow (especially with SSHFS) | Fast |
| Complexity | High (repos, archives, locks) | Low (just copy files) |
| Storage | Deduplication saves space | Single copy of files |
| Snapshots | Multiple incremental snapshots | Single current state |
| Use Case | Complex backup rotation | Simple sync |
| Our Need | ❌ Overkill | ✅ Perfect fit |

## Benefits of rsync Approach

1. **Fast** - rsync is optimized for file transfer
2. **Simple** - Easy to understand: "copy changed files"
3. **Transparent** - Files stored in plain directories
4. **Reliable** - rsync is battle-tested for decades
5. **No Lock Issues** - Each sync is independent
6. **Easy Recovery** - Files are just files, no extraction needed

## Implementation Checklist

### Phase 1: Path Resolution
- [x] repo-path-resolver.ts exists (from BorgBackup work)
- [ ] Change base directory from 'borg' to 'backup'
- [ ] Update tests to use 'backup' path

### Phase 2: rsync Wrapper
- [ ] Create `src/backup/rsync-adapter.ts`
- [ ] Implement `RsyncAdapter` class
- [ ] Write unit tests
- [ ] Test dry-run mode
- [ ] Test actual sync

### Phase 3: Source Updates
- [ ] Update `RemoteSource` to use rsync
- [ ] Update `LocalSource` to use rsync
- [ ] Remove BorgBackup dependencies
- [ ] Update tests

### Phase 4: CLI
- [ ] Update `backup` command to use rsync
- [ ] Add `list` command for hierarchical view
- [ ] Update help text
- [ ] Remove BorgBackup-specific commands

### Phase 5: Documentation
- [ ] Document rsync-based sync
- [ ] Add usage examples
- [ ] Document directory structure
- [ ] Migration guide from BorgBackup

## Success Criteria

- [ ] Can sync remote sources via SSH with rsync
- [ ] Can sync local media with rsync
- [ ] Files organized in `~/.audiotools/backup/{sampler}/{device}/`
- [ ] Only changed files transferred
- [ ] Fast synchronization (< 1 minute for unchanged 20GB disk)
- [ ] Simple, understandable implementation (< 200 lines total)

---

**Next Steps:**
1. Update repo-path-resolver base directory
2. Implement RsyncAdapter
3. Update source classes
4. Test with real samplers
