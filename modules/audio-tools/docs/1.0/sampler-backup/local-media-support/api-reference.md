# Local Media Support - API Reference

**Version:** 1.0.0
**Last Updated:** 2025-10-05

---

## Overview

This document provides comprehensive API documentation for programmatic usage of the local media support feature. While most users will interact via the CLI, the underlying APIs are available for custom integration scenarios.

---

## Table of Contents

- [BackupSourceFactory](#backupsourcefactory)
- [BackupSource Interface](#backupsource-interface)
- [LocalSource](#localsource)
- [RemoteSource](#remotesource)
- [MediaDetector](#mediadetector)
- [LocalBackupAdapter](#localbackupadapter)
- [Type Definitions](#type-definitions)
- [Usage Examples](#usage-examples)

---

## BackupSourceFactory

Factory for creating backup sources with automatic type detection.

### Class: `BackupSourceFactory`

**Import:**
```typescript
import { BackupSourceFactory } from '@oletizi/sampler-backup';
```

### Methods

#### `create(config: BackupSourceConfig): BackupSource`

Create a backup source from explicit configuration.

**Parameters:**
- `config` - Backup source configuration (RemoteSourceConfig or LocalSourceConfig)

**Returns:**
- `BackupSource` instance (RemoteSource or LocalSource)

**Example:**
```typescript
import { BackupSourceFactory } from '@oletizi/sampler-backup';

// Create local source
const localSource = BackupSourceFactory.create({
  type: 'local',
  sourcePath: '/Volumes/SDCARD',
  backupSubdir: 'sdcard',
  snapshotRoot: '~/.audiotools/backup'
});

// Create remote source
const remoteSource = BackupSourceFactory.create({
  type: 'remote',
  host: 'pi@pi-scsi2.local',
  sourcePath: '/home/pi/images/',
  backupSubdir: 'pi-scsi2'
});
```

---

#### `fromPath(path: string, options?: BackupSourceFromPathOptions): BackupSource`

Create a backup source from a path string with automatic type detection.

**Parameters:**
- `path` - Source path (local or remote SSH syntax)
- `options` - Optional configuration overrides

**Returns:**
- `BackupSource` instance (RemoteSource or LocalSource)

**Throws:**
- `Error` if path is empty or invalid format

**Path Detection Logic:**
- Contains `:` and not a Windows path → Remote SSH source (e.g., `host:/path`)
- Otherwise → Local filesystem source (e.g., `/Volumes/SDCARD`)

**Examples:**
```typescript
import { BackupSourceFactory } from '@oletizi/sampler-backup';

// Local path - auto-detected
const source1 = BackupSourceFactory.fromPath('/Volumes/SDCARD');
await source1.backup('daily');
// Backs up to: ~/.audiotools/backup/daily.0/sdcard/

// Remote SSH path - auto-detected
const source2 = BackupSourceFactory.fromPath('pi@host:/images/');
await source2.backup('daily');
// Backs up to: ~/.audiotools/backup/daily.0/host/

// With custom subdirectory
const source3 = BackupSourceFactory.fromPath('/Volumes/GOTEK', {
  backupSubdir: 'gotek-s3000xl',
  snapshotRoot: '/custom/backup/location'
});
await source3.backup('weekly');
// Backs up to: /custom/backup/location/weekly.0/gotek-s3000xl/
```

---

### Interface: `BackupSourceFromPathOptions`

Options for creating a backup source from a path string.

**Properties:**
- `backupSubdir?: string` - Backup subdirectory name (default: auto-generated)
- `snapshotRoot?: string` - Snapshot root directory (local sources only, default: `~/.audiotools/backup`)
- `configPath?: string` - Config file path (remote sources only, default: `~/.audiotools/rsnapshot.conf`)

**Example:**
```typescript
const options: BackupSourceFromPathOptions = {
  backupSubdir: 'my-sampler',
  snapshotRoot: '/external/backup/drive'
};

const source = BackupSourceFactory.fromPath('/Volumes/SDCARD', options);
```

---

## BackupSource Interface

Unified interface for all backup sources (remote and local).

### Interface: `BackupSource`

**Import:**
```typescript
import type { BackupSource } from '@oletizi/sampler-backup';
```

**Properties:**
- `type: 'remote' | 'local'` - Source type identifier

### Methods

#### `backup(interval: RsnapshotInterval): Promise<BackupResult>`

Execute backup for the specified interval.

**Parameters:**
- `interval` - Backup interval: `'daily'`, `'weekly'`, or `'monthly'`

**Returns:**
- `Promise<BackupResult>` - Backup result with success status and metadata

**Example:**
```typescript
const source = BackupSourceFactory.fromPath('/Volumes/SDCARD');

// Daily backup
const result = await source.backup('daily');
console.log(`Success: ${result.success}`);
console.log(`Snapshot path: ${result.snapshotPath}`);
console.log(`Errors: ${result.errors.join(', ')}`);

// Weekly backup
await source.backup('weekly');

// Monthly backup
await source.backup('monthly');
```

---

#### `test(): Promise<boolean>`

Test if the source is accessible and properly configured.

**Returns:**
- `Promise<boolean>` - true if source is accessible, false otherwise

**Example:**
```typescript
const source = BackupSourceFactory.fromPath('/Volumes/SDCARD');

if (await source.test()) {
  console.log('Source is accessible');
  await source.backup('daily');
} else {
  console.error('Source is not accessible');
}
```

---

#### `getConfig(): BackupSourceConfig`

Get the configuration for this source.

**Returns:**
- `BackupSourceConfig` - Source configuration object

**Example:**
```typescript
const source = BackupSourceFactory.fromPath('/Volumes/SDCARD');
const config = source.getConfig();

console.log(`Type: ${config.type}`);
console.log(`Source path: ${config.sourcePath}`);
console.log(`Backup subdir: ${config.backupSubdir}`);
```

---

## LocalSource

File-based backup source for local media (SD cards, USB drives).

### Class: `LocalSource implements BackupSource`

**Import:**
```typescript
import { LocalSource } from '@oletizi/sampler-backup';
```

### Constructor

```typescript
constructor(
  config: LocalSourceConfig,
  mediaDetector?: MediaDetector,
  backupAdapter?: LocalBackupAdapter
)
```

**Parameters:**
- `config` - Local source configuration
- `mediaDetector` - Optional MediaDetector instance (for testing/DI)
- `backupAdapter` - Optional LocalBackupAdapter instance (for testing/DI)

**Example:**
```typescript
import { LocalSource } from '@oletizi/sampler-backup';

const source = new LocalSource({
  type: 'local',
  sourcePath: '/Volumes/SDCARD',
  backupSubdir: 'sdcard',
  snapshotRoot: '~/.audiotools/backup'
});

await source.backup('daily');
```

### Properties

- `type: 'local'` - Always `'local'` for LocalSource

### Methods

Implements all BackupSource methods:
- `backup(interval: RsnapshotInterval): Promise<BackupResult>`
- `test(): Promise<boolean>`
- `getConfig(): LocalSourceConfig`

**Features:**
- Auto-discovers disk images using MediaDetector
- Incremental backup using LocalBackupAdapter
- Rsnapshot-compatible directory structure
- Rotation logic matching rsnapshot behavior
- Same-day resume support

---

## RemoteSource

SSH-based backup source using rsnapshot.

### Class: `RemoteSource implements BackupSource`

**Import:**
```typescript
import { RemoteSource } from '@oletizi/sampler-backup';
```

### Constructor

```typescript
constructor(
  config: RemoteSourceConfig,
  configPath?: string
)
```

**Parameters:**
- `config` - Remote source configuration
- `configPath` - Optional rsnapshot config file path (default: `~/.audiotools/rsnapshot.conf`)

**Example:**
```typescript
import { RemoteSource } from '@oletizi/sampler-backup';

const source = new RemoteSource({
  type: 'remote',
  host: 'pi@pi-scsi2.local',
  sourcePath: '/home/pi/images/',
  backupSubdir: 'pi-scsi2'
});

await source.backup('daily');
```

### Properties

- `type: 'remote'` - Always `'remote'` for RemoteSource

### Methods

Implements all BackupSource methods:
- `backup(interval: RsnapshotInterval): Promise<BackupResult>`
- `test(): Promise<boolean>`
- `getConfig(): RemoteSourceConfig`

**Features:**
- Wraps existing rsnapshot functionality
- Generates rsnapshot configuration automatically
- 100% backward compatible with existing workflows

---

## MediaDetector

Detects storage media and discovers disk images.

### Class: `MediaDetector`

**Import:**
```typescript
import { MediaDetector } from '@oletizi/sampler-backup';
```

### Constructor

```typescript
constructor(fsOps?: FileSystemOperations)
```

**Parameters:**
- `fsOps` - Optional filesystem operations (for testing/DI)

### Methods

#### `detectMedia(): Promise<MediaInfo[]>`

Detect all available storage media on the system.

**Returns:**
- `Promise<MediaInfo[]>` - Array of MediaInfo for each detected media

**Example:**
```typescript
import { MediaDetector } from '@oletizi/sampler-backup';

const detector = new MediaDetector();
const mediaList = await detector.detectMedia();

for (const media of mediaList) {
  console.log(`Mount point: ${media.mountPoint}`);
  console.log(`Volume name: ${media.volumeName}`);
  console.log(`Disk images: ${media.diskImages.length}`);

  for (const image of media.diskImages) {
    console.log(`  - ${image.name}: ${image.size} bytes`);
  }
}
```

---

#### `findDiskImages(path: string): Promise<DiskImageInfo[]>`

Recursively find disk images in a directory.

**Parameters:**
- `path` - Directory path to search

**Returns:**
- `Promise<DiskImageInfo[]>` - Array of discovered disk images

**Throws:**
- `Error` if path is not accessible

**Example:**
```typescript
import { MediaDetector } from '@oletizi/sampler-backup';

const detector = new MediaDetector();
const images = await detector.findDiskImages('/Volumes/SDCARD');

console.log(`Found ${images.length} disk images`);
for (const image of images) {
  console.log(`${image.name} (${image.path})`);
  console.log(`  Size: ${image.size} bytes`);
  console.log(`  Modified: ${image.mtime}`);
}
```

**Supported Extensions:**
- `.hds` - Hard disk images
- `.img` - Floppy disk images
- `.iso` - CD-ROM images

**Platform-Specific Behavior:**
- **macOS**: Scans `/Volumes/` (excludes system volumes)
- **Linux**: Scans `/media/$USER/` and `/mnt/`

---

## LocalBackupAdapter

Handles file-based incremental backups.

### Class: `LocalBackupAdapter`

**Import:**
```typescript
import { LocalBackupAdapter } from '@oletizi/sampler-backup';
```

### Constructor

```typescript
constructor(fsOps?: FileSystemOperations)
```

**Parameters:**
- `fsOps` - Optional filesystem operations (for testing/DI)

### Methods

#### `backup(options: LocalBackupOptions): Promise<LocalBackupResult>`

Perform backup from source to destination.

**Parameters:**
- `options` - Backup options

**Returns:**
- `Promise<LocalBackupResult>` - Backup result with statistics

**Example:**
```typescript
import { LocalBackupAdapter } from '@oletizi/sampler-backup';

const adapter = new LocalBackupAdapter();

const result = await adapter.backup({
  sourcePath: '/Volumes/SDCARD',
  destPath: '~/.audiotools/backup/daily.0/sdcard',
  incremental: true,
  onProgress: (progress) => {
    console.log(`Progress: ${progress.filesProcessed}/${progress.totalFiles} files`);
    console.log(`  Bytes: ${progress.bytesProcessed}/${progress.totalBytes}`);
  }
});

console.log(`Files copied: ${result.filesCopied}`);
console.log(`Files skipped: ${result.filesSkipped}`);
console.log(`Bytes processed: ${result.bytesProcessed}`);
console.log(`Errors: ${result.errors.join(', ')}`);
```

**Features:**
- Incremental copying (skip unchanged files)
- Timestamp preservation
- Progress tracking
- Stream-based copying for large files
- Error handling with partial file cleanup

---

## Type Definitions

### `BackupSourceConfig`

```typescript
type BackupSourceConfig = RemoteSourceConfig | LocalSourceConfig;
```

Union type for all backup source configurations.

---

### `RemoteSourceConfig`

```typescript
interface RemoteSourceConfig {
  type: 'remote';
  host: string;              // e.g., "pi@pi-scsi2.local"
  sourcePath: string;        // e.g., "/home/pi/images/"
  backupSubdir: string;      // e.g., "pi-scsi2"
}
```

Configuration for remote SSH-based backup sources.

---

### `LocalSourceConfig`

```typescript
interface LocalSourceConfig {
  type: 'local';
  sourcePath: string;        // e.g., "/Volumes/SDCARD"
  backupSubdir: string;      // e.g., "sdcard"
  snapshotRoot?: string;     // Optional override (default: ~/.audiotools/backup)
}
```

Configuration for local file-based backup sources.

---

### `RsnapshotInterval`

```typescript
type RsnapshotInterval = 'daily' | 'weekly' | 'monthly';
```

Backup interval types supported by the system.

---

### `BackupResult`

```typescript
interface BackupResult {
  success: boolean;          // Whether backup completed successfully
  interval: RsnapshotInterval; // Backup interval used
  configPath: string;        // Config file path (remote sources)
  snapshotPath?: string;     // Snapshot directory path
  errors: string[];          // Errors encountered during backup
}
```

Result of a backup operation.

---

### `MediaInfo`

```typescript
interface MediaInfo {
  mountPoint: string;        // e.g., "/Volumes/SDCARD"
  volumeName: string;        // e.g., "SDCARD"
  diskImages: DiskImageInfo[];
}
```

Information about detected storage media.

---

### `DiskImageInfo`

```typescript
interface DiskImageInfo {
  path: string;              // Absolute path to disk image file
  name: string;              // Filename without extension
  size: number;              // File size in bytes
  mtime: Date;               // Last modification time
}
```

Information about a discovered disk image file.

---

### `LocalBackupOptions`

```typescript
interface LocalBackupOptions {
  sourcePath: string;         // Source directory (e.g., /Volumes/SDCARD)
  destPath: string;           // Destination directory
  incremental?: boolean;      // Skip unchanged files (default: true)
  onProgress?: (progress: BackupProgress) => void;
}
```

Options for local backup operations.

---

### `BackupProgress`

```typescript
interface BackupProgress {
  currentFile: string;
  bytesProcessed: number;
  totalBytes: number;
  filesProcessed: number;
  totalFiles: number;
}
```

Progress information during backup.

---

### `LocalBackupResult`

```typescript
interface LocalBackupResult {
  success: boolean;          // Whether backup completed successfully
  filesProcessed: number;    // Number of files processed
  filesCopied: number;       // Number of files copied
  filesSkipped: number;      // Number of files skipped (unchanged)
  bytesProcessed: number;    // Total bytes processed
  errors: string[];          // Errors encountered during backup
}
```

Result of a local backup operation.

---

## Usage Examples

### Example 1: Simple Local Backup

```typescript
import { BackupSourceFactory } from '@oletizi/sampler-backup';

async function backupSDCard() {
  // Create source from path
  const source = BackupSourceFactory.fromPath('/Volumes/SDCARD');

  // Test accessibility
  if (!await source.test()) {
    throw new Error('SD card not accessible');
  }

  // Perform daily backup
  const result = await source.backup('daily');

  if (result.success) {
    console.log(`Backup completed: ${result.snapshotPath}`);
  } else {
    console.error(`Backup failed: ${result.errors.join(', ')}`);
  }
}

backupSDCard().catch(console.error);
```

---

### Example 2: Backup with Progress Tracking

```typescript
import { LocalSource } from '@oletizi/sampler-backup';

async function backupWithProgress() {
  const source = new LocalSource({
    type: 'local',
    sourcePath: '/Volumes/GOTEK',
    backupSubdir: 'gotek-s3000xl'
  });

  // Note: Progress tracking is internal to LocalSource
  // For custom progress handling, use LocalBackupAdapter directly
  const result = await source.backup('daily');

  console.log(`Backup complete: ${result.success}`);
}

backupWithProgress().catch(console.error);
```

---

### Example 3: Custom Backup Location

```typescript
import { BackupSourceFactory } from '@oletizi/sampler-backup';

async function backupToExternalDrive() {
  const source = BackupSourceFactory.fromPath('/Volumes/SDCARD', {
    backupSubdir: 'sdcard-backup',
    snapshotRoot: '/Volumes/ExternalHD/backups'
  });

  await source.backup('daily');
  // Backs up to: /Volumes/ExternalHD/backups/daily.0/sdcard-backup/
}

backupToExternalDrive().catch(console.error);
```

---

### Example 4: Detect and Backup All Media

```typescript
import { MediaDetector, BackupSourceFactory } from '@oletizi/sampler-backup';

async function backupAllMedia() {
  const detector = new MediaDetector();
  const mediaList = await detector.detectMedia();

  for (const media of mediaList) {
    if (media.diskImages.length === 0) {
      console.log(`Skipping ${media.volumeName}: no disk images`);
      continue;
    }

    console.log(`Backing up ${media.volumeName}...`);
    const source = BackupSourceFactory.fromPath(media.mountPoint, {
      backupSubdir: media.volumeName.toLowerCase()
    });

    const result = await source.backup('daily');
    console.log(`  Result: ${result.success ? 'success' : 'failed'}`);
  }
}

backupAllMedia().catch(console.error);
```

---

### Example 5: Mixed Remote and Local Backups

```typescript
import { BackupSourceFactory } from '@oletizi/sampler-backup';

async function backupAllSources() {
  // Remote backup from PiSCSI
  const remoteSource = BackupSourceFactory.fromPath('pi@pi-scsi2.local:/home/pi/images/', {
    backupSubdir: 'pi-scsi2'
  });
  await remoteSource.backup('daily');

  // Local backup from SD card
  const localSource = BackupSourceFactory.fromPath('/Volumes/SDCARD', {
    backupSubdir: 'local-media'
  });
  await localSource.backup('daily');

  console.log('All backups complete');
  // Both backups in: ~/.audiotools/backup/daily.0/
}

backupAllSources().catch(console.error);
```

---

### Example 6: Using LocalBackupAdapter Directly

```typescript
import { LocalBackupAdapter, MediaDetector } from '@oletizi/sampler-backup';

async function customBackup() {
  // Discover disk images
  const detector = new MediaDetector();
  const images = await detector.findDiskImages('/Volumes/SDCARD');

  console.log(`Found ${images.length} disk images`);

  // Perform backup with custom progress handling
  const adapter = new LocalBackupAdapter();
  const result = await adapter.backup({
    sourcePath: '/Volumes/SDCARD',
    destPath: '/custom/backup/location',
    incremental: true,
    onProgress: (progress) => {
      const percentComplete = (progress.bytesProcessed / progress.totalBytes * 100).toFixed(1);
      console.log(`${percentComplete}% complete (${progress.filesProcessed}/${progress.totalFiles} files)`);
    }
  });

  console.log(`Copied ${result.filesCopied} files, skipped ${result.filesSkipped} files`);
  console.log(`Total bytes: ${result.bytesProcessed}`);
}

customBackup().catch(console.error);
```

---

### Example 7: Error Handling

```typescript
import { BackupSourceFactory } from '@oletizi/sampler-backup';

async function backupWithErrorHandling() {
  try {
    const source = BackupSourceFactory.fromPath('/Volumes/SDCARD', {
      backupSubdir: 'sdcard'
    });

    // Test before backup
    if (!await source.test()) {
      throw new Error('Source is not accessible');
    }

    const result = await source.backup('daily');

    if (!result.success) {
      console.error('Backup completed with errors:');
      result.errors.forEach(err => console.error(`  - ${err}`));
      process.exit(1);
    }

    console.log(`Backup successful: ${result.snapshotPath}`);
  } catch (error) {
    console.error(`Backup failed: ${error.message}`);
    process.exit(1);
  }
}

backupWithErrorHandling();
```

---

### Example 8: TypeScript Integration

```typescript
import {
  BackupSourceFactory,
  BackupSource,
  BackupResult,
  LocalSourceConfig,
  RsnapshotInterval
} from '@oletizi/sampler-backup';

class BackupOrchestrator {
  private sources: BackupSource[] = [];

  addLocalSource(config: LocalSourceConfig): void {
    const source = BackupSourceFactory.create(config);
    this.sources.push(source);
  }

  addSourceFromPath(path: string, subdir?: string): void {
    const source = BackupSourceFactory.fromPath(path, {
      backupSubdir: subdir
    });
    this.sources.push(source);
  }

  async backupAll(interval: RsnapshotInterval): Promise<BackupResult[]> {
    const results: BackupResult[] = [];

    for (const source of this.sources) {
      const result = await source.backup(interval);
      results.push(result);
    }

    return results;
  }
}

// Usage
const orchestrator = new BackupOrchestrator();
orchestrator.addSourceFromPath('/Volumes/SDCARD', 'sdcard');
orchestrator.addSourceFromPath('/Volumes/GOTEK', 'gotek');

const results = await orchestrator.backupAll('daily');
console.log(`Completed ${results.length} backups`);
```

---

## Integration Patterns

### CLI Integration

The `akai-backup` CLI uses BackupSourceFactory.fromPath() for auto-detection:

```typescript
// In src/cli/backup.ts
const source = BackupSourceFactory.fromPath(options.source, {
  backupSubdir: options.subdir,
  snapshotRoot: options.snapshotRoot,
  configPath: options.config
});

await source.backup(interval);
```

---

### Testing Pattern

Use dependency injection for testable code:

```typescript
import { LocalSource, MediaDetector, LocalBackupAdapter } from '@oletizi/sampler-backup';

// Create mocks
const mockDetector = {
  findDiskImages: jest.fn().mockResolvedValue([
    { path: '/test.hds', name: 'test', size: 1024, mtime: new Date() }
  ])
};

const mockAdapter = {
  backup: jest.fn().mockResolvedValue({
    success: true,
    filesProcessed: 1,
    filesCopied: 1,
    filesSkipped: 0,
    bytesProcessed: 1024,
    errors: []
  })
};

// Inject mocks
const source = new LocalSource(
  { type: 'local', sourcePath: '/test', backupSubdir: 'test' },
  mockDetector as any,
  mockAdapter as any
);

// Test
await source.backup('daily');
expect(mockDetector.findDiskImages).toHaveBeenCalledWith('/test');
expect(mockAdapter.backup).toHaveBeenCalled();
```

---

## Best Practices

### 1. Use Factory Pattern for Simplicity

```typescript
// Recommended
const source = BackupSourceFactory.fromPath('/Volumes/SDCARD');

// Instead of
const source = new LocalSource({
  type: 'local',
  sourcePath: '/Volumes/SDCARD',
  backupSubdir: 'sdcard'
});
```

---

### 2. Always Test Before Backup

```typescript
if (!await source.test()) {
  console.error('Source not accessible');
  return;
}

await source.backup('daily');
```

---

### 3. Handle Errors Gracefully

```typescript
const result = await source.backup('daily');

if (!result.success) {
  console.error('Backup failed:');
  result.errors.forEach(err => console.error(`  ${err}`));
}
```

---

### 4. Use Progress Callbacks for UX

For custom UX, use LocalBackupAdapter directly:

```typescript
const adapter = new LocalBackupAdapter();
await adapter.backup({
  sourcePath: '/Volumes/SDCARD',
  destPath: '/backup/dest',
  onProgress: (progress) => {
    // Update UI, log progress, etc.
    updateProgressBar(progress.bytesProcessed / progress.totalBytes);
  }
});
```

---

## Related Documentation

- **[User Guide](user-guide.md)** - End-user documentation and workflows
- **[Platform Compatibility](platform-compatibility.md)** - Platform-specific details
- **[Implementation Workplan](implementation/workplan.md)** - Technical implementation details

---

## Support

For API questions or integration help:
- GitHub Issues: [Report a bug](https://github.com/yourusername/audio-tools/issues)
- Discussions: [Ask questions](https://github.com/yourusername/audio-tools/discussions)
