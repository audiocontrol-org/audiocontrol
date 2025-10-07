# Parallel Backup Support with Per-Source Repositories

**Version:** 1.0
**Status:** Planning
**Date:** 2025-10-06

## Problem Statement

### Current Limitation

BorgBackup uses **exclusive repository locks** - only one backup operation can run at a time per repository.

**Current behavior:**
- All sources backup to single repository: `~/.audiotools/borg-repo`
- Attempting parallel backups fails with lock timeout
- Cannot backup local media while remote backup is running
- Cannot backup multiple remote hosts simultaneously

**Example failure:**
```
Failed to create/acquire the lock /Users/orion/.audiotools/borg-repo/lock.exclusive (timeout)
```

### Requirements

1. **Parallel backups** - Multiple sources backing up simultaneously
2. **Independent management** - Each source has its own repository
3. **Clear naming** - Repository names reflect their source
4. **Backward compatibility** - Migration path for existing single repository

## Solution: Hierarchical Sampler/Device Repositories

### Design Philosophy

**Purpose-built for sampler hardware** - Model the physical sampler setup, not generic file paths.

Each sampler has multiple storage devices (SCSI drives, floppy emulators), and each device gets its own repository. This matches the physical hardware configuration and makes it clear what data belongs to which sampler and which device.

### Repository Naming Scheme

**Hierarchical structure:** `~/.audiotools/borg/{sampler}/{device}/`

**Sampler name:**
- Remote sources: hostname (sanitized)
- Local sources: `--sampler` flag (required)

**Device name:**
- `scsi0`, `scsi1`, `scsi2`, etc. - SCSI devices by ID
- `floppy` - Floppy emulator (Gotek, HxC, etc.)
- Custom via `--device` flag

**Examples:**
```
~/.audiotools/borg/
├── pi-scsi2/                    # S5000 on pi-scsi2.local
│   ├── scsi0/                   # SCSI ID 0 (10GB drive)
│   ├── scsi1/                   # SCSI ID 1 (10GB drive)
│   └── floppy/                  # Floppy emulator
├── s3k-zulu/                    # S3000XL with ZuluSCSI
│   ├── scsi0/                   # ZuluSCSI virtual drive
│   └── floppy/                  # Gotek floppy emulator
└── s5k-studio/                  # Studio S5000
    ├── scsi0/                   # Main sample drive
    └── scsi1/                   # Additional sample drive
```

### Repository Path Resolution

**For remote sources:**
- Sampler: hostname (sanitized, `.local` removed)
- Device: from `--device` flag (required)

**For local sources:**
- Sampler: from `--sampler` flag (required)
- Device: from `--device` flag (required)

**Path formula:**
```
~/.audiotools/borg/{sampler}/{device}/
```

**Sanitization rules:**
- Remove `.local` suffix from hostnames
- Lowercase sampler names
- Replace spaces/special chars with hyphens
- Device names kept as-is (scsi0, floppy, etc.)

## Implementation Plan

### Phase 1: Repository Path Generator

**File:** `src/backup/repo-path-resolver.ts`

```typescript
export interface RepoPathConfig {
  /** Source type */
  sourceType: 'remote' | 'local';

  /** Sampler name (hostname for remote, required --sampler for local) */
  sampler?: string;

  /** Device name (scsi0, scsi1, floppy, etc.) - REQUIRED */
  device: string;

  /** Remote host (for remote sources) */
  host?: string;
}

export function resolveRepositoryPath(config: RepoPathConfig): string {
  const baseDir = join(homedir(), '.audiotools', 'borg');

  // Determine sampler name
  const samplerName = resolveSamplerName(config);

  // Validate device name
  if (!config.device) {
    throw new Error('Device name is required (--device scsi0|scsi1|floppy|...)');
  }

  // Build hierarchical path: {base}/{sampler}/{device}/
  return join(baseDir, samplerName, config.device);
}

function resolveSamplerName(config: RepoPathConfig): string {
  if (config.sourceType === 'remote') {
    // Remote: use hostname, sanitized
    if (!config.host) {
      throw new Error('Host is required for remote sources');
    }
    return sanitizeSamplerName(config.host);
  } else {
    // Local: require --sampler flag
    if (!config.sampler) {
      throw new Error(
        'Sampler name is required for local sources (use --sampler flag)\n' +
        'Example: --sampler s5k-studio --device floppy'
      );
    }
    return sanitizeSamplerName(config.sampler);
  }
}

function sanitizeSamplerName(name: string): string {
  return name
    .replace(/\.local$/, '')        // Remove .local suffix
    .toLowerCase()                   // Lowercase
    .replace(/[^a-z0-9-]/g, '-')    // Replace special chars with hyphens
    .replace(/-+/g, '-')             // Collapse multiple hyphens
    .replace(/^-|-$/g, '');          // Remove leading/trailing hyphens
}
```

