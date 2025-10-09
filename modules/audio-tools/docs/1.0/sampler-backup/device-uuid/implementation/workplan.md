# Device UUID Tracking Implementation Workplan

**Version:** 1.0
**Created:** 2025-10-08
**Status:** Planning
**Estimated Duration:** 13-17 days

## Executive Summary

This workplan details the implementation of device UUID tracking for the audio-tools backup system. The feature will allow the system to remember physical devices (SD cards, USB drives, floppy disks) even when mount points change, providing a seamless user experience for backing up sampler media across multiple sessions.

### Key Benefits
- **Persistent Device Recognition**: System remembers devices after unmount/remount
- **Mount Point Independence**: Works regardless of where device mounts (e.g., `/Volumes/SDCARD` vs `/Volumes/MY_SD`)
- **Multiple Device Support**: Track multiple physical cards for the same sampler independently
- **Cross-Platform**: Works on macOS and Linux with platform-specific implementations

## Problem Statement

### Current Limitations

The current backup system identifies local media sources by their mount path:

```typescript
{
  name: 's5k-card',
  type: 'local',
  source: '/Volumes/SDCARD',  // ← Static path
  device: 'sd-card',
  sampler: 's5000',
  enabled: true
}
```

**Problems:**
1. **Mount Point Changes**: If SD card remounts at `/Volumes/MY_SD`, system can't find it
2. **No Device Recognition**: Same physical card appears as "new" device each time
3. **Manual Configuration**: User must update config if mount point changes
4. **No Device History**: Can't track when device was last backed up

### User Impact

**Scenario:** User has S5000 with multiple SD cards
- Each card needs separate config entry
- If card mounts at different path, backup fails
- No way to tell which physical card was last backed up
- User must manually track device usage

## Current State Analysis

### Existing Codebase

**audiotools-config** (Configuration System):
- `BackupSource` interface defines backup sources
- No device tracking fields (UUID, serial, timestamps)
- Validator enforces `sampler` field for local sources
- Config stored at `~/.audiotools/config.json`

**sampler-backup** (Backup Implementation):
- `LocalSource` handles local media backups
- `MediaDetector` scans mount points for disk images
- Uses `LocalBackupAdapter` for incremental file copying
- Relies on static mount paths

**lib-runtime** (Command Execution):
- Provides `execute()` for running child processes
- Callback-based interface with stdout/stderr capture
- 30-second default timeout
- Used for platform-specific commands

### Current Workflow

1. User configures backup source with static path `/Volumes/SDCARD`
2. User runs `audiotools backup s5k-card`
3. System checks if `/Volumes/SDCARD` exists and is readable
4. If exists: backup proceeds
5. If not exists: backup fails with "source not accessible"

## Technical Design

### Device Identifier Research

#### macOS (diskutil)

```bash
# Get device UUID
$ diskutil info /Volumes/SDCARD
# Output:
#   Device Identifier:        disk2s1
#   Volume Name:              SDCARD
#   Volume UUID:              B8E3-4F2A  ← Filesystem UUID
#   Disk / Partition UUID:    ...
```

**Key Fields:**
- **Volume UUID**: Filesystem-level identifier (changes on format)
- **Volume Name**: User-visible label (can change)
- **Device Identifier**: Kernel device name (changes across mounts)

**Command Pattern:**
```typescript
execute('diskutil', ['info', mountPoint], callbacks)
```

**Parsing Strategy:**
- Look for line starting with "Volume UUID:"
- Extract UUID value after colon
- Fallback to Volume Name if UUID not available

#### Linux (blkid)

```bash
# Get device UUID
$ blkid /dev/sdb1
# Output: /dev/sdb1: UUID="B8E3-4F2A" TYPE="vfat" LABEL="SDCARD"

# Find device by UUID
$ blkid -U B8E3-4F2A
# Output: /dev/sdb1

# List all devices
$ blkid
```

**Key Fields:**
- **UUID**: Filesystem UUID (same as macOS Volume UUID)
- **LABEL**: Volume label (same as macOS Volume Name)
- **TYPE**: Filesystem type (vfat, exfat, ext4)

**Command Pattern:**
```typescript
execute('blkid', [devicePath], callbacks)
// or
execute('blkid', ['-U', uuid], callbacks)
```

**Symlink Resolution:**
```bash
$ ls -l /dev/disk/by-uuid/
# B8E3-4F2A -> ../../sdb1
```

#### Windows (Out of Scope)

Windows native support not planned for initial implementation. WSL2 support is experimental and undocumented in audio-tools.

**Future Consideration:**
- PowerShell: `Get-Volume | Select-Object DriveLetter,FileSystemLabel,UniqueId`
- wmic deprecated in Windows 10+

### Schema Changes

#### Updated BackupSource Interface

**File:** `audiotools-config/src/types.ts`

