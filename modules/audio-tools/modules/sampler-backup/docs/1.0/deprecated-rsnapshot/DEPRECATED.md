# ⚠️ DEPRECATED - rsnapshot Documentation

**Date:** 2025-10-06

## Deprecation Notice

This directory contains documentation for the **rsnapshot-based implementation** which has been **DEPRECATED and REPLACED** by **BorgBackup + SSHFS**.

**Do not use this documentation for current development.**

## Why Deprecated?

The rsnapshot implementation was replaced for the following reasons:

1. **Better Incremental Efficiency**: BorgBackup provides chunk-level deduplication vs. rsnapshot's file-level hard-linking
2. **Compression**: BorgBackup includes zstd compression, reducing storage requirements by ~15-30%
3. **Better Integrity Checks**: BorgBackup has built-in repository verification
4. **No Configuration Files**: Simpler command-line interface without rsnapshot.conf
5. **Superior for Large Binary Files**: Disk images benefit greatly from chunk-level deduplication

## Migration

Users on rsnapshot can migrate to BorgBackup:

- Old backups remain in `~/.audiotools/backup/` (rsnapshot format)
- New backups go to `~/.audiotools/borg-repo/` (BorgBackup format)
- No automatic migration - verify new system works, then archive old backups

## Current Documentation

See the current implementation:

- **[BorgBackup + SSHFS](../borg-native-ssh/implementation/workplan.md)** - Current implementation and documentation

## Contents (Historical Reference Only)

This directory contains:

- `README.md` - Overview (OUTDATED - partially updated before deprecation)
- `installation.md` - Installation instructions (OUTDATED - partially updated)
- `quick-start.md` - Quick start guide (OUTDATED - partially updated)
- `cli-commands.md` - CLI reference (OUTDATED - partially updated)
- `configuration.md` - rsnapshot.conf documentation (OUTDATED - migration guide added)
- `examples.md` - Usage examples (OUTDATED - rsnapshot-specific)
- `api-reference.md` - Programmatic API (OUTDATED - rsnapshot-specific)
- `troubleshooting.md` - Troubleshooting (OUTDATED - rsnapshot-specific)

**Note:** Some files were partially updated during the migration before being deprecated. They should not be considered authoritative.

## Preservation Reason

This documentation is preserved for:

1. Historical reference
2. Understanding the evolution of the backup system
3. Migration support for users with existing rsnapshot backups
4. Comparison of approaches (rsnapshot vs. BorgBackup)

---

**Last Updated:** 2025-10-06
**Status:** DEPRECATED - Do not use for current development
