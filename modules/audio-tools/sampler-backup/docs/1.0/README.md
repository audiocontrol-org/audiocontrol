# sampler-backup v1.0 Documentation

## Documentation Structure

Documentation is organized by feature/implementation:

### Active Implementations

- **[borg-native-ssh/](./borg-native-ssh/)** - BorgBackup + SSHFS implementation (IMPLEMENTED ✅)
  - Current backup solution using SSHFS to mount remote directories, then BorgBackup for incremental backups
  - See implementation workplan for architecture and details

### Deprecated/Research

- **[restic/](./restic/)** - Restic migration research (DEPRECATED ⚠️)
  - Research document for potential Restic migration
  - Not implemented; superseded by BorgBackup + SSHFS approach

- **[deprecated-rsnapshot/](./deprecated-rsnapshot/)** - Old rsnapshot documentation (DEPRECATED ⚠️)
  - Original implementation using rsnapshot
  - Replaced by BorgBackup + SSHFS
  - Kept for historical reference only

## Current Implementation

**sampler-backup v1.0** uses **BorgBackup with SSHFS** for remote backups and direct BorgBackup for local media.

See the [borg-native-ssh implementation workplan](./borg-native-ssh/implementation/workplan.md) for complete documentation.

### Quick Commands

```bash
# Backup from default sources
akai-backup batch

# Backup from custom source
akai-backup backup --source pi@host:/path

# List archives
akai-backup list

# Restore archive
akai-backup restore <archive-name> <destination>
```

## Migration from rsnapshot

If you have existing rsnapshot backups:

1. Old backups remain in `~/.audiotools/backup/` (rsnapshot format)
2. New backups go to `~/.audiotools/borg-repo/` (BorgBackup format)
3. Both can coexist
4. No automatic migration - old backups can be archived once new system is verified

## See Also

- [BorgBackup + SSHFS Implementation](./borg-native-ssh/implementation/workplan.md) - Current implementation
- [Deprecated rsnapshot docs](./deprecated-rsnapshot/) - Historical reference