```typescript
export interface BackupSource {
  /** Unique identifier for this source (used in CLI and export config) */
  name: string;

  /** Source type: 'remote' for SSH/PiSCSI, 'local' for SD cards/USB drives */
  type: 'remote' | 'local';

  /**
   * Source path.
   * - For remote: SSH path in format 'host:path'
   * - For local: last known mount path (may change, use volumeUUID for resolution)
   */
  source: string;

  /** Device/volume name for organization */
  device: string;

  /** Sampler model (required for local sources) */
  sampler?: string;

  /** Whether this source is enabled for backup operations */
  enabled: boolean;

  // ===== NEW: Device Tracking Fields =====

  /**
   * Filesystem UUID from diskutil (macOS) or blkid (Linux).
   * Used to identify physical device across mount point changes.
   * Only set for local sources.
   */
  volumeUUID?: string;

  /**
   * Volume label/name from filesystem.
   * Provides human-readable identifier alongside UUID.
   * Only set for local sources.
   */
  volumeLabel?: string;

  /**
   * Hardware-level serial number (future enhancement).
   * More persistent than filesystem UUID (survives reformatting).
   * Optional: Not all devices expose serial numbers.
   */
  volumeSerial?: string;

  /**
   * ISO 8601 timestamp of last successful backup.
   * Used to track device usage and warn about stale devices.
   */
  lastSeen?: string;

  /**
   * ISO 8601 timestamp when device was first registered.
   * Helps track device lifetime and troubleshoot registration issues.
   */
  registeredAt?: string;
}
```

**Example Configuration:**

```json
{
  "version": "1.0",
  "backup": {
    "backupRoot": "~/.audiotools/backup",
    "sources": [
      {
        "name": "s5k-card-1",
        "type": "local",
        "source": "/Volumes/SDCARD",
        "device": "sd-card",
        "sampler": "s5000",
        "enabled": true,
        "volumeUUID": "B8E3-4F2A",
        "volumeLabel": "SDCARD",
        "lastSeen": "2025-10-08T14:23:45.123Z",
        "registeredAt": "2025-10-01T10:15:30.456Z"
      }
    ]
  }
}
```

### Module Architecture

#### New Package: lib-device-uuid

**Package Structure:**
```
lib-device-uuid/
├── src/
│   ├── index.ts                    # Public API exports
│   ├── types.ts                    # Interfaces
│   ├── device-detector.ts          # Abstract base + factory
│   ├── device-registry.ts          # Device management
│   ├── mount-resolver.ts           # UUID → path resolution
│   ├── platform/
│   │   ├── macos-detector.ts       # diskutil implementation
│   │   ├── linux-detector.ts       # blkid implementation
│   │   └── null-detector.ts        # Unsupported platforms
│   └── utils/
│       ├── parser.ts               # Command output parsing
│       └── validation.ts           # UUID format validation
├── test/
│   ├── unit/
│   │   ├── device-detector.test.ts
│   │   ├── device-registry.test.ts
│   │   ├── mount-resolver.test.ts
│   │   └── parsers.test.ts
│   └── integration/
│       └── platform.test.ts
├── package.json
├── tsconfig.json
└── README.md
```

#### Core Interfaces

**types.ts:**
```typescript
/**
 * Device information returned by platform-specific detectors.
 */
export interface DeviceInfo {
  /** Filesystem UUID (primary identifier) */
  volumeUUID: string;

  /** Volume label/name (human-readable) */
  volumeLabel?: string;

  /** Hardware serial number (optional, more persistent) */
  volumeSerial?: string;

  /** Current mount point */
  mountPoint: string;

  /** Filesystem type (vfat, exfat, ext4, etc.) */
  filesystemType?: string;

  /** Device path (e.g., /dev/sdb1, disk2s1) */
  devicePath?: string;
}

/**
 * Result of device detection operation.
 */
export interface DetectionResult {
  success: boolean;
  device?: DeviceInfo;
  error?: Error;
}

/**
 * Platform-specific device detector interface.
 */
export interface DeviceDetector {
  /** Platform name for debugging */
  platform: 'macos' | 'linux' | 'unsupported';

  /**
   * Detect device information from mount point.
   * @param mountPoint - Path to mounted volume (e.g., /Volumes/SDCARD)
   * @returns Promise resolving to device info or error
   */
  detectFromPath(mountPoint: string): Promise<DetectionResult>;

  /**
   * Resolve current mount point from UUID.
   * @param uuid - Volume UUID to search for
   * @returns Promise resolving to mount point or null if not found
   */
  resolveMountPoint(uuid: string): Promise<string | null>;

  /**
   * List all mounted devices.
   * @returns Promise resolving to array of device info
   */
  listDevices(): Promise<DeviceInfo[]>;
}
```