### Phase 2: Update RemoteSource

**File:** `src/sources/remote-source.ts`

**Changes:**
1. Add `device` parameter to `RemoteSourceConfig`
2. Remove hardcoded `DEFAULT_REPO_PATH`
3. Use `resolveRepositoryPath()` with sampler/device hierarchy
4. Pass repo path to `BorgBackupAdapter`

**Updated Config:**
```typescript
export interface RemoteSourceConfig {
  type: 'remote';
  host: string;              // SSH host (e.g., "pi-scsi2.local")
  sourcePath: string;        // Remote path (e.g., "/home/orion/images/")
  backupSubdir: string;      // DEPRECATED: use device instead
  device: string;            // Device name (REQUIRED: scsi0, scsi1, floppy)
  sampler?: string;          // Optional: override sampler name (defaults to hostname)
}
```

**Implementation:**
```typescript
import { resolveRepositoryPath } from '@/backup/repo-path-resolver.js';

export class RemoteSource implements BackupSource {
  // ...

  constructor(
    private readonly config: RemoteSourceConfig,
    borgAdapter?: IBorgBackupAdapter,
    sshfsManager?: SSHFSManager,
    retentionPolicy?: BorgRetentionPolicy
  ) {
    this.retentionPolicy = retentionPolicy ?? DEFAULT_RETENTION;
    this.sshfsManager = sshfsManager ?? new SSHFSManager();

    // Resolve repository path using sampler/device hierarchy
    const repoPath = resolveRepositoryPath({
      sourceType: 'remote',
      host: this.config.host,
      sampler: this.config.sampler, // Optional override
      device: this.config.device,     // Required
    });

    // Create Borg adapter with hierarchical repository path
    this.borgAdapter = borgAdapter ?? new BorgBackupAdapter({
      repoPath,
      compression: 'zstd',
      encryption: 'none',
    });
  }

  // Rest of implementation unchanged
}
```

### Phase 3: Update LocalSource

**File:** `src/sources/local-source.ts`

**Changes:**
1. Add `sampler` and `device` parameters to `LocalSourceConfig`
2. Remove hardcoded `DEFAULT_REPO_PATH`
3. Use `resolveRepositoryPath()` with sampler/device hierarchy
4. Pass repo path to `BorgBackupAdapter`

**Updated Config:**
```typescript
export interface LocalSourceConfig {
  type: 'local';
  sourcePath: string;        // Local path (e.g., "/Volumes/DSK0")
  backupSubdir: string;      // DEPRECATED: use device instead
  sampler: string;           // Sampler name (REQUIRED: s5k-studio, s3k-zulu, etc.)
  device: string;            // Device name (REQUIRED: scsi0, scsi1, floppy)
  snapshotRoot?: string;     // DEPRECATED: not used with Borg
}
```

**Implementation:**
```typescript
import { resolveRepositoryPath } from '@/backup/repo-path-resolver.js';

export class LocalSource implements BackupSource {
  // ...

  constructor(
    private readonly config: LocalSourceConfig,
    mediaDetector?: MediaDetector,
    borgAdapter?: IBorgBackupAdapter,
    retentionPolicy?: BorgRetentionPolicy
  ) {
    this.mediaDetector = mediaDetector ?? new MediaDetector();
    this.retentionPolicy = retentionPolicy ?? DEFAULT_RETENTION;

    // Resolve repository path using sampler/device hierarchy
    const repoPath = resolveRepositoryPath({
      sourceType: 'local',
      sampler: this.config.sampler,   // Required
      device: this.config.device,     // Required
    });

    // Create Borg adapter with hierarchical repository path
    this.borgAdapter = borgAdapter ?? new BorgBackupAdapter({
      repoPath,
      compression: 'zstd',
      encryption: 'none',
    });
  }

  // Rest of implementation unchanged
}
```

