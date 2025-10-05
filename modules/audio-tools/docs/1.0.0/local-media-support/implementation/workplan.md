# Local Media Support - Implementation Workplan

**Version:** 1.0.0
**Created:** 2025-10-05
**Status:** Planning
**Estimated Duration:** 11-15 days

---

## Executive Summary

### Problem Statement

The current backup system (`@oletizi/sampler-backup`) only supports remote SSH sources via rsnapshot, requiring users to have networked PiSCSI devices. However, **most Akai sampler users** access their disk images through:

- **Floppy emulators**: Gotek, HxC (USB or SD card storage)
- **SCSI emulators**: ZuluSCSI, SCSI2SD (SD card storage)
- **Direct media access**: SD cards, USB drives mounted on their computers

These users must currently manually copy disk images from removable media, which is error-prone and lacks the benefits of automated backup (incremental, timestamped, versioned).

### Goal

Enable seamless backup and extraction of Akai sampler disk images from local media (SD cards, USB drives, mounted filesystems) with the same level of automation and reliability as remote SSH backups.

**User Workflows:**
```bash
# Insert SD card from Gotek/ZuluSCSI
# System auto-mounts as /Volumes/SDCARD

# Backup disk images from SD card
akai-backup --source /Volumes/SDCARD

# Extract backed-up disk images
akai-extract batch --source ~/.audiotools/backup
```

### Success Criteria

- ✅ Users can backup from local paths with single command
- ✅ Automatic detection of disk image files on mounted media
- ✅ Incremental backup support (skip unchanged files)
- ✅ Timestamp preservation for change detection
- ✅ Works across platforms (macOS, Linux, Windows WSL)
- ✅ Zero new external dependencies
- ✅ 100% test coverage for new components
- ✅ Clear user documentation with examples

---

## Current Architecture Analysis

### Backup System (`@oletizi/sampler-backup`)

**Current Design:**
- **Wrapper around rsnapshot**: Generates rsnapshot config, executes rsnapshot commands
- **Remote SSH sources only**: `backup` lines in rsnapshot.conf use SSH syntax (e.g., `user@host:/path`)
- **Configuration**: `SamplerConfig` includes `host`, `sourcePath`, `backupSubdir`
- **Smart rotation**: Same-day resume vs. next-day rotation based on timestamps
- **Output**: Structured snapshots in `~/.audiotools/backup/daily.0/`

**Key Files:**
- `sampler-backup/src/backup/rsnapshot-wrapper.ts` - Core backup execution
- `sampler-backup/src/config/rsnapshot-config.ts` - Config generation
- `sampler-backup/src/cli/backup.ts` - CLI interface
- `sampler-backup/src/types/index.ts` - Type definitions

**Limitations:**
- ❌ Cannot handle local filesystem paths
- ❌ No media detection capabilities
- ❌ Rsnapshot dependency limits flexibility
- ❌ SSH-specific configuration structure

### Extraction System (`@oletizi/sampler-export`)

**Current Design:**
- **Flexible source reading**: Already reads from local directories
- **Batch extractor**: Scans rsnapshot structure, discovers disk images recursively
- **Format detection**: Auto-detects Akai vs DOS formats
- **Timestamp-based changes**: Skips unchanged disks using mtime comparison
- **Output**: Extracted files in `~/.audiotools/sampler-export/extracted/`

**Key Files:**
- `sampler-export/src/extractor/batch-extractor.ts` - Batch processing with discovery
- `sampler-export/src/extractor/disk-extractor.ts` - Individual disk extraction
- `sampler-export/src/extractor/dos-disk-extractor.ts` - DOS format handling
- `sampler-export/src/cli/extract.ts` - CLI interface

**Strengths:**
- ✅ Already supports arbitrary source directories
- ✅ Recursive disk image discovery
- ✅ Change detection working well
- ✅ No modification needed for local media support

**Gap:**
- ⚠️ Expects rsnapshot directory structure (`daily.0/pi-scsi2/`)
- ⚠️ Hardcoded sampler type → backup dir mapping

---