**device-detector.ts:**
```typescript
import type { DeviceDetector } from './types.js';
import { MacOSDeviceDetector } from './platform/macos-detector.js';
import { LinuxDeviceDetector } from './platform/linux-detector.js';
import { NullDeviceDetector } from './platform/null-detector.js';

/**
 * Factory function to create platform-specific detector.
 */
export function createDeviceDetector(): DeviceDetector {
  const platform = process.platform;

  switch (platform) {
    case 'darwin':
      return new MacOSDeviceDetector();
    case 'linux':
      return new LinuxDeviceDetector();
    default:
      return new NullDeviceDetector();
  }
}

/**
 * Global detector instance (lazy-initialized).
 */
let detector: DeviceDetector | null = null;

export function getDeviceDetector(): DeviceDetector {
  if (!detector) {
    detector = createDeviceDetector();
  }
  return detector;
}
```

**device-registry.ts:**
```typescript
import type { BackupSource } from '@oletizi/audiotools-config';
import type { DeviceInfo } from './types.js';
import { getDeviceDetector } from './device-detector.js';

/**
 * Manages device registration and recognition.
 */
export class DeviceRegistry {
  /**
   * Register a new device from detected info.
   */
  async registerDevice(
    source: BackupSource,
    mountPoint: string
  ): Promise<BackupSource> {
    const detector = getDeviceDetector();
    const result = await detector.detectFromPath(mountPoint);

    if (!result.success || !result.device) {
      throw new Error(`Failed to detect device at ${mountPoint}: ${result.error?.message}`);
    }

    const now = new Date().toISOString();

    return {
      ...source,
      volumeUUID: result.device.volumeUUID,
      volumeLabel: result.device.volumeLabel,
      volumeSerial: result.device.volumeSerial,
      lastSeen: now,
      registeredAt: source.registeredAt || now,
    };
  }

  /**
   * Resolve current mount point for registered device.
   */
  async resolveDevice(source: BackupSource): Promise<string | null> {
    if (!source.volumeUUID) {
      return null; // Not registered
    }

    const detector = getDeviceDetector();
    return await detector.resolveMountPoint(source.volumeUUID);
  }

  /**
   * Update lastSeen timestamp after successful backup.
   */
  updateLastSeen(source: BackupSource): BackupSource {
    return {
      ...source,
      lastSeen: new Date().toISOString(),
    };
  }

  /**
   * Check if device UUID matches current device at mount point.
   */
  async verifyDevice(
    source: BackupSource,
    mountPoint: string
  ): Promise<boolean> {
    if (!source.volumeUUID) {
      return true; // No UUID to verify
    }

    const detector = getDeviceDetector();
    const result = await detector.detectFromPath(mountPoint);

    if (!result.success || !result.device) {
      return false;
    }

    return result.device.volumeUUID === source.volumeUUID;
  }
}
```

#### Platform Implementations

**platform/macos-detector.ts:**
```typescript
import { execute } from '@oletizi/lib-runtime';
import type { DeviceDetector, DeviceInfo, DetectionResult } from '../types.js';

export class MacOSDeviceDetector implements DeviceDetector {
  platform = 'macos' as const;

  async detectFromPath(mountPoint: string): Promise<DetectionResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      execute('diskutil', ['info', mountPoint], {
        onStdout: (data) => { stdout += data; },
        onStderr: (data) => { stderr += data; },
        onExit: (code) => {
          if (code !== 0) {
            resolve({
              success: false,
              error: new Error(`diskutil failed: ${stderr}`),
            });
            return;
          }

          try {
            const device = this.parseDisku tilOutput(stdout, mountPoint);
            resolve({ success: true, device });
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error : new Error(String(error)),
            });
          }
        },
      });
    });
  }

  async resolveMountPoint(uuid: string): Promise<string | null> {
    // diskutil doesn't have direct UUID lookup
    // Strategy: List all volumes, detect each, match UUID
    const devices = await this.listDevices();
    const match = devices.find(d => d.volumeUUID === uuid);
    return match?.mountPoint || null;
  }

  async listDevices(): Promise<DeviceInfo[]> {
    // Implementation: Parse `diskutil list -plist` output
    // Returns array of mount points, then detect each
    throw new Error('Not implemented');
  }

  private parseDiskutilOutput(output: string, mountPoint: string): DeviceInfo {
    const lines = output.split('\n');
    const device: Partial<DeviceInfo> = { mountPoint };

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('Volume UUID:')) {
        const match = trimmed.match(/Volume UUID:\s+([A-F0-9-]+)/i);
        if (match) device.volumeUUID = match[1];
      } else if (trimmed.startsWith('Volume Name:')) {
        const match = trimmed.match(/Volume Name:\s+(.+)/);
        if (match) device.volumeLabel = match[1].trim();
      } else if (trimmed.startsWith('Type (Bundle):')) {
        const match = trimmed.match(/Type \(Bundle\):\s+(.+)/);
        if (match) device.filesystemType = match[1].trim();
      } else if (trimmed.startsWith('Device Identifier:')) {
        const match = trimmed.match(/Device Identifier:\s+(.+)/);
        if (match) device.devicePath = match[1].trim();
      }
    }

    if (!device.volumeUUID) {
      throw new Error('Volume UUID not found in diskutil output');
    }

    return device as DeviceInfo;
  }
}
```