### Phase 4: Update CLI Commands

**File:** `src/cli/backup.ts`

**Changes:**
1. Add `--sampler` flag (required for local sources)
2. Add `--device` flag (required for all sources)
3. Update `list` command to support sampler/device hierarchy
4. Update `info` command to support sampler/device hierarchy
5. Add validation for required flags

**Updated backup command:**
```bash
# Remote backup (sampler inferred from hostname)
akai-backup backup --source pi-scsi2.local:/home/orion/images/ --device scsi0

# Local backup (sampler required)
akai-backup backup --source /Volumes/DSK0 --sampler s5k-studio --device floppy

# Override sampler name for remote
akai-backup backup --source pi-scsi2.local:/home/orion/images/ --sampler my-s5k --device scsi1
```

**Implementation:**
```typescript
program
  .command("backup")
  .description("Run backup from remote hosts or local media")
  .argument("[interval]", "Backup interval: daily, weekly, monthly", "daily")
  .option("-s, --source <path>", "Source path (local or remote SSH)")
  .option("--sampler <name>", "Sampler name (REQUIRED for local sources)")
  .option("--device <name>", "Device name (REQUIRED: scsi0, scsi1, floppy, etc.)")
  .option("--subdir <name>", "DEPRECATED: use --device instead")
  .action(async (interval, options) => {
    // Validate device flag
    if (!options.device && !options.subdir) {
      console.error("Error: --device flag is required");
      console.error("Examples:");
      console.error("  --device scsi0   (SCSI ID 0)");
      console.error("  --device scsi1   (SCSI ID 1)");
      console.error("  --device floppy  (Floppy emulator)");
      process.exit(1);
    }

    // Handle deprecated --subdir flag
    const device = options.device || options.subdir;
    if (options.subdir && !options.device) {
      console.warn("Warning: --subdir is deprecated, use --device instead");
    }

    // Create source with device parameter
    const source = BackupSourceFactory.fromPath(options.source, {
      sampler: options.sampler,
      device: device,
    });

    // Run backup...
  });
```

**Updated list command:**
```typescript
program
  .command("list")
  .description("List backup archives")
  .option("--sampler <name>", "Show archives from specific sampler")
  .option("--device <name>", "Show archives from specific device")
  .option("--all", "Show archives from all repositories")
  .option("--json", "Output in JSON format")
  .action(async (options) => {
    if (options.all) {
      // List all samplers and devices
      await listAllRepositories(options.json);
    } else if (options.sampler && options.device) {
      // List specific repository
      await listRepository(options.sampler, options.device, options.json);
    } else if (options.sampler) {
      // List all devices for sampler
      await listSamplerRepositories(options.sampler, options.json);
    } else {
      // Show usage
      console.log("Specify --sampler, --device, or --all to list archives");
      console.log("\nExamples:");
      console.log("  akai-backup list --all");
      console.log("  akai-backup list --sampler pi-scsi2");
      console.log("  akai-backup list --sampler pi-scsi2 --device scsi0");
    }
  });
```

### Phase 5: Migration Utility

**File:** `src/cli/migrate.ts`

Create migration command to move existing single repository to per-source structure.

**Command:**
```bash
akai-backup migrate --from ~/.audiotools/borg-repo --dry-run
akai-backup migrate --from ~/.audiotools/borg-repo --execute
```

**Implementation:**
```typescript
program
  .command("migrate")
  .description("Migrate single repository to per-source repositories")
  .option("--from <path>", "Source repository path", DEFAULT_OLD_REPO_PATH)
  .option("--dry-run", "Show what would be done without executing")
  .option("--execute", "Execute the migration")
  .action(async (options) => {
    // 1. List archives in old repository
    // 2. Group by source (parse archive names)
    // 3. Create new repositories per source
    // 4. Copy archives to new repositories
    // 5. Verify new repositories
    // 6. Offer to delete old repository
  });
```

## Testing Strategy

### Unit Tests

**File:** `src/backup/repo-path-resolver.spec.ts`