## Design Overview

### Architectural Approach

We will **extend** the existing backup system with local media support while maintaining backward compatibility with SSH/rsnapshot workflows.

**Key Design Principles:**
1. **Source Abstraction**: Unified interface for remote (SSH) vs local sources
2. **Incremental by Default**: Preserve rsnapshot-like behavior (skip unchanged files)
3. **Zero Configuration**: Auto-detect media and disk images
4. **Platform Agnostic**: Work on macOS, Linux, Windows WSL
5. **Backward Compatible**: Existing SSH/rsnapshot workflows unchanged

### New Components

#### 1. MediaDetector

**Purpose:** Auto-detect mounted media and scan for disk images

**Responsibilities:**
- Scan platform-specific mount points (`/Volumes` on macOS, `/media` on Linux, etc.)
- Identify removable media vs. system drives
- Recursively search for disk image files (`.hds`, `.img`, `.iso`)
- Return structured information about discovered disk images

**API:**
```typescript
interface MediaInfo {
  mountPoint: string;        // e.g., "/Volumes/SDCARD"
  volumeName: string;        // e.g., "SDCARD"
  filesystem: string;        // e.g., "FAT32", "exFAT"
  diskImages: DiskImageInfo[];
}

interface DiskImageInfo {
  path: string;              // Absolute path to disk image
  name: string;              // Filename without extension
  size: number;              // File size in bytes
  mtime: Date;               // Last modification time
}

class MediaDetector {
  static detectMedia(): Promise<MediaInfo[]>;
  static findDiskImages(path: string): Promise<DiskImageInfo[]>;
}
```

**Platform Detection:**
```typescript
// macOS: /Volumes/
// Linux: /media/$USER/, /mnt/
// Windows WSL: /mnt/c/, /mnt/d/
const mountPoints = platform() === 'darwin'
  ? '/Volumes'
  : platform() === 'linux'
    ? ['/media', '/mnt']
    : ['/mnt'];
```

#### 2. LocalBackupAdapter

**Purpose:** Copy disk images from local source to backup directory with incremental support

**Responsibilities:**
- Copy disk images preserving timestamps
- Implement incremental logic (skip unchanged files)
- Track progress for large files
- Handle errors gracefully (permission issues, disk full, etc.)
- Create rsnapshot-compatible directory structure

**API:**
```typescript
interface LocalBackupOptions {
  sourcePath: string;         // Source directory (e.g., /Volumes/SDCARD)
  destPath: string;           // Destination (e.g., ~/.audiotools/backup/daily.0/local-media)
  incremental?: boolean;      // Skip unchanged files (default: true)
  onProgress?: (progress: BackupProgress) => void;
}

interface BackupProgress {
  currentFile: string;
  bytesProcessed: number;
  totalBytes: number;
  filesProcessed: number;
  totalFiles: number;
}

class LocalBackupAdapter {
  async backup(options: LocalBackupOptions): Promise<BackupResult>;
  private shouldCopyFile(sourcePath: string, destPath: string): boolean;
  private copyFileWithProgress(source: string, dest: string): Promise<void>;
}
```

**Incremental Logic:**
```typescript
private shouldCopyFile(sourcePath: string, destPath: string): boolean {
  if (!existsSync(destPath)) {
    return true; // New file
  }

  const sourceStat = statSync(sourcePath);
  const destStat = statSync(destPath);

  // Copy if source is newer or different size
  return sourceStat.mtime > destStat.mtime || sourceStat.size !== destStat.size;
}
```

#### 3. Source Abstraction Layer

**Purpose:** Unified interface for remote (SSH) and local backup sources

**Responsibilities:**
- Define `BackupSource` interface
- Implement `RemoteSource` (wraps existing rsnapshot)
- Implement `LocalSource` (uses LocalBackupAdapter)
- Factory pattern for source creation based on configuration