**platform/linux-detector.ts:**
```typescript
import { execute } from '@oletizi/lib-runtime';
import type { DeviceDetector, DeviceInfo, DetectionResult } from '../types.js';

export class LinuxDeviceDetector implements DeviceDetector {
  platform = 'linux' as const;

  async detectFromPath(mountPoint: string): Promise<DetectionResult> {
    // Strategy: Find device from mount point, then query with blkid
    const devicePath = await this.findDeviceFromMount(mountPoint);
    if (!devicePath) {
      return {
        success: false,
        error: new Error(`Could not find device for mount point: ${mountPoint}`),
      };
    }

    return this.detectFromDevice(devicePath, mountPoint);
  }

  async resolveMountPoint(uuid: string): Promise<string | null> {
    // Use blkid -U to find device
    return new Promise((resolve) => {
      let stdout = '';

      execute('blkid', ['-U', uuid], {
        onStdout: (data) => { stdout += data; },
        onExit: (code) => {
          if (code !== 0) {
            resolve(null);
            return;
          }

          const devicePath = stdout.trim();
          this.findMountPoint(devicePath).then(resolve);
        },
      });
    });
  }

  async listDevices(): Promise<DeviceInfo[]> {
    // Parse `blkid` output (all devices)
    throw new Error('Not implemented');
  }

  private async findDeviceFromMount(mountPoint: string): Promise<string | null> {
    return new Promise((resolve) => {
      let stdout = '';

      execute('findmnt', ['-n', '-o', 'SOURCE', mountPoint], {
        onStdout: (data) => { stdout += data; },
        onExit: (code) => {
          resolve(code === 0 ? stdout.trim() : null);
        },
      });
    });
  }

  private async findMountPoint(devicePath: string): Promise<string | null> {
    return new Promise((resolve) => {
      let stdout = '';

      execute('findmnt', ['-n', '-o', 'TARGET', devicePath], {
        onStdout: (data) => { stdout += data; },
        onExit: (code) => {
          resolve(code === 0 ? stdout.trim() : null);
        },
      });
    });
  }

  private async detectFromDevice(
    devicePath: string,
    mountPoint: string
  ): Promise<DetectionResult> {
    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      execute('blkid', [devicePath], {
        onStdout: (data) => { stdout += data; },
        onStderr: (data) => { stderr += data; },
        onExit: (code) => {
          if (code !== 0) {
            resolve({
              success: false,
              error: new Error(`blkid failed: ${stderr}`),
            });
            return;
          }

          try {
            const device = this.parseBlkidOutput(stdout, mountPoint, devicePath);
            resolve({ success: true, device });
          } catch (error) {
            resolve({
              success: false,
              error: error instanceof Error ? error : new Error(String(error)),
            });
          }
        },
      });
    });
  }

  private parseBlkidOutput(
    output: string,
    mountPoint: string,
    devicePath: string
  ): DeviceInfo {
    // Parse: /dev/sdb1: UUID="B8E3-4F2A" TYPE="vfat" LABEL="SDCARD"
    const device: Partial<DeviceInfo> = { mountPoint, devicePath };

    const uuidMatch = output.match(/UUID="([^"]+)"/);
    if (uuidMatch) device.volumeUUID = uuidMatch[1];

    const labelMatch = output.match(/LABEL="([^"]+)"/);
    if (labelMatch) device.volumeLabel = labelMatch[1];

    const typeMatch = output.match(/TYPE="([^"]+)"/);
    if (typeMatch) device.filesystemType = typeMatch[1];

    if (!device.volumeUUID) {
      throw new Error('UUID not found in blkid output');
    }

    return device as DeviceInfo;
  }
}
```

### Workflow Diagrams

#### Device Registration Flow

