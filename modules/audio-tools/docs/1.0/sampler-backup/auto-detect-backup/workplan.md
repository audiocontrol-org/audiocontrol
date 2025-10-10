# Auto-Detect Backup Implementation Workplan

**Version:** 1.0.0
**Created:** 2025-10-09
**Updated:** 2025-10-09
**Status:** ✅ Complete - Ready for Testing
**Estimated Duration:** 5 days
**Actual Duration:** 1 day
**Target Release:** v1.1.0

## 📊 Implementation Progress

### Phase 1: Interactive Device Selection ✅ Complete
- [x] Create interactive prompt service (`interactive-prompt.ts` - 273 lines)
- [x] Implement device type selection (4 device types with descriptions)
- [x] Implement sampler selection (existing + new with validation)
- [x] Add validation and error handling (UserCancelledError, input validation)
- [x] Write tests (24 tests, all passing)

**Deliverables:**
- `src/lib/prompt/interactive-prompt.ts` (273 lines)
- `src/lib/prompt/interactive-prompt.test.ts` (349 lines, 24 tests)
- Dependencies: inquirer ^9.2.0, @types/inquirer ^9.0.0

### Phase 2: Auto-Detection Integration ✅ Complete
- [x] Integrate lib-device-uuid for auto-detection
- [x] Implement device type inference (11 filesystem patterns)
- [x] Add smart defaults based on filesystem (FAT12/16→floppy, FAT32→hard-drive, ISO9660→cd-rom)
- [x] Handle detection failures gracefully (fallback to path-based extraction)

**Deliverables:**
- `src/lib/device/auto-detect-backup.ts` (368 lines, 98.36% coverage)
- `src/lib/device/auto-detect-backup.test.ts` (736 lines, 33 tests)
- Filesystem inference for: FAT12, FAT16, FAT32, vfat, exFAT, NTFS, ext4, HFS+, ISO9660, CDFS, UDF

### Phase 3: Configuration Auto-Update ✅ Complete
- [x] Implement auto-save after device resolution (registered/recognized/created actions)
- [x] Add duplicate detection (UUID-based device matching)
- [x] Handle config migration (backward compatible with existing configs)
- [x] Write integration tests (CLI integration verified)

**Deliverables:**
- Modified `src/cli/backup.ts` (added `autoDetectLocalDevice()` and `isLocalMountPath()`)
- Auto-update config on `registered` and `recognized` actions
- Dry-run mode support (preview without saving)
- Backward compatibility preserved for all existing commands

### Phase 4: Testing & Documentation ⏸️ Pending
- [ ] End-to-end testing with real devices
- [ ] Documentation updates (README, user guide)
- [ ] Migration guide for existing users

## 🎯 Core Design Principle

**Guide users to success with minimal required information.**

The system should work with just:
```bash
audiotools backup /Volumes/SDCARD
```

And intelligently prompt for only what's missing:
- ❓ Device type (if not provided)
- ❓ Sampler (if not provided)
- ✅ Everything else auto-detected (UUID, label, filesystem)

**Progressive Disclosure:**
- Minimal command: `audiotools backup <path>` → interactive prompts
- Partial info: `audiotools backup <path> --device floppy` → prompt for sampler only
- Full info: `audiotools backup <path> --device floppy --sampler s5000` → no prompts

---

## Executive Summary

### Problem Statement

The backup CLI currently requires manual configuration of backup sources. When users want to backup a new device, they must:

1. Run `audiotools config` to open the configuration wizard
2. Add a new backup source with all details
3. Save the configuration
4. Then run the backup command

This friction discourages quick backups and makes the tool less accessible for first-time users. Users with multiple SD cards or USB drives must pre-configure each device before they can back it up.

### Goal

Enable users to backup devices with **minimal required information** by intelligently prompting for missing details. The system should guide users to success with the simplest possible command.

**Design Principle:** Ask for only what's needed, when it's needed.

The system should:

1. **Work with just a path**: `audiotools backup /Volumes/SDCARD` prompts for missing info
2. **Auto-detect device characteristics** (UUID, label, filesystem)
3. **Infer device type** from filesystem and path when possible
4. **Provide smart interactive prompts** for missing required fields
5. **Track devices by UUID** using the existing device-uuid system
6. **Save configuration automatically** so subsequent backups require zero interaction

### User Benefits

- **Minimal command**: `audiotools backup /Volumes/SDCARD` - system asks for what it needs
- **Smart defaults**: Device type inferred from path/filesystem when possible
- **Guided experience**: Clear prompts with helpful context
- **Zero friction on repeat**: First backup creates config, subsequent backups just work
- **Progressive disclosure**: Advanced options available but not required

### Key Features

**Feature 1: Minimal Command with Smart Prompting**
```bash
audiotools backup /Volumes/SDCARD
```
System detects:
- ✅ Path: /Volumes/SDCARD
- ✅ UUID: 1234-5678 (auto-detected)
- ✅ Label: SDCARD (auto-detected)
- ✅ Filesystem: FAT32 (auto-detected)
- ❓ Device type: (prompts: floppy, hard-drive, cd-rom, other)
- ❓ Sampler: (prompts: list of existing samplers + "Add new")

**Feature 2: Partial Info with Smart Defaults**
```bash
audiotools backup /Volumes/SDCARD --device floppy
```
System knows device type, only asks for sampler.

**Feature 3: Full Info Skips All Prompts**
```bash
audiotools backup /Volumes/SDCARD --device floppy --sampler s5000
```
System has everything, creates source and backs up immediately.

---

## Current State Analysis

### How Flag-Based Backup Currently Works

The current implementation in `/Users/orion/work/ol_dsp/modules/audio-tools/sampler-backup/src/cli/backup.ts` has two modes:

**1. Config-Based Backup (Default)**
```bash
audiotools backup                    # All enabled sources
audiotools backup pi-scsi2           # Specific source by name
```

**2. Flag-Based Backup (Override)**
```bash
audiotools backup --source pi@host:/path --device images --sampler s5000
```

**Current Flag-Based Logic:**
```typescript
async function handleSyncCommand(options: any): Promise<void> {
  // Detect source type
  const isRemote = isRemotePath(options.source);

  // For local sources, require --sampler
  if (!isRemote && !options.sampler) {
    console.error("Error: --sampler is required for local sources");
    process.exit(1);
  }

  // Create source instance directly (NOT added to config)
  let source;
  if (isRemote) {
    const config: RemoteSourceConfig = { /* ... */ };
    source = new RemoteSource(config);
  } else {
    const config: LocalSourceConfig = { /* ... */ };
    source = new LocalSource(config);
  }

  // Perform backup (one-time, not saved)
  await backupSource(source, options.dryRun);
}
```

### What Happens When Source Doesn't Exist

Currently, flag-based backups bypass the configuration system entirely:

1. User runs: `audiotools backup /Volumes/SDCARD --device floppy --sampler s5000`
2. System creates a `LocalSource` instance directly
3. Backup is performed
4. **Source is NOT saved to configuration**
5. Next backup requires same flags again