**API:**
```typescript
interface BackupSource {
  type: 'remote' | 'local';
  backup(interval: RsnapshotInterval): Promise<BackupResult>;
  test(): Promise<boolean>;
  getConfig(): BackupSourceConfig;
}

type BackupSourceConfig = RemoteSourceConfig | LocalSourceConfig;

interface RemoteSourceConfig {
  type: 'remote';
  host: string;
  sourcePath: string;
  backupSubdir: string;
}

interface LocalSourceConfig {
  type: 'local';
  sourcePath: string;      // e.g., /Volumes/SDCARD
  backupSubdir: string;    // e.g., "local-media"
}

class BackupSourceFactory {
  static create(config: BackupSourceConfig): BackupSource {
    return config.type === 'remote'
      ? new RemoteSource(config)
      : new LocalSource(config);
  }
}

class RemoteSource implements BackupSource {
  // Wraps existing rsnapshot functionality
}

class LocalSource implements BackupSource {
  // Uses LocalBackupAdapter
}
```

#### 4. Enhanced CLI

**Purpose:** Accept local paths via `--source` flag

**Changes:**
```typescript
// sampler-backup/src/cli/backup.ts

program
  .command("backup")
  .description("Run backup from remote host or local media")
  .argument("[interval]", "Backup interval: daily, weekly, monthly (default: daily)", "daily")
  .option("-c, --config <path>", "Config file path (default: ~/.audiotools/rsnapshot.conf)")
  .option("-s, --source <path>", "Local source path (e.g., /Volumes/SDCARD)")
  .option("--subdir <name>", "Backup subdirectory name (default: local-media)")
  .action(async (interval: string, options) => {
    if (options.source) {
      // Local media workflow
      const localSource = new LocalSource({
        type: 'local',
        sourcePath: options.source,
        backupSubdir: options.subdir || 'local-media'
      });

      await localSource.backup(interval as RsnapshotInterval);
    } else {
      // Existing rsnapshot workflow
      await runBackup({ interval, configPath });
    }
  });
```

**Auto-Detection:**
```bash
# Explicit local source
akai-backup --source /Volumes/SDCARD

# Auto-detect mounted media (future enhancement)
akai-backup --auto-detect
```

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Interface                          │
│  (akai-backup backup --source /Volumes/SDCARD)             │
└────────────────────────────┬────────────────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │  Source Router   │
                    │  (Factory)       │
                    └────────┬─────────┘
                             │
        ┌────────────────────┴────────────────────┐
        │                                         │
   ┌────▼─────────┐                      ┌───────▼────────┐
   │RemoteSource  │                      │ LocalSource    │
   │(rsnapshot)   │                      │(file copy)     │
   └────┬─────────┘                      └───────┬────────┘
        │                                        │
        │                                 ┌──────▼──────────┐
        │                                 │MediaDetector    │
        │                                 │(scan for imgs)  │
        │                                 └──────┬──────────┘
        │                                        │
        │                                 ┌──────▼──────────────┐
        │                                 │LocalBackupAdapter   │
        │                                 │(incremental copy)   │
        │                                 └─────────────────────┘
        │                                        │
        └────────────────┬───────────────────────┘
                         │
              ┌──────────▼──────────┐
              │  Backup Directory   │
              │ ~/.audiotools/backup│
              │   daily.0/          │
              │     pi-scsi2/       │ (remote)
              │     local-media/    │ (local)
              └─────────────────────┘