```
┌─────────────────────────────────────────────────┐
│ User: audiotools backup s5k-card                │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 1. Load config from ~/.audiotools/config.json  │
│    Find source with name="s5k-card"             │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 2. Check: Does source have volumeUUID?         │
└────────────┬────────────────────────────────────┘
             │
       ┌─────┴─────┐
       │ No UUID   │ (First time)
       ▼           │
┌──────────────────┴──────────────────────────────┐
│ 3. Query device UUID from mount point:         │
│    MacOS: diskutil info /Volumes/SDCARD        │
│    Linux: blkid $(findmnt -n -o SOURCE ...)    │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 4. Prompt user:                                 │
│    "Register this device?                       │
│     UUID: B8E3-4F2A                             │
│     Label: SDCARD"                              │
│    [Y/n]                                        │
└────────────┬────────────────────────────────────┘
             │
         ┌───┴───┐
         │  Yes  │
         ▼       │
┌────────────────┴────────────────────────────────┐
│ 5. Update config with UUID:                     │
│    {                                            │
│      "volumeUUID": "B8E3-4F2A",                │
│      "volumeLabel": "SDCARD",                  │
│      "registeredAt": "2025-10-08T14:23:45Z"   │
│    }                                            │
│    Save to ~/.audiotools/config.json            │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 6. Proceed with backup                          │
└─────────────────────────────────────────────────┘
```

#### Device Recognition Flow

```
┌─────────────────────────────────────────────────┐
│ User: audiotools backup s5k-card                │
│ (Card now mounts at different path)             │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 1. Load config, find source="s5k-card"         │
│    Has volumeUUID: "B8E3-4F2A"                 │
│    Stored path: /Volumes/SDCARD (old)          │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 2. Try to resolve current mount point:         │
│    MacOS: diskutil list → detect all → match   │
│    Linux: blkid -U B8E3-4F2A → findmnt         │
└────────────┬────────────────────────────────────┘
             │
       ┌─────┴─────┐
       │  Found    │
       ▼           │
┌──────────────────┴──────────────────────────────┐
│ 3. Current mount: /Volumes/MY_SD (different!)   │
│    Display info:                                │
│    "Recognized device: SDCARD (B8E3-4F2A)      │
│     Currently mounted at: /Volumes/MY_SD        │
│     (was: /Volumes/SDCARD)"                     │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 4. Use current mount point for backup           │
│    Update config with new path (optional)       │
│    Update lastSeen timestamp                    │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 5. Proceed with backup from /Volumes/MY_SD     │
└─────────────────────────────────────────────────┘
```

#### UUID Conflict Handling

```
┌─────────────────────────────────────────────────┐
│ User inserts device at /Volumes/SDCARD          │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 1. Query device UUID → "F7A9-3C1B"             │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 2. Config has volumeUUID: "B8E3-4F2A"          │
│    (Mismatch! Device was reformatted?)          │
└────────────┬────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────┐
│ 3. Warn user:                                   │
│    "⚠️  UUID mismatch!                          │
│                                                 │
│     Expected: B8E3-4F2A                         │
│     Found:    F7A9-3C1B                         │
│                                                 │
│     This could mean:                            │
│     - Device was reformatted                    │
│     - Different physical device                 │
│                                                 │
│     Options:                                    │
│     1. Update UUID (device was reformatted)     │
│     2. Use anyway (ignore UUID check)           │
│     3. Cancel backup                            │
│                                                 │
│     Choice [1/2/3]: "                           │
└────────────┬────────────────────────────────────┘
             │
       ┌─────┴─────┬─────────┐
       │    1      │    2    │    3
       ▼           ▼         ▼
   ┌──────┐   ┌────────┐  ┌──────┐
   │Update│   │Proceed │  │Cancel│
   │UUID  │   │anyway  │  │      │
   └──┬───┘   └───┬────┘  └──────┘
      │           │
      └─────┬─────┘
            ▼
    ┌───────────────┐
    │Continue backup│
    └───────────────┘
```

## Implementation Phases

### Phase 1: Device Detection Module (3-4 days)

**Goal:** Create lib-device-uuid package with platform-specific implementations.

#### Tasks

1. **Package Setup** (2 hours)
   - Create lib-device-uuid directory structure
   - Configure package.json, tsconfig.json
   - Set up exports and build configuration
   - Add dependencies: lib-runtime

2. **Type Definitions** (1 hour)
   - Define DeviceInfo, DetectionResult interfaces
   - Define DeviceDetector interface
   - Document all interfaces with JSDoc

3. **macOS Implementation** (1 day)
   - Implement MacOSDeviceDetector
   - diskutil command execution
   - Output parsing (Volume UUID, Name, Type)
   - Error handling (command not found, invalid output)
   - Unit tests with mocked execute()

4. **Linux Implementation** (1 day)
   - Implement LinuxDeviceDetector
   - blkid + findmnt command execution
   - Output parsing (UUID, LABEL, TYPE)
   - Error handling
   - Unit tests with mocked execute()

5. **Factory & Null Detector** (2 hours)
   - Implement createDeviceDetector() factory
   - Implement NullDeviceDetector for unsupported platforms
   - Global detector instance management

6. **Integration Tests** (4 hours)
   - Real device tests on macOS
   - Real device tests on Linux (VM or CI)
   - Test mount point resolution
   - Test device listing