```typescript
describe('resolveRepositoryPath', () => {
  it('creates hierarchical path for remote sources', () => {
    const path = resolveRepositoryPath({
      sourceType: 'remote',
      host: 'pi-scsi2.local',
      device: 'scsi0',
    });
    expect(path).toBe('/Users/test/.audiotools/borg/pi-scsi2/scsi0');
  });

  it('creates hierarchical path for local sources', () => {
    const path = resolveRepositoryPath({
      sourceType: 'local',
      sampler: 's5k-studio',
      device: 'floppy',
    });
    expect(path).toBe('/Users/test/.audiotools/borg/s5k-studio/floppy');
  });

  it('sanitizes sampler names', () => {
    const path = resolveRepositoryPath({
      sourceType: 'remote',
      host: 'My S5000.local',
      device: 'scsi1',
    });
    expect(path).toBe('/Users/test/.audiotools/borg/my-s5000/scsi1');
  });

  it('throws error if device is missing', () => {
    expect(() => {
      resolveRepositoryPath({
        sourceType: 'remote',
        host: 'pi-scsi2.local',
        device: '',
      });
    }).toThrow('Device name is required');
  });

  it('throws error if sampler is missing for local sources', () => {
    expect(() => {
      resolveRepositoryPath({
        sourceType: 'local',
        device: 'floppy',
      });
    }).toThrow('Sampler name is required for local sources');
  });

  it('allows sampler override for remote sources', () => {
    const path = resolveRepositoryPath({
      sourceType: 'remote',
      host: 'pi-scsi2.local',
      sampler: 'my-custom-s5k',
      device: 'scsi0',
    });
    expect(path).toBe('/Users/test/.audiotools/borg/my-custom-s5k/scsi0');
  });
});
```

### Integration Tests

1. **Parallel backups test**
   - Start backup from remote source (pi-scsi2.local, device scsi0)
   - Start backup from local source (s5k-studio, device floppy)
   - Verify both complete successfully
   - Verify separate repositories created at correct paths

2. **Repository hierarchy test**
   - Backup to `pi-scsi2/scsi0/`
   - Backup to `pi-scsi2/scsi1/`
   - Backup to `pi-scsi2/floppy/`
   - Verify archives in correct hierarchical structure
   - Verify each device has independent repository

3. **Sampler with multiple devices test**
   - Backup s5k-studio/scsi0
   - Backup s5k-studio/scsi1
   - Backup s5k-studio/floppy
   - Verify all under same sampler directory
   - Delete one device repo, verify others unaffected

4. **Migration test**
   - Create single repository with multiple sources
   - Run migration with sampler/device mapping
   - Verify archives distributed to hierarchical structure
   - Verify archive integrity

## File Structure Changes

**New files:**
```
src/
├── backup/
│   ├── repo-path-resolver.ts        # NEW: Hierarchical repository path resolution
│   └── repo-path-resolver.spec.ts   # NEW: Unit tests for path resolution
└── cli/
    └── migrate.ts                    # NEW: Migration command for old repos
```

**Modified files:**
```
src/
├── sources/
│   ├── remote-source.ts              # MODIFIED: Use sampler/device hierarchical repos
│   └── local-source.ts               # MODIFIED: Require sampler/device parameters
└── cli/
    └── backup.ts                     # MODIFIED: Add --sampler and --device flags
```

## Repository Structure

**Before (single repository):**
```
~/.audiotools/
└── borg-repo/                        # All sources mixed together
    ├── config
    ├── data/
    ├── index.N/
    └── lock.exclusive                # Global lock prevents parallel backups
```