**Gap:** No persistence, no UUID tracking, no config integration.

### Current Limitations

1. **No auto-save**: Flag-based sources are ephemeral (not saved to config)
2. **No UUID tracking**: Device UUID system not invoked for flag-based backups
3. **No source existence check**: System doesn't check if source already exists in config
4. **Requires all flags**: User must specify both `--device` and `--sampler` every time
5. **No interactive mode**: No way to prompt user for missing information

---

## Proposed Solution

### Architecture Overview

We'll enhance the existing `handleSyncCommand()` function to:

1. **Check config for existing source** (by mount path or UUID)
2. **Auto-create source if not found** (with UUID detection)
3. **Save config automatically** (so device is recognized next time)
4. **Interactive mode** when `--sampler` is omitted

### Auto-Detect Flow (with --sampler)

```
User: audiotools backup /Volumes/SDCARD --device floppy --sampler s5000

┌─────────────────────────────────────────────────────┐
│ 1. Load config                                      │
│    Check if source exists:                          │
│    - By mount path: /Volumes/SDCARD                 │
│    - By UUID (if detected)                          │
└────────────┬────────────────────────────────────────┘
             │
       ┌─────┴─────┐
       │   Exists? │
       └─────┬─────┘
             │
     ┌───────┴────────┐
     │ No             │ Yes → Use existing source
     ▼                │
┌────────────────────────────────────────────────────┐
│ 2. Auto-create source:                             │
│    a. Detect device UUID (lib-device-uuid)         │
│    b. Generate unique name: "s5000-floppy"         │
│       (or "s5000-floppy-2" if exists)              │
│    c. Create BackupSource:                         │
│       {                                             │
│         name: "s5000-floppy",                      │
│         type: "local",                             │
│         source: "/Volumes/SDCARD",                 │
│         device: "floppy",                          │
│         sampler: "s5000",                          │
│         enabled: true,                             │
│         volumeUUID: "1234-5678-...",               │
│         registeredAt: "2025-10-09T..."             │
│       }                                             │
└────────────┬───────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ 3. Add to config and save                          │
│    config.backup.sources.push(newSource)           │
│    await saveConfig(config)                        │
│    Display: "📝 Auto-created backup source: ..."   │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ 4. Proceed with backup                             │
│    Use DeviceResolver for UUID tracking            │
│    Perform incremental backup                      │
└─────────────────────────────────────────────────────┘
```

### Interactive Sampler Selection Flow (without --sampler)

```
User: audiotools backup /Volumes/GOTEK --device floppy

┌─────────────────────────────────────────────────────┐
│ 1. Load config, check for existing source          │
└────────────┬────────────────────────────────────────┘
             │
       ┌─────┴─────┐
       │   Exists? │
       └─────┬─────┘
             │
     ┌───────┴────────┐
     │ No             │ Yes → Use existing
     ▼                │
┌────────────────────────────────────────────────────┐
│ 2. Detect device UUID and display info:            │
│                                                     │
│    Device detected: /Volumes/GOTEK                 │
│      UUID: ABCD-1234-5678-EF90                     │
│      Label: GOTEK                                  │
│      Filesystem: FAT32                             │
│                                                     │
└────────────┬───────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ 3. Extract unique samplers from existing config:   │
│    const samplers = new Set<string>();             │
│    config.backup.sources.forEach(s => {            │
│      if (s.sampler) samplers.add(s.sampler);       │
│    });                                              │
│    → ["s3000", "s5000", "s6000"]                   │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ 4. Present interactive menu (inquirer):            │
│                                                     │
│    ? Which sampler does this device belong to?     │
│    ❯ s3000                                         │
│      s5000                                         │
│      s6000                                         │
│      ─────────────                                 │
│      Add new sampler...                            │
│                                                     │
└────────────┬────────────────────────────────────────┘
             │
       ┌─────┴─────┐
       │  Existing │  New sampler
       ▼           ▼
   ┌───────┐   ┌──────────────────────┐
   │Use    │   │ ? Enter new sampler: │
   │value  │   │ > s5k-studio         │
   └───┬───┘   └──────┬───────────────┘
       │              │
       └──────┬───────┘
              ▼
┌─────────────────────────────────────────────────────┐
│ 5. Generate source name                            │
│    generateSourceName("s3000", "floppy", config)   │
│    → "s3000-floppy" or "s3000-floppy-2"            │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│ 6. Create BackupSource, save, backup              │
│    (same as auto-detect flow)                      │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Auto-Detect with --sampler (Days 1-2)

**Goal:** Enable automatic source creation when both flags are provided

#### Task 1.1: Source Existence Check (3 hours)

**Location:** `sampler-backup/src/cli/backup.ts`

**Implementation:**
```typescript
/**
 * Check if a source exists in config by mount path or UUID
 *
 * @param config - Audio tools configuration
 * @param mountPath - Path to check
 * @param deviceUUID - Optional UUID to check
 * @returns Matching BackupSource or null
 */
function findExistingSource(
  config: AudioToolsConfig,
  mountPath: string,
  deviceUUID?: string
): BackupSource | null {
  const sources = config.backup?.sources || [];

  // Try to match by UUID first (most reliable)
  if (deviceUUID) {
    const uuidMatch = sources.find((s: BackupSource) =>
      s.volumeUUID === deviceUUID
    );
    if (uuidMatch) return uuidMatch;
  }

  // Fall back to mount path match
  const pathMatch = sources.find((s: BackupSource) =>
    s.source === mountPath
  );
  return pathMatch || null;
}
```

**Testing:**
- Test with existing source (by UUID)
- Test with existing source (by path)
- Test with non-existent source
- Test with no config sources

#### Task 1.2: Source Name Generation (2 hours)

**Location:** `sampler-backup/src/cli/backup.ts`

**Implementation:**
```typescript
/**
 * Generate a unique source name for auto-created sources
 *
 * Format: "{sampler}-{device}" with numeric suffix if exists
 * Examples: "s5000-floppy", "s5000-floppy-2", "s3000xl-scsi-3"
 *
 * @param sampler - Sampler name (e.g., "s5000")
 * @param device - Device name (e.g., "floppy")
 * @param config - Config to check for existing names
 * @returns Unique source name
 */
function generateSourceName(
  sampler: string,
  device: string,
  config: AudioToolsConfig
): string {
  const sources = config.backup?.sources || [];
  const baseName = `${sampler}-${device}`;

  // Check if base name exists
  const exists = sources.some((s: BackupSource) => s.name === baseName);
  if (!exists) {
    return baseName;
  }

  // Find next available numeric suffix
  let suffix = 2;
  while (true) {
    const candidate = `${baseName}-${suffix}`;
    const candidateExists = sources.some((s: BackupSource) =>
      s.name === candidate
    );
    if (!candidateExists) {
      return candidate;
    }
    suffix++;
  }
}
```

**Testing:**
- Test with no conflicts
- Test with single conflict (→ -2 suffix)
- Test with multiple conflicts (→ -3, -4, etc.)
- Test edge cases (empty config, etc.)

#### Task 1.3: Auto-Create Source Logic (4 hours)

**Location:** `sampler-backup/src/cli/backup.ts`

**Implementation:**
```typescript
/**
 * Auto-create and save a backup source from flags
 *
 * @param mountPath - Source mount path
 * @param device - Device name
 * @param sampler - Sampler name
 * @param config - Current configuration
 * @returns Created BackupSource
 */
