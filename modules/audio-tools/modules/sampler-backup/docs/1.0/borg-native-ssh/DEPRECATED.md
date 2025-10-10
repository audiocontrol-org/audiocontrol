# ⚠️ DEPRECATED - BorgBackup Implementation

**Date:** 2025-10-06

## Deprecation Notice

This directory contains documentation for the **BorgBackup + SSHFS implementation** which has been **DEPRECATED and REPLACED** by **simple rsync-based sync**.

**Do not use this documentation for current development.**

## Why Deprecated?

The BorgBackup implementation was abandoned for the following reasons:

1. **Too Slow**: BorgBackup operations (especially with SSHFS) are significantly slower than simple rsync
2. **Too Complex**: Chunk-level deduplication, repository management, and archive rotation add unnecessary complexity
3. **Overkill for Use Case**: We only need simple file-level sync, not incremental snapshots with deduplication
4. **Lock Contention**: Single repository locks prevented parallel backups (though hierarchical structure was designed to solve this)
5. **Simple is Better**: rsync provides file-level sync with change detection - exactly what's needed

## What Replaced It?

**Simple rsync-based file sync** with hierarchical directory structure:
- Single copy of data synced with rsync
- File-level change detection (rsync's built-in algorithm)
- Hierarchical structure: `~/.audiotools/backup/{sampler}/{device}/`
- No rotation, no snapshots, no deduplication - just simple sync
- Much faster and simpler to understand and maintain

## Migration

Users on BorgBackup should:
- Old backups remain in `~/.audiotools/borg/` (can be deleted or archived)
- New syncs go to `~/.audiotools/backup/` (simple directory structure)
- No migration needed - just start using new system

## Current Documentation

See the current implementation:
- **[rsync-simple-sync](../rsync-simple-sync/implementation/workplan.md)** - Current implementation and documentation

## Implementation Status

The BorgBackup implementation had:
- ✅ Phase 1: Repository path resolver (completed)
- ✅ Phase 1: Unit tests (34/34 passing)
- ✅ Phase 2: LocalSource updates (completed)
- ⚠️ Phase 2: RemoteSource updates (interrupted)
- ❌ Phase 3-5: Never started

All completed work has been abandoned in favor of simpler rsync approach.

---

**Last Updated:** 2025-10-06
**Status:** DEPRECATED - Replaced by rsync-based sync