**After (hierarchical sampler/device repositories):**
```
~/.audiotools/
└── borg/
    ├── pi-scsi2/                     # Sampler: pi-scsi2.local (hostname)
    │   ├── scsi0/                    # Device: SCSI ID 0
    │   │   ├── config
    │   │   ├── data/
    │   │   ├── index.N/
    │   │   └── lock.exclusive        # Independent lock
    │   ├── scsi1/                    # Device: SCSI ID 1
    │   │   ├── config
    │   │   ├── data/
    │   │   └── lock.exclusive        # Independent lock
    │   └── floppy/                   # Device: Floppy emulator
    │       ├── config
    │       ├── data/
    │       └── lock.exclusive        # Independent lock
    ├── s3k-zulu/                     # Sampler: s3k-zulu (via --sampler)
    │   ├── scsi0/                    # ZuluSCSI virtual drive
    │   │   ├── config
    │   │   └── data/
    │   └── floppy/                   # Gotek floppy emulator
    │       ├── config
    │       └── data/
    └── s5k-studio/                   # Sampler: s5k-studio (via --sampler)
        ├── scsi0/                    # Main sample drive
        │   ├── config
        │   └── data/
        └── scsi1/                    # Additional sample drive
            ├── config
            └── data/
```

**Key improvements:**
- Each device has its own repository with independent lock
- Hierarchical structure mirrors physical hardware setup
- Parallel backups possible across all devices
- Clear organization by sampler and device

## Migration Path

### Backward Compatibility Strategy

**Approach: Auto-detect with guided migration**

1. **Detection Phase**
   - Check if `~/.audiotools/borg-repo` (old single repository) exists
   - If found, show deprecation warning on first run
   - Explain hierarchical structure benefits

2. **Migration Options**

   **Option A: Assisted migration (recommended)**
   ```bash
   # Interactive migration with sampler/device mapping
   akai-backup migrate --interactive

   # Prompts:
   # "Archive pi-scsi2-daily-2025-10-01 detected"
   # "Enter sampler name (hostname: pi-scsi2): " [pi-scsi2]
   # "Enter device (scsi0, scsi1, floppy): " [scsi0]
   ```

   **Option B: Manual specification**
   ```bash
   # Map specific archive patterns to sampler/device
   akai-backup migrate \
     --pattern "pi-scsi2-*" --sampler pi-scsi2 --device scsi0 \
     --pattern "s3k-*" --sampler s3k-zulu --device scsi0 \
     --dry-run
   ```

   **Option C: Leave old repository**
   ```bash
   # Keep old repository, use new structure going forward
   # Old: ~/.audiotools/borg-repo (read-only, manual access)
   # New: ~/.audiotools/borg/{sampler}/{device}/ (active)
   ```

3. **Migration Steps**

   ```bash
   # 1. Dry run to preview migration
   akai-backup migrate --from ~/.audiotools/borg-repo --dry-run

   # Output:
   # Archive: pi-scsi2-daily-2025-10-01
   #   → pi-scsi2/scsi0/
   # Archive: s3k-weekly-2025-09-24
   #   → s3k-zulu/scsi0/

   # 2. Execute migration
   akai-backup migrate --from ~/.audiotools/borg-repo --execute

   # 3. Verify new repositories
   akai-backup list --all

   # 4. Archive old repository
   mv ~/.audiotools/borg-repo ~/.audiotools/borg-repo.old
   ```

4. **No Automatic Migration**
   - Never automatically migrate without user confirmation
   - Always require explicit `--execute` flag
   - Default to `--dry-run` for safety
   - Keep old repository until user manually deletes it

**Recommendation:** Option C (leave old repository) is safest. Users can manually migrate specific archives as needed, or just use new structure going forward.

## Benefits

1. **Parallel Backups** - Each device has independent repository and lock
   - Backup pi-scsi2/scsi0 while backing up pi-scsi2/scsi1 simultaneously
   - Backup local floppy while backing up remote SCSI drives
   - No waiting for other backups to complete

2. **Hardware-Centric Organization** - Structure mirrors physical sampler setup
   - Each sampler (pi-scsi2, s3k-zulu, s5k-studio) has its own directory
   - Each storage device (scsi0, scsi1, floppy) clearly identified
   - Intuitive navigation matching actual hardware configuration

3. **Independent Management** - Per-device repository operations
   - Prune old archives from scsi0 without affecting scsi1
   - Delete floppy repository without affecting SCSI repositories
   - Restore specific device archives without searching mixed repository

4. **Better Debugging** - Issues isolated to specific sampler/device
   - Corruption in scsi0 repository doesn't affect scsi1
   - Lock issues isolated to single device
   - Clear error messages identifying exact sampler and device

5. **Scalability** - Add samplers and devices without affecting existing ones
   - Add new sampler without touching existing repositories
   - Add new device (scsi2, scsi3) without modifying existing devices
   - Each repository grows independently