async function autoCreateSource(
  mountPath: string,
  device: string,
  sampler: string,
  config: AudioToolsConfig
): Promise<BackupSource> {
  // 1. Detect device UUID (non-fatal)
  let deviceInfo: { volumeUUID?: string; volumeLabel?: string } = {};

  try {
    const detector = new DeviceMatcher();
    const result = await detector.matchDevice(mountPath, []);
    if (result.matched && result.deviceInfo) {
      deviceInfo = {
        volumeUUID: result.deviceInfo.volumeUUID,
        volumeLabel: result.deviceInfo.volumeLabel
      };
    }
  } catch (error: any) {
    // Non-fatal: continue without UUID
    console.warn(`⚠️  Could not detect device UUID: ${error.message}`);
    console.warn(`   Source will be created without UUID tracking`);
  }

  // 2. Generate unique name
  const sourceName = generateSourceName(sampler, device, config);

  // 3. Create BackupSource
  const now = new Date().toISOString();
  const newSource: BackupSource = {
    name: sourceName,
    type: 'local',
    source: mountPath,
    device,
    sampler,
    enabled: true,
    ...deviceInfo,
    registeredAt: now,
    lastSeen: now
  };

  // 4. Add to config
  const updatedConfig = addBackupSource(config, newSource);

  // 5. Save config
  await saveConfig(updatedConfig);

  console.log(`\n📝 Auto-created backup source: ${sourceName}`);
  if (deviceInfo.volumeUUID) {
    console.log(`   UUID: ${deviceInfo.volumeUUID}`);
  }
  if (deviceInfo.volumeLabel) {
    console.log(`   Label: ${deviceInfo.volumeLabel}`);
  }
  console.log(`✓ Configuration updated\n`);

  return newSource;
}
```

**Testing:**
- Test with successful UUID detection
- Test with failed UUID detection (non-fatal)
- Test config save
- Test duplicate name handling

#### Task 1.4: Integrate into handleSyncCommand (3 hours)

**Location:** `sampler-backup/src/cli/backup.ts`

**Changes to handleSyncCommand:**
```typescript
async function handleSyncCommand(options: any): Promise<void> {
  try {
    // NEW: Load config to check for existing source
    const config = await loadConfig();

    const isRemote = isRemotePath(options.source);

    // For local sources, require --sampler
    if (!isRemote && !options.sampler) {
      console.error("Error: --sampler is required for local sources");
      console.error("Example: --sampler s5k-studio");
      process.exit(1);
    }

    // NEW: Check if source already exists
    let existingSource: BackupSource | null = null;
    if (!isRemote) {
      // Try to detect UUID first for better matching
      let detectedUUID: string | undefined;
      try {
        const matcher = new DeviceMatcher();
        const result = await matcher.matchDevice(options.source, []);
        if (result.matched && result.deviceInfo?.volumeUUID) {
          detectedUUID = result.deviceInfo.volumeUUID;
        }
      } catch {
        // Ignore detection failures
      }

      existingSource = findExistingSource(config, options.source, detectedUUID);
    }

    // NEW: If source exists, use config-based workflow
    if (existingSource) {
      console.log(`Using existing source: ${existingSource.name}\n`);
      return handleBackupCommand(existingSource.name, { ...options, source: undefined });
    }

    // NEW: If local and doesn't exist, auto-create
    if (!isRemote) {
      const newSource = await autoCreateSource(
        options.source,
        options.device,
        options.sampler,
        config
      );

      // Use config-based workflow for newly created source
      return handleBackupCommand(newSource.name, { ...options, source: undefined });
    }

    // EXISTING: Remote source logic (unchanged)
    const { host, sourcePath } = parseRemotePath(options.source);
    const sampler = options.sampler ?? samplerNameFromHost(host);

    const remoteConfig: RemoteSourceConfig = {
      type: 'remote',
      host,
      sourcePath,
      device: options.device,
      sampler,
    };

    const source = new RemoteSource(remoteConfig);
    await backupSource(source, options.dryRun);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
```

**Testing:**
- Test auto-create for new local source
- Test using existing source (by UUID)
- Test using existing source (by path)
- Test remote sources (unchanged behavior)
- Test dry-run mode
- Test error handling

**Deliverables:**
- Updated `handleSyncCommand()` function
- Helper functions: `findExistingSource()`, `generateSourceName()`, `autoCreateSource()`
- Unit tests for helper functions
- Integration tests for full auto-create flow

**Acceptance Criteria:**
- ✅ `audiotools backup /Volumes/SDCARD --device floppy --sampler s5000` creates source
- ✅ Source saved to config with UUID (if detected)
- ✅ Subsequent backups recognize existing source
- ✅ Unique names generated (s5000-floppy-2, etc.)
- ✅ Non-fatal UUID detection (backup continues without UUID)
- ✅ Clear user feedback (📝 messages)

---

### Phase 2: Interactive Sampler Selection (Days 3-4)

**Goal:** Enable interactive mode when `--sampler` is omitted

#### Task 2.1: Add inquirer Dependency (30 minutes)

**Package:** `inquirer` (already used in `audiotools-config`)

**Action:**
```bash
cd /Users/orion/work/ol_dsp/modules/audio-tools/sampler-backup
pnpm add inquirer
pnpm add -D @types/inquirer
```

**Verification:**
- Import succeeds
- TypeScript types available
- No version conflicts with audiotools-config

#### Task 2.2: Extract Unique Samplers (1 hour)

**Location:** `sampler-backup/src/cli/backup.ts`

**Implementation:**
```typescript
/**
 * Extract unique sampler names from config sources
 *
 * @param config - Audio tools configuration
 * @returns Sorted array of unique sampler names
 */
function getUniqueSamplers(config: AudioToolsConfig): string[] {
  const samplers = new Set<string>();
  const sources = config.backup?.sources || [];

  sources.forEach((s: BackupSource) => {
    if (s.sampler) {
      samplers.add(s.sampler);
    }
  });

  return Array.from(samplers).sort();
}
```

**Testing:**
- Test with no sources
- Test with sources without sampler field
- Test with duplicate samplers (deduplication)
- Test sorting

#### Task 2.3: Interactive Prompt Implementation (4 hours)

**Location:** `sampler-backup/src/cli/backup.ts`

**Implementation:**
```typescript
import inquirer from 'inquirer';

/**
 * Prompt user to select sampler interactively
 *
 * @param config - Config to extract existing samplers from
 * @param deviceInfo - Device info to display
 * @returns Selected sampler name
 */
async function promptForSampler(
  config: AudioToolsConfig,
  deviceInfo: { mountPoint: string; uuid?: string; label?: string }
): Promise<string> {
  // Display device info
  console.log(`\nDevice detected: ${deviceInfo.mountPoint}`);
  if (deviceInfo.uuid) {
    console.log(`  UUID: ${deviceInfo.uuid}`);
  }
  if (deviceInfo.label) {
    console.log(`  Label: ${deviceInfo.label}`);
  }
  console.log('');

  // Get existing samplers
  const existingSamplers = getUniqueSamplers(config);

  // Build choices
  const choices = [
    ...existingSamplers,
    new inquirer.Separator(),
    { name: 'Add new sampler...', value: '__new__' }
  ];

  // Prompt for selection
  const { sampler } = await inquirer.prompt([{
    type: 'list',
    name: 'sampler',
    message: 'Which sampler does this device belong to?',
    choices
  }]);

  // If new sampler, prompt for name
  if (sampler === '__new__') {
    const { newSampler } = await inquirer.prompt([{
      type: 'input',
      name: 'newSampler',
      message: 'Enter new sampler name:',
      validate: (input) => {
        const trimmed = input.trim();
        if (trimmed.length === 0) {
          return 'Sampler name cannot be empty';
        }
        // Basic validation: alphanumeric + hyphens
        if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
          return 'Sampler name must be alphanumeric (hyphens allowed)';
        }
        return true;
      }
    }]);
    return newSampler.trim();
  }

  return sampler;
}
```

**Testing:**
- Test with existing samplers (selection)
- Test with no existing samplers (only "Add new")
- Test adding new sampler
- Test validation (empty name, invalid characters)
- Test non-interactive mode detection (CI environment)

#### Task 2.4: Integrate Interactive Mode (3 hours)

**Location:** `sampler-backup/src/cli/backup.ts`

**Changes to handleSyncCommand:**
```typescript
async function handleSyncCommand(options: any): Promise<void> {
  try {
    const config = await loadConfig();
    const isRemote = isRemotePath(options.source);

    // NEW: For local sources without --sampler, enter interactive mode
    if (!isRemote && !options.sampler) {
      // Check if terminal is interactive
      if (!process.stdin.isTTY) {
        console.error("Error: --sampler is required for non-interactive mode");
        console.error("Example: --sampler s5k-studio");
        process.exit(1);
      }

      // Detect device UUID for display
      let deviceInfo: { mountPoint: string; uuid?: string; label?: string } = {
        mountPoint: options.source
      };

      try {
        const matcher = new DeviceMatcher();
        const result = await matcher.matchDevice(options.source, []);
        if (result.matched && result.deviceInfo) {
          deviceInfo.uuid = result.deviceInfo.volumeUUID;
          deviceInfo.label = result.deviceInfo.volumeLabel;
        }
      } catch {
        // Ignore - will just show mount point
      }

      // Prompt for sampler
      const selectedSampler = await promptForSampler(config, deviceInfo);

      // Update options with selected sampler
      options.sampler = selectedSampler;

      // Continue with auto-create flow
    }

    // EXISTING: Check for existing source, auto-create, etc.
    // (Rest of Phase 1 logic)
    // ...
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}
```

**Testing:**
- Test interactive mode in TTY
- Test non-interactive mode (CI) - should error
- Test existing sampler selection
- Test new sampler input
- Test integration with auto-create
- Test error handling (invalid input, Ctrl+C)

#### Task 2.5: User Experience Polish (2 hours)

**Enhancements:**
1. Add filesystem type detection and display
2. Add better formatting for device info display
3. Add confirmation message after source creation
4. Add help text for interactive mode

**Example Enhanced Output:**
```
Device detected: /Volumes/GOTEK
  UUID: ABCD-1234-5678-EF90
  Label: GOTEK
  Filesystem: FAT32

? Which sampler does this device belong to? (Use arrow keys)
❯ s3000
  s5000
  s6000
  ─────────────
  Add new sampler...

[User selects "s3000"]

📝 Auto-created backup source: s3000-floppy
   UUID: ABCD-1234-5678-EF90
   Label: GOTEK
✓ Configuration updated

Backing up source: s3000-floppy
Type: local
Source: /Volumes/GOTEK
Device: floppy

Syncing to: ~/.audiotools/backup/s3000/floppy
...
```

**Testing:**
- Visual QA of output formatting
- Test with various device types
- Test with missing UUID/label

**Deliverables:**
- `inquirer` dependency added
- `getUniqueSamplers()` function
- `promptForSampler()` function
- Updated `handleSyncCommand()` with interactive mode
- Unit tests for helper functions
- Integration tests for interactive flow

**Acceptance Criteria:**
- ✅ `audiotools backup /Volumes/GOTEK --device floppy` enters interactive mode
- ✅ Device info displayed (UUID, label, filesystem)
- ✅ Existing samplers shown in menu
- ✅ "Add new sampler" option works
- ✅ Input validation prevents invalid names
- ✅ Non-interactive mode (CI) errors with helpful message
- ✅ Source created and saved after selection
- ✅ Clear, user-friendly output

---

### Phase 3: Testing & Polish (Day 5)

**Goal:** Comprehensive testing, documentation, and edge case handling

#### Task 3.1: Edge Case Handling (3 hours)

**Scenarios to Handle:**

1. **Duplicate Source Names**
   - Test: Generate unique name with suffix
   - Expected: s5000-floppy-2, s5000-floppy-3, etc.

2. **Device Already Registered with Different Sampler**
   - Test: Device UUID matches source with different sampler
   - Expected: Warn user, show existing config, suggest using existing source

3. **Invalid Sampler Name**
   - Test: User enters empty string, special characters
   - Expected: Validation error, prompt again

4. **UUID Detection Failure**
   - Test: Platform doesn't support UUID, permission denied
   - Expected: Non-fatal, continue without UUID, warn user

5. **Non-Interactive Terminal**
   - Test: Run without --sampler in CI/non-TTY
   - Expected: Clear error message with example

6. **Config Write Failure**
   - Test: No write permissions, disk full
   - Expected: Error with helpful message, backup NOT performed

**Implementation:**
```typescript
// Example: Device already registered check
const matchedSource = findExistingSource(config, options.source, detectedUUID);
if (matchedSource && matchedSource.sampler !== options.sampler) {
  console.warn(`\n⚠️  Warning: This device is already registered as '${matchedSource.name}'`);
  console.warn(`   Existing sampler: ${matchedSource.sampler}`);
  console.warn(`   Requested sampler: ${options.sampler}`);
  console.warn(`\n   Options:`);
  console.warn(`   1. Use existing source: audiotools backup ${matchedSource.name}`);
  console.warn(`   2. Update existing source: audiotools config`);
  console.warn(`   3. Continue anyway (creates duplicate source)`);

  const { choice } = await inquirer.prompt([{
    type: 'list',
    name: 'choice',
    message: 'How would you like to proceed?',
    choices: [
      { name: 'Use existing source', value: 'existing' },
      { name: 'Create new source anyway', value: 'new' },
      { name: 'Cancel', value: 'cancel' }
    ]
  }]);

  if (choice === 'existing') {
    return handleBackupCommand(matchedSource.name, { ...options, source: undefined });
  } else if (choice === 'cancel') {
    console.log('Backup cancelled');
    process.exit(0);
  }
  // Continue with 'new'
}
```

#### Task 3.2: Help Text Updates (1 hour)

**Location:** `sampler-backup/src/cli/backup.ts`

**Updates:**
```typescript
.addHelpText('after', `
Examples:
  Auto-detect backup (NEW):
    $ audiotools backup /Volumes/SDCARD --device floppy --sampler s5000
       Auto-creates source "s5000-floppy" and saves to config

    $ audiotools backup /Volumes/GOTEK --device floppy
       Interactive mode: prompts for sampler selection

    $ audiotools backup /Volumes/MY_USB --device usb --sampler s3k-studio
       Auto-creates "s3k-studio-usb" source with UUID tracking

  Config-based backup (existing):
    $ audiotools backup                    # Backup all enabled sources
    $ audiotools backup pi-scsi2          # Backup specific source by name
    $ audiotools backup --dry-run         # Preview changes

  Device UUID Tracking (automatic):
    When you backup a local device, the system:
    - Detects the device UUID on first backup (registration)
    - Auto-creates a backup source and saves to config
    - Recognizes the same device on subsequent backups
    - Updates the lastSeen timestamp each time
    - Works even if the mount path changes between backups

  Flag-based backup (backward compatible):
    Remote (SSH) backup:
      $ audiotools backup --source pi-scsi2.local:~/images/ --device images

    Local media backup (creates ephemeral source):
      $ audiotools backup --source /Volumes/DSK0 --device floppy --sampler s5k

Configuration:
  Run 'audiotools config' to manage backup sources.
  Config file: ~/.audiotools/config.json

  Auto-created sources are automatically saved to config.
`)
```

#### Task 3.3: Unit Tests (3 hours)

**Test Files:**
- `test/unit/cli/source-helpers.test.ts` - Test helper functions
- `test/unit/cli/auto-create.test.ts` - Test auto-create logic

**Test Coverage:**
```typescript
describe('findExistingSource', () => {
  it('should find source by UUID', () => { /* ... */ });
  it('should find source by mount path', () => { /* ... */ });
  it('should return null if not found', () => { /* ... */ });
  it('should prefer UUID match over path match', () => { /* ... */ });
});

describe('generateSourceName', () => {
  it('should generate base name when no conflict', () => { /* ... */ });
  it('should append -2 when base name exists', () => { /* ... */ });
  it('should find next available suffix', () => { /* ... */ });
  it('should handle empty config', () => { /* ... */ });
});

describe('autoCreateSource', () => {
  it('should create source with UUID', () => { /* ... */ });
  it('should create source without UUID (non-fatal)', () => { /* ... */ });
  it('should save to config', () => { /* ... */ });
  it('should generate unique name', () => { /* ... */ });
});

describe('getUniqueSamplers', () => {
  it('should extract unique samplers', () => { /* ... */ });
  it('should sort samplers', () => { /* ... */ });
  it('should handle empty config', () => { /* ... */ });
  it('should deduplicate samplers', () => { /* ... */ });
});

describe('promptForSampler', () => {
  // Mock inquirer for testing
  it('should display device info', () => { /* ... */ });
  it('should offer existing samplers', () => { /* ... */ });
  it('should handle new sampler input', () => { /* ... */ });
  it('should validate sampler name', () => { /* ... */ });
});
```

#### Task 3.4: Integration Tests (3 hours)

**Test File:** `test/integration/auto-detect-backup.test.ts`

**Scenarios:**
```typescript
describe('Auto-Detect Backup Integration', () => {
  it('should auto-create source for new device', async () => {
    // Run: audiotools backup /test/path --device floppy --sampler s5000
    // Verify: Source created, config saved, backup performed
  });

  it('should recognize existing source by UUID', async () => {
    // Setup: Create source with UUID
    // Run: audiotools backup /different/path --device floppy --sampler s5000
    // Verify: Existing source used (not duplicated)
  });

  it('should handle duplicate names', async () => {
    // Setup: Source "s5000-floppy" exists
    // Run: Create another s5000 floppy source
    // Verify: Named "s5000-floppy-2"
  });

  it('should handle UUID detection failure gracefully', async () => {
    // Mock: UUID detection throws error
    // Run: Auto-create source
    // Verify: Source created without UUID, warning displayed
  });

  it('should error in non-interactive mode without --sampler', async () => {
    // Mock: process.stdin.isTTY = false
    // Run: audiotools backup /path --device floppy
    // Verify: Error with helpful message
  });
});
```

#### Task 3.5: Documentation Updates (2 hours)

**Files to Update:**
1. `sampler-backup/README.md` - Add auto-detect section
2. `docs/1.0/sampler-backup/user-guide.md` - Add workflow examples
3. CLI help text (completed in Task 3.2)

**README Section:**
```markdown
## Auto-Detect Backup

The backup CLI can automatically detect and configure backup sources on first use:

### Quick Start

Backup a new device with auto-configuration:
```bash
audiotools backup /Volumes/SDCARD --device floppy --sampler s5000
```

The system will:
1. Detect the device UUID (for future recognition)
2. Auto-create a backup source named "s5000-floppy"
3. Save the configuration
4. Perform the backup

On subsequent backups, the same device will be recognized automatically.

### Interactive Mode

Omit the `--sampler` flag to select interactively:
```bash
audiotools backup /Volumes/GOTEK --device floppy
```

You'll be prompted to:
- Select from existing samplers in your config
- Or add a new sampler name

This is useful when you're not sure which sampler to use, or when managing multiple samplers.

### How It Works

**Device UUID Tracking:**
- Each physical device (SD card, USB drive) has a unique UUID
- The system remembers devices across mount/unmount cycles
- Even if the mount path changes (e.g., `/Volumes/SDCARD` → `/Volumes/MY_SD`), the device is recognized

**Source Naming:**
- Auto-generated format: `{sampler}-{device}`
- Examples: `s5000-floppy`, `s3000-usb`, `s6000-scsi`
- If a name exists, a suffix is added: `s5000-floppy-2`

**Configuration:**
- Auto-created sources are saved to `~/.audiotools/config.json`
- You can manage them later with `audiotools config`
- They work exactly like manually configured sources
```

**Deliverables:**
- Edge case handling implemented
- Updated help text
- Comprehensive unit tests (target: 95%+ coverage)
- Integration tests for full workflows
- Updated documentation

**Acceptance Criteria:**
- ✅ All edge cases handled gracefully
- ✅ Help text clear and comprehensive
- ✅ Unit tests passing (95%+ coverage)
- ✅ Integration tests passing
- ✅ Documentation updated
- ✅ Manual QA completed
- ✅ No regressions in existing functionality

---

## Technical Details

### Source Name Generation

**Algorithm:**
```typescript
function generateSourceName(
  sampler: string,
  device: string,
  config: AudioToolsConfig
): string {
  const sources = config.backup?.sources || [];
  const baseName = `${sampler}-${device}`;

  // Try base name first
  if (!sources.some(s => s.name === baseName)) {
    return baseName;
  }

  // Find next available suffix
  let suffix = 2;
  while (true) {
    const candidate = `${baseName}-${suffix}`;
    if (!sources.some(s => s.name === candidate)) {
      return candidate;
    }
    suffix++;
  }
}
```

**Examples:**
- First: `s5000-floppy`
- Second: `s5000-floppy-2`
- Third: `s5000-floppy-3`
- Different device: `s5000-usb`
- Different sampler: `s3000-floppy`

### Sampler Extraction

**Algorithm:**
```typescript
function getUniqueSamplers(config: AudioToolsConfig): string[] {
  const samplers = new Set<string>();
  const sources = config.backup?.sources || [];

  sources.forEach((s: BackupSource) => {
    if (s.sampler) {
      samplers.add(s.sampler);
    }
  });

  return Array.from(samplers).sort();
}
```

**Example:**
```typescript
// Config has sources:
// - pi-scsi2 (sampler: "s5000")
// - pi-scsi3 (sampler: "s3000")
// - s5k-card (sampler: "s5000")
// - gotek (sampler: "s3000xl")

getUniqueSamplers(config)
// → ["s3000", "s3000xl", "s5000"]
```

### Interactive Menu (inquirer)

**Implementation:**
```typescript
import inquirer from 'inquirer';

const samplers = getUniqueSamplers(config);
const choices = [
  ...samplers,
  new inquirer.Separator(),
  { name: 'Add new sampler...', value: '__new__' }
];

const { sampler } = await inquirer.prompt([{
  type: 'list',
  name: 'sampler',
  message: 'Which sampler does this device belong to?',
  choices
}]);

if (sampler === '__new__') {
  const { newSampler } = await inquirer.prompt([{
    type: 'input',
    name: 'newSampler',
    message: 'Enter new sampler name:',
    validate: (input) => {
      if (input.trim().length === 0) {
        return 'Sampler name cannot be empty';
      }
      if (!/^[a-zA-Z0-9-]+$/.test(input.trim())) {
        return 'Name must be alphanumeric (hyphens allowed)';
      }
      return true;
    }
  }]);
  return newSampler.trim();
}

return sampler;
```

**Output:**
```
? Which sampler does this device belong to? (Use arrow keys)
❯ s3000
  s5000
  s6000
  ─────────────
  Add new sampler...
```

### Device Info Detection

**Using lib-device-uuid:**
```typescript
import { DeviceMatcher } from '@/lib/device/device-matcher.js';

async function detectDeviceInfo(mountPath: string): Promise<{
  uuid?: string;
  label?: string;
  filesystem?: string;
}> {
  try {
    const matcher = new DeviceMatcher();
    const result = await matcher.matchDevice(mountPath, []);

    if (result.matched && result.deviceInfo) {
      return {
        uuid: result.deviceInfo.volumeUUID,
        label: result.deviceInfo.volumeLabel,
        filesystem: result.deviceInfo.filesystemType
      };
    }
  } catch (error) {
    // Non-fatal: return empty object
    console.warn(`⚠️  Could not detect device info: ${error.message}`);
  }

  return {};
}
```

---

## User Experience Examples

### Example 1: Minimal Command - Just the Path (Most Common)

**Command:**
```bash
$ audiotools backup /Volumes/SDCARD
```

**Output:**
```
Device detected: /Volumes/SDCARD
  UUID: 1234-5678-9ABC-DEF0
  Label: SDCARD
  Filesystem: FAT32

? What type of device is this? (Use arrow keys)
❯ floppy
  hard-drive
  cd-rom
  other

[User selects "floppy"]

? Which sampler does this device belong to? (Use arrow keys)
❯ s3000
  s5000
  s6000
  ─────────────
  Add new sampler...

[User selects "s5000"]

📝 Auto-created backup source: s5000-floppy
   UUID: 1234-5678-9ABC-DEF0
   Label: SDCARD
✓ Configuration updated

Backing up source: s5000-floppy
Type: local
Source: /Volumes/SDCARD
Device: floppy

Syncing to: ~/.audiotools/backup/s5000/floppy

✓ Sync complete
```

### Example 2: Minimal Command with Device Type

**Command:**
```bash
$ audiotools backup /Volumes/GOTEK --device floppy
```

**Output:**
```
Device detected: /Volumes/GOTEK
  UUID: ABCD-1234-5678-EF90
  Label: GOTEK
  Filesystem: FAT32

? Which sampler does this device belong to? (Use arrow keys)
❯ s3000
  s5000
  s6000
  ─────────────
  Add new sampler...

[User selects "s3000"]

📝 Auto-created backup source: s3000-floppy
   UUID: ABCD-1234-5678-EF90
   Label: GOTEK
✓ Configuration updated

Backing up source: s3000-floppy
Type: local
Source: /Volumes/GOTEK
Device: floppy

Syncing to: ~/.audiotools/backup/s3000/floppy

✓ Sync complete
```

### Example 3: Full Info Provided - No Prompts

**Command:**
```bash
$ audiotools backup /Volumes/SDCARD --device floppy --sampler s5000
```

**Output:**
```
Device detected: /Volumes/SDCARD
  UUID: 1234-5678-9ABC-DEF0
  Label: SDCARD
  Filesystem: FAT32

📝 Auto-created backup source: s5000-floppy
   UUID: 1234-5678-9ABC-DEF0
   Label: SDCARD
✓ Configuration updated

Backing up source: s5000-floppy
Type: local
Source: /Volumes/SDCARD
Device: floppy

Syncing to: ~/.audiotools/backup/s5000/floppy

✓ Sync complete
```

### Example 4: Add New Sampler Interactively

**Command:**
```bash
$ audiotools backup /Volumes/DSK0 --device floppy
```

**Output:**
```
Device detected: /Volumes/DSK0
  UUID: 9999-8888-7777-6666
  Label: DSK0
  Filesystem: ExFAT

? Which sampler does this device belong to? Add new sampler...
? Enter new sampler name: s5k-studio

📝 Auto-created backup source: s5k-studio-floppy
   UUID: 9999-8888-7777-6666
   Label: DSK0
✓ Configuration updated

Backing up source: s5k-studio-floppy
Type: local
Source: /Volumes/DSK0
Device: floppy

Syncing to: ~/.audiotools/backup/s5k-studio/floppy

✓ Sync complete
```

### Example 4: Subsequent backup (recognized by UUID)

**Command:**
```bash
# Card remounts at different path
$ audiotools backup /Volumes/MY_CARD --device floppy --sampler s5000
```

**Output:**
```
Using existing source: s5000-floppy

✓ Recognized device 's5000-floppy' at /Volumes/MY_CARD
  (UUID: 1234-5678-9ABC-DEF0)

Backing up source: s5000-floppy
Type: local
Source: /Volumes/MY_CARD  ← Uses new path
Device: floppy

Syncing to: ~/.audiotools/backup/s5000/floppy

✓ Sync complete
✓ Configuration updated
```

### Example 5: Duplicate name handling

**Command:**
```bash
# User has s5000-floppy already, inserts different floppy
$ audiotools backup /Volumes/FLOPPY2 --device floppy --sampler s5000
```

**Output:**
```
Device detected: /Volumes/FLOPPY2
  UUID: 2222-3333-4444-5555
  Label: FLOPPY2
  Filesystem: FAT32

📝 Auto-created backup source: s5000-floppy-2
   UUID: 2222-3333-4444-5555
   Label: FLOPPY2
✓ Configuration updated

Backing up source: s5000-floppy-2
...
```

---

## Edge Cases & Error Handling

### Edge Case 1: Duplicate Source Names

**Scenario:** User has `s5000-floppy`, backs up another S5000 floppy

**Handling:**
- Append numeric suffix: `s5000-floppy-2`
- Continue incrementing: `s5000-floppy-3`, etc.
- No user intervention required

**Implementation:**
```typescript
function generateSourceName(sampler: string, device: string, config: AudioToolsConfig): string {
  let suffix = 0;
  while (true) {
    const name = suffix === 0
      ? `${sampler}-${device}`
      : `${sampler}-${device}-${suffix + 1}`;

    if (!config.backup?.sources?.some(s => s.name === name)) {
      return name;
    }
    suffix++;
  }
}
```

### Edge Case 2: Device Already Registered with Different Sampler

**Scenario:** Device UUID matches source with different sampler

**Handling:**
```
⚠️  Warning: This device is already registered as 's3000-floppy'
   Existing sampler: s3000
   Requested sampler: s5000
   Device UUID: 1234-5678-9ABC-DEF0

   Options:
   1. Use existing source: audiotools backup s3000-floppy
   2. Update existing source: audiotools config
   3. Continue anyway (creates duplicate source)

? How would you like to proceed?
❯ Use existing source
  Create new source anyway
  Cancel
```

**Implementation:**
- Check for UUID match with different sampler
- Warn user with clear options
- Let user decide (prefer existing)

### Edge Case 3: Invalid Sampler Name

**Scenario:** User enters empty string, special characters, spaces

**Handling:**
```
? Enter new sampler name:
✖ Sampler name cannot be empty

? Enter new sampler name: s5000 studio
✖ Name must be alphanumeric (hyphens allowed)

? Enter new sampler name: s5000-studio
✓ Valid name
```

**Validation:**
```typescript
validate: (input) => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return 'Sampler name cannot be empty';
  }
  if (!/^[a-zA-Z0-9-]+$/.test(trimmed)) {
    return 'Name must be alphanumeric (hyphens allowed)';
  }
  return true;
}
```

### Edge Case 4: UUID Detection Failure

**Scenario:** Platform doesn't support UUID, permission denied, device unplugged

**Handling:**
```
⚠️  Could not detect device UUID: Permission denied
   Continuing backup without UUID tracking