**Deliverables:**
- lib-device-uuid package functional
- Unit tests passing (80%+ coverage)
- Integration tests on 2 platforms
- README with usage examples

**Dependencies:**
- lib-runtime (existing)

### Phase 2: Config Schema Enhancement (2 days)

**Goal:** Update BackupSource interface and add validation.

#### Tasks

1. **Schema Update** (2 hours)
   - Add UUID fields to BackupSource interface
   - Update JSDoc comments
   - Update types exports

2. **Validation** (3 hours)
   - Update validateBackupSource() for new fields
   - UUID format validation (optional field)
   - Timestamp validation (ISO 8601 format)
   - Unit tests for validation

3. **Migration Utility** (1 day)
   - Create migrateConfig() function
   - Detect old configs (missing UUID fields)
   - Preserve existing fields
   - Add default values for new fields
   - Unit tests for migration

4. **Backward Compatibility** (4 hours)
   - Test loading old configs (no UUIDs)
   - Test loading new configs (with UUIDs)
   - Test mixed configs (some sources with UUIDs)
   - Ensure graceful degradation

**Deliverables:**
- Updated BackupSource interface
- Validation for new fields
- Migration utility functional
- Backward compatibility verified

**Dependencies:**
- None (can run parallel with Phase 1)

### Phase 3: Device Registry (3 days)

**Goal:** Implement device registration, recognition, and resolution logic.

#### Tasks

1. **DeviceRegistry Class** (1 day)
   - Implement registerDevice()
   - Implement resolveDevice()
   - Implement verifyDevice()
   - Implement updateLastSeen()
   - Unit tests with mocked detector

2. **Registration Workflow** (1 day)
   - Detect unregistered device (no UUID in config)
   - Query device info from mount point
   - Prompt user for confirmation
   - Update config with UUID + timestamps
   - Handle registration errors

3. **Recognition Workflow** (1 day)
   - Resolve mount point from UUID
   - Handle mount point changes
   - Update lastSeen timestamp
   - Handle device not found errors

4. **Conflict Detection** (4 hours)
   - Compare stored UUID vs current UUID
   - Detect UUID mismatches
   - Provide user options (update/proceed/cancel)
   - Handle multiple devices with same label

**Deliverables:**
- DeviceRegistry class functional
- Registration workflow implemented
- Recognition workflow implemented
- Conflict handling implemented
- Unit tests (80%+ coverage)

**Dependencies:**
- Phase 1 (lib-device-uuid)
- Phase 2 (updated schema)

### Phase 4: Backup Integration (3 days)

**Goal:** Integrate device registry with sampler-backup.

#### Tasks

1. **LocalSource Integration** (1 day)
   - Import DeviceRegistry into LocalSource
   - Check for UUID on backup start
   - Resolve mount point if UUID present
   - Fall back to static path if no UUID
   - Update lastSeen after successful backup

2. **CLI Prompts** (1 day)
   - Add registration prompt to backup command
   - Add UUID mismatch prompt
   - Add device not found prompt
   - Format output with device info (UUID, label, mount)

3. **Status Command** (1 day)
   - Add `audiotools backup --status` command
   - List all registered devices
   - Show UUID, label, lastSeen, mount status
   - Highlight stale devices (not seen > 90 days)

**Deliverables:**
- sampler-backup uses DeviceRegistry
- User prompts implemented
- Status command functional
- Integration tests

**Dependencies:**
- Phase 3 (DeviceRegistry)

### Phase 5: Testing & Documentation (2-3 days)

**Goal:** Comprehensive testing and user documentation.

#### Tasks

1. **Cross-Platform Testing** (1 day)
   - Test on macOS with real SD cards
   - Test on Linux (Ubuntu VM) with USB drives
   - Test mount point changes
   - Test multiple devices

2. **Real Device Testing** (4 hours)
   - Test with 3+ physical devices
   - Test registration workflow
   - Test recognition across sessions
   - Test conflict handling (reformatted device)

3. **User Documentation** (1 day)
   - Update backup README with UUID feature
   - Add "Device Registration Guide"
   - Add troubleshooting section
   - Add FAQ (UUID mismatch, lost device)

4. **Migration Guide** (4 hours)
   - Document migration process for existing users
   - Provide examples of old vs new configs
   - Explain behavior changes
   - Provide rollback instructions

**Deliverables:**
- Cross-platform tests passing
- Real device tests documented
- User guide updated
- Migration guide published

**Dependencies:**
- Phase 4 (complete integration)

## Platform-Specific Implementation

### macOS (diskutil)

**Commands:**
```bash
# Get device info
diskutil info /Volumes/SDCARD

# List all volumes
diskutil list -plist

# Eject device
diskutil eject /Volumes/SDCARD
```