6. **Naming Collision Prevention** - Hierarchical structure solves duplicate disk names
   - Multiple floppy emulators with "DSK0" name can coexist
   - Each under different sampler directory (s5k-studio/floppy, s3k-zulu/floppy)
   - No ambiguity about which disk belongs to which sampler

## Risks & Mitigations

### Risk: Increased Disk Usage

**Issue:** Multiple repositories = less deduplication across device repositories

**Impact:**
- Single repository deduplicates chunks across all sources
- Hierarchical structure deduplicates only within each device repository
- Potential for duplicate chunks across devices (if same data backed up to multiple devices)

**Mitigation:**
- Sampler devices rarely share data (each SCSI drive has unique content)
- Floppy and SCSI contain different samples/programs
- Within-device deduplication still works (incremental backups)
- Storage cost is minimal compared to parallelism benefit
- Disk space is cheap; backup time is valuable

**Recommendation:** Accept minor storage increase for major performance gain

### Risk: Complex Migration

**Issue:** Users may have large existing single repositories

**Impact:**
- Migration requires mapping archives to sampler/device hierarchy
- Archive names may not clearly indicate source device
- Large repositories take time to migrate

**Mitigation:**
- Provide interactive migration with smart defaults
- Allow pattern-based mapping (e.g., "pi-scsi2-*" → pi-scsi2/scsi0)
- Default to leaving old repository intact (Option C)
- Migration is optional, not required
- Clear documentation with examples

**Recommendation:** Don't force migration; let users adopt new structure gradually

### Risk: Required CLI Flags

**Issue:** Users must specify `--sampler` and `--device` for backups

**Impact:**
- More typing required for backup commands
- Risk of typos in sampler/device names
- Less convenient than single repository

**Mitigation:**
- Remote sources auto-detect sampler from hostname
- Clear error messages when flags missing
- Shell completion for common sampler/device names
- Batch command supports config files
- Examples in `--help` output

**Recommendation:** Convenience of clear organization outweighs slight increase in typing

### Risk: CLI Complexity for Listing

**Issue:** `list`/`info` commands need to handle multiple repositories

**Impact:**
- `list` without flags is ambiguous (which repository?)
- Users must remember sampler/device names
- More complex output when listing all repositories

**Mitigation:**
- Default `list` to showing all repositories (hierarchical tree view)
- Add `--sampler` and `--device` flags for filtering
- Provide `--all` flag for explicit full listing
- Clear usage examples in help text
- Tree view shows hierarchical structure clearly

**Recommendation:** Enhanced organization provides better UX than single flat list

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `src/backup/repo-path-resolver.ts`
  - [ ] Implement `resolveRepositoryPath()` function
  - [ ] Implement `resolveSamplerName()` function
  - [ ] Implement `sanitizeSamplerName()` function
  - [ ] Add validation for required parameters
- [ ] Write unit tests for `repo-path-resolver.spec.ts`
  - [ ] Test remote source path resolution
  - [ ] Test local source path resolution
  - [ ] Test sampler name sanitization
  - [ ] Test error cases (missing device, missing sampler)
  - [ ] Test sampler override for remote sources

### Phase 2: Source Updates
- [ ] Update `src/sources/remote-source.ts`
  - [ ] Add `device` field to `RemoteSourceConfig`
  - [ ] Add optional `sampler` field for override
  - [ ] Remove hardcoded `DEFAULT_REPO_PATH`
  - [ ] Use `resolveRepositoryPath()` in constructor
  - [ ] Update tests for hierarchical paths
- [ ] Update `src/sources/local-source.ts`
  - [ ] Add `sampler` field to `LocalSourceConfig` (required)
  - [ ] Add `device` field to `LocalSourceConfig` (required)
  - [ ] Remove hardcoded `DEFAULT_REPO_PATH`
  - [ ] Use `resolveRepositoryPath()` in constructor
  - [ ] Update tests for hierarchical paths

### Phase 3: CLI Updates
- [ ] Update `src/cli/backup.ts` backup command
  - [ ] Add `--sampler <name>` flag
  - [ ] Add `--device <name>` flag (required)
  - [ ] Add validation for required flags
  - [ ] Update `BackupSourceFactory.fromPath()` to pass sampler/device
  - [ ] Add deprecation warning for `--subdir` flag