```

### Directory Structure

**Backup Output:**
```
~/.audiotools/backup/
  daily.0/
    pi-scsi2/           # Remote SSH backups (existing)
      home/orion/images/*.hds
    s3k/                # Remote SSH backups (existing)
      *.hds
    local-media/        # NEW: Local media backups
      *.hds
      *.img
```

**Configuration:**
```typescript
// Extended config to support both remote and local
interface RsnapshotConfig {
  snapshotRoot: string;
  retain: Record<RsnapshotInterval, number>;
  sources: BackupSourceConfig[];  // NEW: Array of sources
  options?: { ... };
}
```

---

## Implementation Phases

### Phase 1: Media Detection (2-3 days)

**Goal:** Implement platform-specific media detection and disk image discovery

#### Tasks

**Task 1.1: Create MediaDetector class** (4 hours)
- Create `sampler-backup/src/media/media-detector.ts`
- Implement `detectMedia()` method
- Implement `findDiskImages()` method
- Platform-specific mount point detection

**Acceptance Criteria:**
- ✅ Detects mounted volumes on macOS (`/Volumes`)
- ✅ Detects mounted media on Linux (`/media`, `/mnt`)
- ✅ Returns structured `MediaInfo[]` with disk images
- ✅ Handles non-existent mount points gracefully

**Task 1.2: Disk image file discovery** (3 hours)
- Recursive directory scanning
- Filter for disk image extensions (`.hds`, `.img`, `.iso`)
- Extract file metadata (size, mtime)
- Exclude system files and hidden directories

**Acceptance Criteria:**
- ✅ Recursively finds all `.hds`, `.img`, `.iso` files
- ✅ Excludes hidden files (`.`, `..`, `.DS_Store`)
- ✅ Returns absolute paths
- ✅ Preserves file metadata

**Task 1.3: Unit tests for MediaDetector** (4 hours)
- Mock filesystem with `memfs` or test fixtures
- Test mount point detection across platforms
- Test recursive disk image discovery
- Test error handling (permission denied, etc.)

**Acceptance Criteria:**
- ✅ 100% code coverage
- ✅ Tests pass on macOS and Linux
- ✅ Mock filesystem scenarios covered
- ✅ Edge cases handled (empty dirs, no images, etc.)

**Deliverables:**
- `sampler-backup/src/media/media-detector.ts`
- `sampler-backup/test/unit/media-detector.test.ts`
- Updated `sampler-backup/src/types/index.ts` with `MediaInfo` types

**Dependencies:** None

**Risks:**
- Platform-specific filesystem differences
- Permission issues reading mounted media
- **Mitigation:** Extensive platform testing, graceful error handling

---

### Phase 2: Local Backup Adapter (3-4 days)

**Goal:** Implement file-based incremental backup with progress tracking

#### Tasks

**Task 2.1: Create LocalBackupAdapter class** (6 hours)
- Create `sampler-backup/src/backup/local-backup-adapter.ts`
- Implement `backup()` method
- Implement incremental copy logic (`shouldCopyFile()`)
- Preserve file timestamps during copy

**Acceptance Criteria:**
- ✅ Copies disk images from source to destination
- ✅ Skips unchanged files based on mtime and size
- ✅ Preserves timestamps (`utimes()`)
- ✅ Creates destination directories as needed

**Task 2.2: Progress tracking** (4 hours)
- Implement `onProgress` callback system
- Track bytes processed, total bytes, files processed
- Handle large files (> 1GB) efficiently
- Stream-based copying for memory efficiency

**Acceptance Criteria:**
- ✅ Progress callback invoked during copy
- ✅ Accurate byte counts reported
- ✅ Memory usage stable for large files
- ✅ Cancellable operations

**Task 2.3: Error handling** (3 hours)
- Handle permission errors gracefully
- Handle disk full scenarios
- Partial file cleanup on failure
- Detailed error messages with context

**Acceptance Criteria:**
- ✅ Permission errors don't crash, skip file with warning
- ✅ Disk full errors caught and reported
- ✅ Partial files deleted on failure
- ✅ Error messages include file paths

**Task 2.4: Integration tests** (5 hours)
- Test incremental backup (skip unchanged)
- Test timestamp preservation
- Test large file handling
- Test error scenarios (permissions, disk full)

**Acceptance Criteria:**
- ✅ End-to-end backup workflow tested
- ✅ Incremental logic verified with real files
- ✅ Error scenarios covered
- ✅ Cross-platform tests (macOS, Linux)

**Deliverables:**
- `sampler-backup/src/backup/local-backup-adapter.ts`
- `sampler-backup/test/unit/local-backup-adapter.test.ts`
- `sampler-backup/test/integration/local-backup.test.ts`

**Dependencies:** Phase 1 (MediaDetector for test setup)

**Risks:**
- Large file performance
- Filesystem-specific permission models
- **Mitigation:** Stream-based copying, comprehensive permission tests

---

### Phase 3: Source Abstraction Layer (2-3 days)

**Goal:** Create unified interface for remote and local backup sources

#### Tasks

**Task 3.1: Define BackupSource interface** (2 hours)
- Create `sampler-backup/src/sources/backup-source.ts`
- Define `BackupSource` interface
- Define config types (`RemoteSourceConfig`, `LocalSourceConfig`)
- Document interface contracts

**Acceptance Criteria:**
- ✅ Clear interface with `backup()`, `test()`, `getConfig()`
- ✅ Type-safe config types
- ✅ JSDoc documentation complete

**Task 3.2: Implement RemoteSource** (4 hours)
- Create `sampler-backup/src/sources/remote-source.ts`
- Wrap existing rsnapshot functionality
- Implement `BackupSource` interface
- Maintain backward compatibility

**Acceptance Criteria:**
- ✅ Implements `BackupSource` interface
- ✅ Wraps existing rsnapshot logic from `rsnapshot-wrapper.ts`
- ✅ All existing tests still pass
- ✅ No breaking changes to existing API

**Task 3.3: Implement LocalSource** (4 hours)
- Create `sampler-backup/src/sources/local-source.ts`
- Use `LocalBackupAdapter` internally
- Implement directory structure creation
- Implement `BackupSource` interface

**Acceptance Criteria:**
- ✅ Implements `BackupSource` interface
- ✅ Creates rsnapshot-compatible directory structure
- ✅ Delegates to `LocalBackupAdapter` for file operations
- ✅ Progress tracking integrated

**Task 3.4: Implement BackupSourceFactory** (3 hours)
- Create `sampler-backup/src/sources/backup-source-factory.ts`
- Factory pattern for source creation
- Auto-detect source type from config
- Validation and error handling

**Acceptance Criteria:**
- ✅ Creates correct source type based on config
- ✅ Validates config before creation
- ✅ Clear error messages for invalid configs

**Task 3.5: Unit tests** (4 hours)
- Test RemoteSource wrapper
- Test LocalSource functionality
- Test factory pattern
- Test error cases

**Acceptance Criteria:**
- ✅ 100% coverage for new source classes
- ✅ Factory tests cover all config types
- ✅ Error handling tested

**Deliverables:**
- `sampler-backup/src/sources/backup-source.ts`
- `sampler-backup/src/sources/remote-source.ts`
- `sampler-backup/src/sources/local-source.ts`
- `sampler-backup/src/sources/backup-source-factory.ts`
- `sampler-backup/test/unit/sources/*.test.ts`

**Dependencies:** Phase 2 (LocalBackupAdapter)

**Risks:**
- Breaking existing rsnapshot functionality
- **Mitigation:** Comprehensive regression tests, wrapper pattern

---

### Phase 4: CLI Integration (2 days)

**Goal:** Add `--source` flag and integrate source abstraction into CLI

#### Tasks

**Task 4.1: Update CLI commands** (4 hours)
- Modify `sampler-backup/src/cli/backup.ts`
- Add `--source` flag to backup command
- Add `--subdir` flag for custom backup subdirectory
- Update help text and examples

**Acceptance Criteria:**
- ✅ `--source /path/to/media` flag works
- ✅ `--subdir name` flag works
- ✅ Help text updated with local media examples
- ✅ Backward compatible (no flags = existing behavior)

**Task 4.2: Source type detection** (3 hours)
- Auto-detect remote vs local based on path format
- Validate source paths exist
- Clear error messages for invalid sources

**Acceptance Criteria:**
- ✅ Local paths validated (directory exists, readable)
- ✅ Remote syntax detected (host:path format)
- ✅ Helpful error messages guide users

**Task 4.3: Integration with source factory** (3 hours)
- Wire CLI flags to source factory
- Pass source config to factory
- Handle source creation errors

**Acceptance Criteria:**
- ✅ CLI creates correct source type from flags
- ✅ Errors from factory displayed to user
- ✅ Progress output shows source type

**Task 4.4: End-to-end CLI tests** (6 hours)
- Test local media backup workflow
- Test remote backup workflow (existing)
- Test error scenarios
- Test help output

**Acceptance Criteria:**
- ✅ Full workflow tested: detection → backup → verify
- ✅ Both remote and local workflows verified
- ✅ Error cases produce helpful output
- ✅ Help text accurate

**Deliverables:**
- Updated `sampler-backup/src/cli/backup.ts`
- `sampler-backup/test/integration/cli-local-backup.test.ts`
- Updated CLI help text and examples

**Dependencies:** Phase 3 (Source abstraction)

**Risks:**
- CLI complexity increasing
- **Mitigation:** Clear separation of concerns, comprehensive tests

---

### Phase 5: Testing & Documentation (2-3 days)

**Goal:** Comprehensive testing and user-facing documentation

#### Tasks

**Task 5.1: Cross-platform testing** (6 hours)
- Test on macOS (primary development platform)
- Test on Linux (Ubuntu/Debian)
- Test on Windows WSL (optional)
- Document platform-specific quirks

**Acceptance Criteria:**
- ✅ All tests pass on macOS
- ✅ All tests pass on Linux
- ✅ Platform-specific issues documented
- ✅ CI pipeline configured (if applicable)

**Task 5.2: End-to-end scenario testing** (4 hours)
- Real SD card with disk images
- Test Gotek SD card structure
- Test ZuluSCSI SD card structure
- Test edge cases (empty media, corrupted files)

**Acceptance Criteria:**
- ✅ Real-world SD cards tested
- ✅ Multiple floppy emulator formats verified
- ✅ Edge cases handled gracefully

**Task 5.3: Update README and documentation** (4 hours)
- Update `sampler-backup/README.md`
- Add local media workflow examples
- Update `docs/1.0/quick-start.md`
- Update `docs/1.0/examples.md`

**Acceptance Criteria:**
- ✅ README includes local media section
- ✅ Step-by-step guide for local media backup
- ✅ CLI examples updated
- ✅ Troubleshooting section added

**Task 5.4: User guide** (3 hours)
- Create `docs/1.0/local-media-guide.md`
- Platform-specific mount instructions
- Common workflows (Gotek, ZuluSCSI, etc.)
- Troubleshooting common issues

**Acceptance Criteria:**
- ✅ Clear instructions for each platform
- ✅ Screenshots or command examples
- ✅ Common error messages explained
- ✅ Links to related documentation

**Task 5.5: API documentation** (3 hours)
- JSDoc for all new public APIs
- Type documentation
- Example code snippets
- Integration examples

**Acceptance Criteria:**
- ✅ All public APIs documented
- ✅ TypeScript types exported correctly
- ✅ Example code tested

**Deliverables:**
- Updated README files
- New `docs/1.0/local-media-guide.md`
- Updated API documentation
- Cross-platform test results

**Dependencies:** Phases 1-4 complete

**Risks:**
- Documentation becoming stale
- **Mitigation:** Include docs in PR review process

---

## Testing Strategy

### Unit Tests

**Coverage Target:** 100% for new code

**Tools:**
- Vitest (existing test framework)
- Mock filesystem for testing
- Test fixtures (sample disk images)

**Test Categories:**
1. **MediaDetector tests**
   - Mount point detection
   - Disk image discovery
   - Platform-specific behavior
   - Error handling

2. **LocalBackupAdapter tests**
   - Incremental copy logic
   - Timestamp preservation
   - Progress tracking
   - Error scenarios

3. **Source abstraction tests**
   - Interface compliance
   - Factory pattern
   - Config validation
   - Error handling

### Integration Tests

**Scenarios:**
1. **Full backup workflow**
   - Detect media → backup → verify
   - Incremental backup (skip unchanged)
   - Multiple disk images

2. **Cross-source compatibility**
   - Remote backup → local extract
   - Local backup → local extract

3. **Error recovery**
   - Permission denied
   - Disk full
   - Interrupted backup

### End-to-End Tests

**Real-world scenarios:**
1. Gotek SD card with Akai disk images
2. ZuluSCSI SD card with multiple samplers
3. Manual disk image folder
4. Mixed remote + local sources

### Platform Tests

**Platforms:**
- macOS (primary)
- Linux (Ubuntu 22.04)
- Windows WSL (optional)

**Platform-specific tests:**
- Mount point detection
- Permission models
- Filesystem differences (case-sensitivity, etc.)

---

## Risk Assessment & Mitigation

### Risk 1: Filesystem Format Compatibility

**Risk:** Different filesystem formats (FAT32, exFAT, NTFS, HFS+) behave differently

**Impact:** Medium
**Probability:** Medium

**Mitigation:**
- Test with multiple filesystem formats
- Use Node.js `fs` module (abstracts platform differences)
- Document known limitations
- Graceful fallback to basic file operations

### Risk 2: Permission Issues

**Risk:** Mounted media may have restrictive permissions, especially on Linux

**Impact:** High
**Probability:** Medium

**Mitigation:**
- Detect permission errors early (test phase)
- Clear error messages with suggested fixes
- Document permission requirements
- Provide troubleshooting guide

### Risk 3: Large File Performance

**Risk:** Disk images can be > 1GB, causing memory/performance issues

**Impact:** Medium
**Probability:** Low

**Mitigation:**
- Use stream-based file copying
- Implement progress tracking
- Test with large files (> 2GB)
- Document expected performance

### Risk 4: Platform Differences

**Risk:** Mount point locations, permission models, filesystem behavior differs

**Impact:** High
**Probability:** High

**Mitigation:**
- Comprehensive cross-platform testing
- Platform-specific code paths where needed
- Document platform quirks
- CI testing on multiple platforms

### Risk 5: Breaking Existing Functionality

**Risk:** Changes to core backup system break existing remote workflows

**Impact:** Critical
**Probability:** Low

**Mitigation:**
- Source abstraction maintains existing code paths
- Comprehensive regression testing
- Backward compatibility tests
- Beta testing period

### Risk 6: User Configuration Complexity

**Risk:** Adding local media support makes configuration more complex

**Impact:** Medium
**Probability:** Medium

**Mitigation:**
- Sensible defaults (zero-config for simple cases)
- Clear CLI help text
- Progressive complexity (simple cases simple, advanced cases possible)
- Examples for common scenarios

---

## Success Metrics

### Functional Metrics

- ✅ **Zero-config local backup**: `akai-backup --source /Volumes/SD` works without setup
- ✅ **Detection speed**: < 5 seconds to scan mounted media and find disk images
- ✅ **Incremental performance**: < 1 second to detect unchanged files
- ✅ **Large file handling**: 1GB+ files copy without errors or excessive memory
- ✅ **Cross-platform**: Works on macOS, Linux, Windows WSL

### Quality Metrics

- ✅ **Test coverage**: 100% for new code, > 90% overall
- ✅ **Performance**: No regression in existing remote backup performance
- ✅ **Reliability**: Zero data loss or corruption in testing
- ✅ **Error handling**: All error cases have clear, actionable messages

### User Experience Metrics

- ✅ **Documentation**: Step-by-step guide for each platform
- ✅ **Examples**: Working examples for Gotek, ZuluSCSI, manual workflows
- ✅ **Troubleshooting**: Common issues documented with solutions
- ✅ **Backward compatibility**: Existing users not impacted

---

## Dependencies

### External Dependencies

**None required** - Implementation uses only existing dependencies:
- Node.js `fs` module (file operations)
- Node.js `path` module (path manipulation)
- Node.js `os` module (platform detection)
- Existing project dependencies (Vitest, Commander, etc.)

### Internal Dependencies

- Phase 2 depends on Phase 1 (MediaDetector)
- Phase 3 depends on Phase 2 (LocalBackupAdapter)
- Phase 4 depends on Phase 3 (Source abstraction)
- Phase 5 depends on Phases 1-4 (all features complete)

### External Factors

- **Rsnapshot**: Existing dependency, unchanged
- **Platform APIs**: Native filesystem APIs, stable across platforms
- **User environment**: Node.js 18+, existing requirement

---

## Timeline

### Estimated Duration: 11-15 days

**Phase 1: Media Detection** - 2-3 days
**Phase 2: Local Backup Adapter** - 3-4 days
**Phase 3: Source Abstraction** - 2-3 days
**Phase 4: CLI Integration** - 2 days
**Phase 5: Testing & Documentation** - 2-3 days

**Buffer:** 2-3 days for unexpected issues, additional testing

### Milestones

**Week 1:**
- ✅ Phase 1 complete: MediaDetector working on all platforms
- ✅ Phase 2 started: LocalBackupAdapter core logic implemented

**Week 2:**
- ✅ Phase 2 complete: LocalBackupAdapter tested and integrated
- ✅ Phase 3 complete: Source abstraction layer working
- ✅ Phase 4 started: CLI integration in progress

**Week 3:**
- ✅ Phase 4 complete: CLI fully integrated
- ✅ Phase 5 in progress: Cross-platform testing, documentation
- ✅ Ready for beta testing

---

## Future Enhancements

### Post-1.0 Features

**Hot-plug detection** (not in scope)
- Watch for newly inserted media
- Auto-trigger backup on media insertion
- Notification when backup complete

**GUI for media selection** (not in scope)
- Web-based dashboard
- Visual media browser
- One-click backup button

**Cloud sync** (not in scope)
- Sync backups to cloud storage (S3, Dropbox, etc.)
- Multi-device access
- Automatic offsite backup

**Advanced media detection** (not in scope)
- Detect disk image files inside archives (.zip, .tar.gz)
- Support for CD-ROM ISOs
- Support for Zip disk images

---

## Appendix

### A. File Structure

```
sampler-backup/
  src/
    backup/
      rsnapshot-wrapper.ts       # Existing
      local-backup-adapter.ts    # NEW
    cli/
      backup.ts                  # MODIFIED
    config/
      rsnapshot-config.ts        # Existing
    media/
      media-detector.ts          # NEW
    sources/
      backup-source.ts           # NEW
      remote-source.ts           # NEW
      local-source.ts            # NEW
      backup-source-factory.ts   # NEW
    types/
      index.ts                   # MODIFIED
  test/
    unit/
      media-detector.test.ts     # NEW
      local-backup-adapter.test.ts  # NEW
      sources/                   # NEW
    integration/
      local-backup.test.ts       # NEW
      cli-local-backup.test.ts   # NEW
```

### B. Example Usage

**Basic local media backup:**
```bash
# Insert SD card, mounted as /Volumes/SDCARD
akai-backup --source /Volumes/SDCARD

# Output:
# Scanning /Volumes/SDCARD for disk images...
# Found 5 disk images
# Backing up to ~/.audiotools/backup/daily.0/local-media/
#   ✓ disk1.hds (45 MB) - new
#   ✓ disk2.hds (80 MB) - new
#   ⊘ disk3.hds (45 MB) - unchanged
#   ✓ disk4.hds (120 MB) - modified
#   ✓ disk5.img (90 MB) - new
# Backup complete: 4 files copied, 1 skipped
```

**Extract from local backups:**
```bash
akai-extract batch --source ~/.audiotools/backup
# Uses existing batch extractor, works unchanged
```

**Mixed workflow:**
```bash
# Backup from remote PiSCSI
akai-backup backup daily

# Backup from local SD card
akai-backup --source /Volumes/GOTEK --subdir gotek-backups

# Extract everything
akai-extract batch
```

### C. References

- **ROADMAP.md**: Local Media Support section (lines 54-75)
- **DISTRIBUTION.md**: Distribution strategies
- **Existing code**: `sampler-backup/src/`, `sampler-export/src/`
- **Node.js fs docs**: https://nodejs.org/api/fs.html
- **Vitest docs**: https://vitest.dev/

---

**Document Status:** Ready for implementation
**Next Steps:** Begin Phase 1 - Media Detection
