# sampler-backup v1.0 Documentation

## Documentation Structure

Documentation is organized by feature/implementation:

### Active Implementations

- **[rsync-simple-sync/](./rsync-simple-sync/)** - Simple rsync-based file sync (CURRENT ✅)
  - Current solution: simple file-level sync using rsync
  - Hierarchical directory structure: `~/.audiotools/backup/{sampler}/{device}/`
  - No snapshots, no rotation, just fast sync
  - See implementation workplan for architecture and details

### Deprecated/Research

- **[borg-native-ssh/](./borg-native-ssh/)** - BorgBackup + SSHFS implementation (DEPRECATED ⚠️)
  - Abandoned: too slow and complex for simple sync needs
  - Replaced by simple rsync-based approach

- **[backup-parallel/](./backup-parallel/)** - Parallel backup with hierarchical repos (DEPRECATED ⚠️)
  - Design work for BorgBackup parallel backups
  - Abandoned along with BorgBackup
  - Hierarchical directory structure concept retained for rsync approach

- **[restic/](./restic/)** - Restic migration research (DEPRECATED ⚠️)
  - Research document for potential Restic migration
  - Never implemented; superseded by simpler approaches

- **[deprecated-rsnapshot/](./deprecated-rsnapshot/)** - Old rsnapshot documentation (DEPRECATED ⚠️)
  - Original implementation using rsnapshot
  - Replaced multiple times
  - Kept for historical reference only

## Current Implementation

**sampler-backup v1.0** uses **simple rsync-based file synchronization**.

See the [rsync-simple-sync implementation workplan](./rsync-simple-sync/implementation/workplan.md) for complete documentation.

### Directory Structure

```
~/.audiotools/backup/
├── pi-scsi2/              # Remote sampler (hostname)
│   ├── scsi0/             # SCSI device 0
│   ├── scsi1/             # SCSI device 1
│   └── floppy/            # Floppy emulator
├── s5k-studio/            # Local sampler (via --sampler)
│   ├── scsi0/
│   └── floppy/
└── s3k-zulu/
    └── scsi0/
```

### Quick Commands

```bash
# Sync from remote source
akai-backup sync --source pi-scsi2.local:~/images/ --device scsi0

# Sync from local media
akai-backup sync --source /Volumes/DSK0 --sampler s5k-studio --device floppy

# List synced data
akai-backup list --all
```

## Migration from Previous Versions

### From BorgBackup

Old BorgBackup repositories in `~/.audiotools/borg/` can be deleted or archived. The new rsync-based system uses `~/.audiotools/backup/` with plain directory structure.

### From rsnapshot

Old rsnapshot backups in `~/.audiotools/backup/` may conflict with new structure. Consider moving to `~/.audiotools/backup.old/` before using new system.

## See Also

- [rsync-simple-sync Implementation](./rsync-simple-sync/implementation/workplan.md) - Current implementation
- [Deprecated BorgBackup docs](./borg-native-ssh/DEPRECATED.md) - Why we abandoned BorgBackup
- [Deprecated rsnapshot docs](./deprecated-rsnapshot/) - Historical reference