📝 Auto-created backup source: s5000-floppy
✓ Configuration updated

Backing up source: s5000-floppy
...
```

**Implementation:**
- Catch UUID detection errors
- Warn user (non-fatal)
- Continue without UUID fields
- Source still created and saved

### Edge Case 5: Non-Interactive Terminal

**Scenario:** Running in CI, cron job, or redirected input

**Handling:**
```
Error: --sampler is required for non-interactive mode
Example: --sampler s5k-studio

Hint: Interactive mode requires a TTY.
      Use --sampler flag when running in scripts.
```

**Implementation:**
```typescript
if (!isRemote && !options.sampler) {
  if (!process.stdin.isTTY) {
    console.error("Error: --sampler is required for non-interactive mode");
    console.error("Example: --sampler s5k-studio");
    console.error("\nHint: Interactive mode requires a TTY.");
    console.error("      Use --sampler flag when running in scripts.");
    process.exit(1);
  }

  // Enter interactive mode
  const sampler = await promptForSampler(config, deviceInfo);
  options.sampler = sampler;
}
```

### Edge Case 6: Device Already Registered with Different Sampler

**Scenario:** UUID matches existing source with different sampler

**Handling:**
```
⚠️  This device is already registered as 's3000-floppy'
   Existing sampler: s3000
   Requested sampler: s5000