**Parsing Strategy:**
- Line-by-line parsing
- Key-value pairs with colon delimiter
- Handle multi-word values
- Fallback to Volume Name if UUID missing

**Error Handling:**
- Command not found → NullDeviceDetector fallback
- Permission denied → Clear error message
- Invalid mount point → Return error result
- Parse failure → Return error result

### Linux (blkid + findmnt)

**Commands:**
```bash
# Get device UUID
blkid /dev/sdb1

# Find device by UUID
blkid -U B8E3-4F2A

# Find mount point from device
findmnt -n -o TARGET /dev/sdb1

# Find device from mount point
findmnt -n -o SOURCE /media/usb
```

**Parsing Strategy:**
- Regex-based parsing for blkid output
- Handle quoted values
- Parse multiple fields in single output line
- Combine blkid + findmnt results

**Error Handling:**
- blkid not found → Try fallback methods
- Permission denied → Try with sudo (interactive)
- Device not mounted → Clear error message
- Parse failure → Return error result

### Windows (Out of Scope)

**Status:** Not implemented in initial release.

**Future Consideration:**
- PowerShell: Get-Volume cmdlet
- wmic deprecated, use CIM cmdlets
- WSL2: Use Linux implementation
- Native Windows: Low priority (few users)

## Testing Strategy

### Unit Tests

**lib-device-uuid:**
- Mock execute() calls with fixtures
- Test parsers with real diskutil/blkid output samples
- Test error handling (command failure, parse failure)
- Test platform factory (correct detector per platform)
- Target: 80%+ code coverage

**audiotools-config:**
- Test schema validation with UUID fields
- Test migration utility with old/new configs
- Test backward compatibility
- Target: 90%+ code coverage

**DeviceRegistry:**
- Mock DeviceDetector interface
- Test registration logic
- Test resolution logic
- Test conflict detection
- Target: 85%+ code coverage

### Integration Tests

**Real Device Tests:**
- Mount SD card, detect UUID
- Unmount, remount at different path, verify recognition
- Test with FAT32, exFAT, ext4 filesystems
- Test with multiple devices
- Run on macOS and Linux

**Cross-Platform Tests:**
- CI/CD: macOS runner + Linux runner
- Test factory creates correct detector
- Test command execution
- Test output parsing

### Manual Testing Checklist

- [ ] Register device on macOS
- [ ] Register device on Linux
- [ ] Recognize device after remount (different path)
- [ ] Handle UUID mismatch (reformatted device)
- [ ] Handle multiple devices with same label
- [ ] Display status with registered devices
- [ ] Update lastSeen after backup
- [ ] Warn about stale devices (> 90 days)
- [ ] Graceful fallback for unsupported platforms
- [ ] Backward compatibility with old configs

## Migration Path

### Existing User Impact

**Current Behavior:**
- Local sources use static mount paths
- User manually updates config if path changes
- No device tracking

**New Behavior:**
- First backup: System prompts to register device
- Subsequent backups: System recognizes device by UUID
- Mount path changes handled automatically
- lastSeen timestamp tracked

**Breaking Changes:**
- None (feature is additive)

### Config Migration

**Old Config (Still Supported):**
```json
{
  "name": "s5k-card",
  "type": "local",
  "source": "/Volumes/SDCARD",
  "device": "sd-card",
  "sampler": "s5000",
  "enabled": true
}
```

**New Config (After Registration):**
```json
{
  "name": "s5k-card",
  "type": "local",
  "source": "/Volumes/SDCARD",
  "device": "sd-card",
  "sampler": "s5000",
  "enabled": true,
  "volumeUUID": "B8E3-4F2A",
  "volumeLabel": "SDCARD",
  "lastSeen": "2025-10-08T14:23:45.123Z",
  "registeredAt": "2025-10-08T14:23:45.123Z"
}
```

**Migration Steps:**
1. User upgrades to new version
2. User runs backup: `audiotools backup s5k-card`
3. System detects missing UUID
4. System prompts: "Register device? [Y/n]"
5. User confirms
6. Config updated with UUID
7. Backup proceeds

### Rollback Strategy

**If feature causes issues:**
1. User can manually remove UUID fields from config
2. System will fall back to static path behavior
3. Or user can downgrade to previous version

**Rollback Steps:**
```json
// Remove these fields from config.json:
- "volumeUUID"
- "volumeLabel"
- "volumeSerial"
- "lastSeen"
- "registeredAt"
```

## Edge Cases & Error Handling

### UUID Conflicts

**Scenario:** Device UUID doesn't match stored UUID

**Causes:**
- Device was reformatted
- Different physical device at same path
- Config error (manual editing)

**Handling:**
1. Detect mismatch
2. Display warning with both UUIDs
3. Offer options:
   - Update UUID (device was reformatted)
   - Proceed anyway (ignore mismatch)
   - Cancel backup
4. Log decision for troubleshooting

