# DEPRECATED: BorgBackup Implementation

**Status:** Deprecated
**Date:** 2025-10-06
**Reason:** BorgBackup cannot backup FROM remote SSH hosts

## Why Deprecated

During implementation, we discovered a critical limitation:

**BorgBackup does NOT support backing up FROM remote SSH sources.**

- Borg's SSH support is for accessing a REMOTE REPOSITORY, not for backing up remote sources
- Our use case requires backing up from `pi@pi-scsi2.local:/home/orion/images/` and `pi@s3k.local:/home/orion/images/`
- BorgBackup can only backup LOCAL files (or files on mounted filesystems)
- Attempting to use `pi@host:/path` as a source results in: `stat: [Errno 2] No such file or directory`

## What Was Attempted

A full BorgBackup implementation was completed:
- ✅ `BorgBackupAdapter` with all operations (create, list, restore, prune, check)
- ✅ 41 unit tests with 100% coverage
- ✅ Integration with RemoteSource and LocalSource
- ✅ Updated CLI with new commands
- ✅ Documentation and README updates
- ❌ **Failed when testing actual remote backup**

## Replacement Solution

**Switched to Restic** (see `docs/1.0/restic/`)

Restic provides:
- ✅ Native support for remote SSH sources via SFTP
- ✅ Block-level deduplication (content-defined chunking)
- ✅ Similar efficiency to BorgBackup
- ✅ Active development and good community support
- ✅ Works for both remote SSH sources AND local media

## Files to Clean Up

The following BorgBackup implementation files should be removed when Restic is complete:

**Core Implementation:**
- `sampler-backup/src/backup/borg-backup-adapter.ts`
- `sampler-backup/src/backup/borg-command.ts`
- `sampler-backup/src/types/borg.ts`

**Tests:**
- `sampler-backup/test/unit/borg-backup-adapter.test.ts`

**Note:** Sources (RemoteSource, LocalSource) were updated to use Borg but will need to be updated again for Restic.

## Lessons Learned

1. **Research tool capabilities thoroughly** - Test with actual remote sources early
2. **Don't assume SSH = can backup from SSH** - Check documentation carefully
3. **rsync's flexibility is underrated** - Its ability to pull from remote hosts is unique
4. **Restic was designed for this** - SFTP backend specifically supports remote sources

## References

- [BorgBackup SSH Documentation](https://borgbackup.readthedocs.io/en/stable/usage/general.html#ssh-batch-mode)
- [Restic SFTP Backend](https://restic.readthedocs.io/en/latest/030_preparing_a_new_repo.html#sftp)