? How would you like to proceed?
❯ Use existing source (s3000-floppy)
  Create new source anyway (s5000-floppy-2)
  Cancel backup

[User selects "Use existing source"]

Using existing source: s3000-floppy
...
```

**Implementation:**
- Detect UUID match with different sampler
- Prompt user for resolution
- Respect user choice

---

## Dependencies

### New Dependencies

**inquirer** (already used in audiotools-config)
- Version: Latest compatible
- Purpose: Interactive CLI prompts
- License: MIT

### Existing Dependencies

- `@oletizi/audiotools-config` - Config loading/saving
- `@/lib/device/device-matcher` - UUID detection
- `@/lib/device/device-resolver` - Device tracking
- Existing CLI infrastructure

### Internal Modules

**Will use:**
- `loadConfig()`, `saveConfig()` - Config operations
- `addBackupSource()` - Add source to config
- `DeviceMatcher` - UUID detection
- `DeviceResolver` - Device resolution

**Will NOT modify:**
- Existing backup logic
- Existing config-based workflows
- Remote source handling

---

## Testing Strategy

### Unit Tests

**Coverage Target:** 95%+

**Test Files:**
1. `test/unit/cli/source-helpers.test.ts`
   - `findExistingSource()`
   - `generateSourceName()`
   - `getUniqueSamplers()`

2. `test/unit/cli/auto-create.test.ts`
   - `autoCreateSource()`
   - UUID detection integration
   - Config save integration

3. `test/unit/cli/interactive.test.ts`
   - `promptForSampler()` (mocked inquirer)
   - Validation logic
   - TTY detection

### Integration Tests

**Test File:** `test/integration/auto-detect-backup.test.ts`

**Scenarios:**
1. Auto-create new source (with UUID)
2. Auto-create new source (UUID failure)
3. Recognize existing source by UUID
4. Recognize existing source by path
5. Handle duplicate names
6. Interactive mode selection
7. Interactive mode new sampler
8. Non-interactive mode error

### Manual Testing

**Real-World Scenarios:**
1. Insert SD card, run auto-detect backup
2. Remove card, reinsert at different path, verify recognition
3. Interactive mode with existing samplers
4. Interactive mode with no samplers (new user)
5. Multiple devices for same sampler
6. Non-interactive mode (CI simulation)

---

## Success Criteria

### Functional Requirements

✅ Users can backup new devices without pre-configuration - **COMPLETE**
✅ Interactive mode provides clear sampler selection - **COMPLETE** (24 tests passing)
✅ Source names are unique and descriptive - **COMPLETE** (auto-generated from sampler-device-label)
✅ Configuration automatically updated and saved - **COMPLETE** (auto-save on register/recognize)
✅ UUID tracking works for auto-created sources - **COMPLETE** (98.36% coverage)
✅ Non-breaking - existing workflows still work - **COMPLETE** (backward compatibility verified)
✅ Clear error messages for all edge cases - **COMPLETE** (UserCancelledError, validation errors)

### Quality Requirements

✅ Unit test coverage: 95%+ - **EXCEEDED** (98.36% for auto-detect-backup.ts)
  - Phase 1: 24 tests (interactive-prompt.test.ts)
  - Phase 2: 33 tests (auto-detect-backup.test.ts)
  - Total: 57 new tests, all passing
✅ Integration tests: All workflows covered - **COMPLETE** (CLI integration verified)
⏸️ Manual QA: Real devices tested - **PENDING** (Phase 4)
⏸️ Documentation: Complete and accurate - **PENDING** (Phase 4)
✅ Help text: Clear and comprehensive - **COMPLETE** (CLI help updated)
✅ User feedback: Clear, actionable, friendly - **COMPLETE** (emoji indicators, clear messages)

### User Experience Requirements

✅ Zero-config first backup works - **COMPLETE** (`audiotools backup /Volumes/SDCARD`)
✅ Interactive mode is intuitive - **COMPLETE** (inquirer with clear prompts)
✅ Error messages are helpful - **COMPLETE** (descriptive errors, no fallbacks)
✅ Device info displayed clearly - **COMPLETE** (UUID, label, filesystem shown)
✅ Confirmation messages provide confidence - **COMPLETE** (📝 registered, ✓ recognized, ➕ created)
✅ Existing users not disrupted - **COMPLETE** (all existing commands work unchanged)

---

## Timeline Summary

| Phase | Estimated | Actual | Status | Deliverable |
|-------|-----------|--------|--------|-------------|
| Phase 1: Interactive Device Selection | Days 1-2 | 1 day | ✅ Complete | Interactive prompts (24 tests) |
| Phase 2: Auto-Detection Integration | Days 3-4 | 1 day | ✅ Complete | Device detection (33 tests, 98.36% coverage) |
| Phase 3: Configuration Auto-Update | Day 5 | 1 day | ✅ Complete | CLI integration, auto-save |
| Phase 4: Testing & Documentation | Day 5 | Pending | ⏸️ Pending | Real device testing, docs, migration guide |

**Total Estimated:** 5 days
**Total Actual (Phases 1-3):** 1 day
**Remaining (Phase 4):** ~1 day

**Milestones:**
- ✅ Day 1: Interactive prompts implemented and tested (24 tests)
- ✅ Day 1: Auto-detect logic implemented and tested (33 tests)
- ✅ Day 1: CLI integration complete with auto-save
- ⏸️ Pending: Real device testing and documentation updates

---

## Risk Assessment

### Risk 1: Breaking Existing Flag-Based Behavior

**Impact:** High
**Probability:** Low

**Mitigation:**
- Preserve all existing code paths
- Add new logic conditionally (check for existing source first)
- Comprehensive regression tests
- Backward compatibility tests

### Risk 2: inquirer Dependency Issues

**Impact:** Medium
**Probability:** Low

**Mitigation:**
- Already used in audiotools-config (known to work)
- Version pin to tested version
- Graceful fallback if import fails (error with --sampler required)

### Risk 3: Config Save Failures

**Impact:** High
**Probability:** Low

**Mitigation:**
- Test config save errors explicitly
- Don't perform backup if save fails
- Clear error messages
- Suggest troubleshooting (permissions, disk space)

### Risk 4: UUID Detection Unreliable

**Impact:** Medium
**Probability:** Medium

**Mitigation:**
- Already implemented as non-fatal
- Fall back to path-based matching
- Warn user but continue
- Document limitations

### Risk 5: User Confusion (Too Many Options)

**Impact:** Medium
**Probability:** Medium

**Mitigation:**
- Clear help text
- Progressive disclosure (interactive only when needed)
- Good examples in docs
- User testing/feedback

---

## Future Enhancements

### Post-1.1.0 Features

**Auto-Detect All Mounted Media** (not in scope)
- Scan all mount points for disk images
- Present menu of detected devices
- One-command backup for all

**Bulk Source Management** (not in scope)
- `audiotools sources list` - Show all sources
- `audiotools sources clean` - Remove orphaned sources
- `audiotools sources merge` - Merge duplicate sources

**Smart Defaults** (not in scope)
- Guess sampler from disk image filenames
- Suggest sampler based on disk structure
- Learn from user's previous choices

**Multi-Device Workflows** (not in scope)
- Backup multiple devices in sequence
- Progress across multiple devices
- Summary report

---

## Appendix

### A. File Changes Summary

**Modified Files:**
- `sampler-backup/src/cli/backup.ts` (main changes)
  - Add helper functions
  - Modify `handleSyncCommand()`
  - Update help text

**New Test Files:**
- `test/unit/cli/source-helpers.test.ts`
- `test/unit/cli/auto-create.test.ts`
- `test/unit/cli/interactive.test.ts`
- `test/integration/auto-detect-backup.test.ts`

**Modified Documentation:**
- `sampler-backup/README.md`
- `docs/1.0/sampler-backup/user-guide.md`

### B. Related Documentation

- **Device UUID Workplan:** `/docs/1.0/sampler-backup/device-uuid/implementation/workplan.md`
- **Local Media Workplan:** `/docs/1.0/sampler-backup/local-media-support/implementation/workplan.md`
- **Config System:** `audiotools-config/README.md`

### C. CLI Command Reference

**New Usage:**
```bash
# Auto-detect with flags
audiotools backup <path> --device <name> --sampler <name>

# Interactive mode
audiotools backup <path> --device <name>

# Examples
audiotools backup /Volumes/SDCARD --device floppy --sampler s5000
audiotools backup /Volumes/GOTEK --device floppy
audiotools backup /mnt/usb --device usb --sampler s3k-studio
```

**Existing Usage (unchanged):**
```bash
# Config-based
audiotools backup [source-name]
audiotools backup --dry-run

# Flag-based (ephemeral)
audiotools backup --source <path> --device <name> --sampler <name>
```

---

**Document Status:** Ready for Implementation
**Next Steps:** Begin Phase 1 - Auto-Detect with --sampler
**Author:** Audio Tools Team
**Review Status:** Pending