### Multiple Devices

**Scenario:** User has 3 SD cards for same sampler

**Handling:**
- Each card tracked separately
- Names distinguish devices: "s5k-card-1", "s5k-card-2", "s5k-card-3"
- UUIDs prevent confusion even if labels match
- Status command shows all devices

### Lost Devices

**Scenario:** Device not seen in 90+ days

**Handling:**
- Status command highlights stale devices
- Warning on backup if device not found
- Suggest removing from config if permanently lost

### No UUID Available

**Scenario:** Filesystem doesn't have UUID (rare)

**Causes:**
- Unformatted media
- Unusual filesystem type
- Platform limitations

**Handling:**
- Fall back to volumeLabel
- Warn user about reduced reliability
- Still track lastSeen for history

### Platform Not Supported

**Scenario:** Running on Windows or BSD

**Handling:**
- NullDeviceDetector returns "unsupported"
- Feature disabled gracefully
- Fall back to static path behavior
- Clear message to user

### Command Execution Failures

**Scenario:** diskutil/blkid fails or not found

**Causes:**
- Command not installed
- Permission issues
- System error

**Handling:**
- Catch execution errors
- Return error result with message
- Fall back to static path behavior
- Suggest troubleshooting steps

## Open Questions & Decisions

### 1. Auto-Update Mount Path in Config?

**Question:** Should we update the `source` field in config with the new mount path?

**Options:**
- **Option A:** Update automatically (path always current)
- **Option B:** Keep original path (historical reference)
- **Option C:** Add separate `lastMountPoint` field

**Recommendation:** Option B (keep original). The UUID is the source of truth, and the `source` path becomes documentation of where it was first registered.

### 2. Hardware Serial Number Support?

**Question:** Should we implement volumeSerial (hardware serial)?

**Pros:**
- More persistent than filesystem UUID
- Survives reformatting
- Better device tracking

**Cons:**
- Not all devices expose serial numbers
- More complex to retrieve (platform-specific)
- May require elevated permissions

**Recommendation:** Add field to schema (future-proof), but implement in Phase 6+ (future enhancement).

### 3. Device Auto-Discovery?

**Question:** Should system automatically scan for devices on startup?

**Pros:**
- Convenient for users
- Can pre-populate device info
- Faster registration

**Cons:**
- Performance overhead
- Privacy concerns (scanning all devices)
- May be unexpected behavior

**Recommendation:** No auto-scan. Explicit user action (running backup) triggers detection. Future enhancement: `audiotools scan` command.

### 4. lastSeen Warning Threshold?

**Question:** What threshold for warning about stale devices?

**Options:**
- 30 days (sensitive)
- 90 days (moderate)
- 180 days (permissive)
- Configurable

**Recommendation:** 90 days (moderate), with config option to adjust.

### 5. UUID Format Validation?

**Question:** Should we validate UUID format strictly?

**Considerations:**
- FAT32 uses short format (B8E3-4F2A)
- ext4 uses long format (UUID4)
- Other filesystems may vary

**Recommendation:** Minimal validation (non-empty string). Accept any format that platform returns. Document expected formats per platform.

## Success Criteria

**Feature Complete When:**
- [x] Device UUID detected on macOS
- [x] Device UUID detected on Linux
- [x] Mount point resolved from UUID
- [x] Device registered with user confirmation
- [x] Device recognized across sessions
- [x] UUID conflicts handled gracefully
- [x] Multiple devices tracked independently
- [x] lastSeen timestamp updated
- [x] Status command shows devices
- [x] Backward compatible with old configs
- [x] Unit tests passing (80%+ coverage)
- [x] Integration tests passing (macOS + Linux)
- [x] User documentation complete
- [x] Migration guide published

**Ready for Release When:**
- All success criteria met
- Real device testing completed (3+ devices)
- Cross-platform testing verified
- User documentation reviewed
- No critical bugs in issue tracker

## Timeline Summary

| Phase | Duration | Dependencies | Deliverable |
|-------|----------|--------------|-------------|
| 1. Device Detection | 3-4 days | lib-runtime | lib-device-uuid package |
| 2. Config Schema | 2 days | None | Updated types + validation |
| 3. Device Registry | 3 days | Phase 1, 2 | DeviceRegistry class |
| 4. Backup Integration | 3 days | Phase 3 | sampler-backup integration |
| 5. Testing & Docs | 2-3 days | Phase 4 | Documentation + tests |

**Total:** 13-17 days

**Milestones:**
- Day 4: Device detection functional
- Day 6: Schema updated and validated
- Day 9: Device registration working
- Day 12: Backup integration complete
- Day 15: Testing and docs finished

---

**Document Version:** 1.0
**Last Updated:** 2025-10-08
**Author:** Audio Tools Team
**Status:** Planning → Ready for Implementation