- [ ] Update `src/cli/backup.ts` list command
  - [ ] Add `--sampler <name>` flag (filter by sampler)
  - [ ] Add `--device <name>` flag (filter by device)
  - [ ] Add `--all` flag (list all repositories)
  - [ ] Implement hierarchical tree view output
  - [ ] Implement `listAllRepositories()` function
  - [ ] Implement `listSamplerRepositories()` function
  - [ ] Implement `listRepository()` function
- [ ] Update `src/cli/backup.ts` info/restore commands
  - [ ] Add sampler/device specification support
  - [ ] Update help text with examples

### Phase 4: Migration Utility
- [ ] Create `src/cli/migrate.ts`
  - [ ] Implement `--interactive` mode
  - [ ] Implement `--pattern` mapping mode
  - [ ] Implement `--dry-run` preview
  - [ ] Implement `--execute` migration
  - [ ] Add archive listing and grouping
  - [ ] Add repository creation per sampler/device
  - [ ] Add archive copying/moving
  - [ ] Add verification step
- [ ] Add migration command to CLI
- [ ] Write migration tests

### Phase 5: Testing
- [ ] Integration test: Parallel backups
  - [ ] Backup pi-scsi2/scsi0 and s5k-studio/floppy simultaneously
  - [ ] Verify no lock contention
  - [ ] Verify both complete successfully
- [ ] Integration test: Repository hierarchy
  - [ ] Backup multiple devices for same sampler
  - [ ] Verify correct hierarchical structure
  - [ ] Verify independent repositories
- [ ] Integration test: Migration
  - [ ] Create single repository with mixed archives
  - [ ] Run migration with sampler/device mapping
  - [ ] Verify hierarchical structure created
  - [ ] Verify archive integrity

### Phase 6: Documentation
- [ ] Update main README with hierarchical structure examples
- [ ] Document `--sampler` and `--device` flags
- [ ] Add migration guide
- [ ] Add troubleshooting for common issues
- [ ] Update batch configuration examples

## Success Criteria

### Functional Requirements
- [ ] Can run parallel backups from multiple devices simultaneously
  - [ ] Remote backup pi-scsi2/scsi0 while backing up pi-scsi2/scsi1
  - [ ] Local backup s5k-studio/floppy while backing up remote pi-scsi2/scsi0
  - [ ] No lock contention or timeout errors
- [ ] Hierarchical repository structure created correctly
  - [ ] `~/.audiotools/borg/{sampler}/{device}/` paths
  - [ ] Sampler names sanitized from hostnames
  - [ ] Device names preserved (scsi0, scsi1, floppy)
- [ ] CLI flags work as specified
  - [ ] `--device` flag required for all backups
  - [ ] `--sampler` flag required for local backups
  - [ ] `--sampler` flag optional for remote backups (override)
  - [ ] Clear error messages when required flags missing

### Repository Management
- [ ] Each device has independent repository with own lock
- [ ] Repository paths clearly identify sampler and device
- [ ] Archives stored in correct hierarchical location
- [ ] List commands show hierarchical tree structure
- [ ] Can prune/delete individual device repositories without affecting others

### Migration
- [ ] Migration command detects old single repository
- [ ] Dry-run mode shows preview without executing
- [ ] Interactive mode prompts for sampler/device mapping
- [ ] Pattern mode allows batch mapping
- [ ] Archive integrity verified after migration
- [ ] Old repository preserved until manually deleted

### Testing
- [ ] All unit tests pass (repo-path-resolver)
- [ ] All integration tests pass (parallel backups, hierarchy, migration)
- [ ] No regressions in existing functionality
- [ ] Performance: parallel backups faster than sequential

### Documentation
- [ ] README updated with hierarchical structure examples
- [ ] CLI help text includes `--sampler` and `--device` flags
- [ ] Migration guide documented
- [ ] Troubleshooting guide updated
- [ ] Batch configuration examples updated

---

**Next Steps:**
1. Review and approve this workplan
2. Implement `repo-path-resolver.ts`
3. Update source classes
4. Test parallel backups
5. Create migration utility
