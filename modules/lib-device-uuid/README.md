# @audiocontrol/lib-device-uuid

Cross-platform device UUID detection library for Akai sampler backup tools.

## Overview

This library provides a unified interface for detecting device UUIDs and metadata across different platforms (macOS, Linux). It's designed to support the sampler-backup tool by providing reliable device identification for backup target validation.

## Features

- **Platform Detection**: Automatic detection of macOS (darwin) and Linux platforms
- **Unified Interface**: `DeviceDetectorInterface` for consistent API across platforms
- **Type Safety**: Full TypeScript support with strict type checking
- **Descriptive Errors**: Clear error messages for unsupported platforms and unimplemented features
- **Zero Dependencies**: Only requires Node.js built-ins and `@audiocontrol/sampler-lib`

## Installation

```bash
pnpm add @audiocontrol/lib-device-uuid
```

## Usage

### Basic Usage

```typescript
import { createDeviceDetector } from '@audiocontrol/lib-device-uuid';

const detector = createDeviceDetector();
const deviceInfo = await detector.detectDevice('/Volumes/MyDisk');

console.log(`Volume UUID: ${deviceInfo.volumeUUID}`);
console.log(`Volume Label: ${deviceInfo.volumeLabel}`);
console.log(`Filesystem: ${deviceInfo.filesystem}`);
```

### Platform-Specific Usage

```typescript
import { MacOSDetector, LinuxDetector } from '@audiocontrol/lib-device-uuid';

// Use macOS detector directly
const macDetector = new MacOSDetector();
if (macDetector.isSupported()) {
  const info = await macDetector.detectDevice('/Volumes/MyDisk');
}

// Use Linux detector directly
const linuxDetector = new LinuxDetector();
if (linuxDetector.isSupported()) {
  const info = await linuxDetector.detectDevice('/mnt/mydisk');
}
```

### macOS Usage

The macOS detector uses `diskutil info` to retrieve device information:

```typescript
import { MacOSDetector } from '@audiocontrol/lib-device-uuid';

const detector = new MacOSDetector();

// Detect device at mount point
const info = await detector.detectDevice('/Volumes/SDCARD');

console.log(info.volumeUUID);    // e.g., "12345678-1234-1234-1234-123456789012"
console.log(info.volumeLabel);   // e.g., "SDCARD"
console.log(info.devicePath);    // e.g., "/dev/disk2s1"
console.log(info.filesystem);    // e.g., "FAT32"
```

**Important Notes:**
- Requires macOS (Darwin) operating system
- Uses `diskutil info` command (available by default on macOS)
- Some volumes may not have a UUID (especially older FAT32 volumes)
- Throws descriptive error if mount path doesn't exist
- Volume UUID is the most reliable identifier for tracking devices across remounts

**Example Output:**
```typescript
{
  mountPath: '/Volumes/SDCARD',
  volumeUUID: '12345678-1234-1234-1234-123456789012',
  volumeLabel: 'SDCARD',
  devicePath: '/dev/disk2s1',
  filesystem: 'FAT32'
}
```

**Handling Missing UUIDs:**
Some FAT32 volumes formatted by older tools may not have a Volume UUID. In these cases, you can use alternative identifiers:

```typescript
const info = await detector.detectDevice('/Volumes/SDCARD');

// Preferred: Volume UUID
const identifier = info.volumeUUID
  // Fallback 1: Device path (changes if disk order changes)
  || info.devicePath
  // Fallback 2: Volume label (not unique)
  || info.volumeLabel
  // Last resort: Mount path (changes frequently)
  || info.mountPath;
```

### Linux Usage

The Linux detector uses `findmnt` and `blkid` to retrieve device information:

```typescript
import { LinuxDetector } from '@audiocontrol/lib-device-uuid';

const detector = new LinuxDetector();

// Detect device at mount point
const info = await detector.detectDevice('/media/user/SDCARD');

console.log(info.volumeUUID);    // e.g., "12345678-1234-1234-1234-123456789012"
console.log(info.volumeLabel);   // e.g., "SDCARD"
console.log(info.volumeSerial);  // e.g., "12345678-02" (PARTUUID fallback)
console.log(info.devicePath);    // e.g., "/dev/sdb1"
console.log(info.filesystem);    // e.g., "vfat"
```

**Important Notes:**
- Requires Linux operating system
- Uses `findmnt` to resolve mount path → device path
- Uses `blkid` to get UUID and other device info (may require sudo)
- Some volumes may not have a UUID (especially older FAT32 volumes)
- Falls back to PARTUUID (partition UUID) if volume UUID unavailable
- Throws descriptive error if mount path doesn't exist

**Command Requirements:**
- `findmnt`: Usually installed by default (util-linux package)
- `blkid`: Usually installed by default (util-linux package)
- Some systems may require sudo for blkid: `sudo blkid /dev/sdb1`

**Example Output:**
```typescript
{
  mountPath: '/media/user/SDCARD',
  volumeUUID: '12345678-1234-1234-1234-123456789012',
  volumeLabel: 'SDCARD',
  volumeSerial: '12345678-02',  // PARTUUID (fallback)
  devicePath: '/dev/sdb1',
  filesystem: 'vfat'
}
```

**Handling Missing UUIDs on Linux:**
Some FAT32 volumes may not have filesystem UUIDs. The detector uses PARTUUID as fallback:

```typescript
const info = await detector.detectDevice('/media/user/SDCARD');

// Preferred: Volume UUID
const identifier = info.volumeUUID
  // Fallback 1: Volume serial (PARTUUID from partition table)
  || info.volumeSerial
  // Fallback 2: Device path (changes if disk order changes)
  || info.devicePath
  // Fallback 3: Volume label (not unique)
  || info.volumeLabel
  // Last resort: Mount path (changes frequently)
  || info.mountPath;
```

### Type Definitions

```typescript
import type { DeviceInfo, Platform } from '@audiocontrol/lib-device-uuid';

interface DeviceInfo {
  volumeUUID?: string;      // Volume UUID (macOS) or filesystem UUID (Linux)
  volumeLabel?: string;     // Volume label/name
  volumeSerial?: string;    // Volume serial number
  mountPath: string;        // Current mount path
  devicePath?: string;      // Device path (e.g., /dev/disk2s1)
  filesystem?: string;      // Filesystem type (e.g., exfat, vfat)
}

type Platform = 'darwin' | 'linux' | 'win32' | 'unknown';
```

## API Reference

### `createDeviceDetector()`

Factory function that returns the appropriate platform-specific detector.

**Returns:** `DeviceDetectorInterface`

**Throws:** Error if platform is not supported (Windows, unknown)

### `DeviceDetectorInterface`

#### `detectDevice(mountPath: string): Promise<DeviceInfo>`

Detect device information for a given mount path.

**Parameters:**
- `mountPath` - The path where the device is mounted

**Returns:** Promise resolving to `DeviceInfo`

**Throws:** Error if device cannot be detected

#### `isSupported(): boolean`

Check if this detector is supported on the current platform.

**Returns:** `true` if the current platform is supported

#### `getPlatform(): Platform`

Get the platform this detector supports.

**Returns:** Platform identifier

### `detectPlatform()`

Utility function to detect the current platform.

**Returns:** `Platform` - One of 'darwin', 'linux', 'win32', or 'unknown'

## Implementation Status

### ✅ Implemented
- Platform detection
- Type definitions
- Factory pattern for detector creation
- Test suite with 100% coverage
- **macOS diskutil integration** - Full implementation with diskutil parsing
- **Linux blkid/findmnt integration** - Full implementation with two-step detection

### 📋 Planned
- Windows support (WMI/PowerShell)
- Caching layer for repeated queries
- Device change detection/monitoring

## Development

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### Manual Testing (macOS)

For manual verification on macOS with real devices:

```bash
# Test with root volume
pnpm exec tsx test/manual-test-macos.ts /

# Test with external drive
pnpm exec tsx test/manual-test-macos.ts /Volumes/SDCARD

# Test with USB drive
pnpm exec tsx test/manual-test-macos.ts /Volumes/MyUSB
```

### Manual Testing (Linux)

For manual verification on Linux with real devices:

```bash
# Test with root volume
pnpm exec tsx test/manual-test-linux.ts /

# Test with USB drive
pnpm exec tsx test/manual-test-linux.ts /media/user/SDCARD

# Test with mounted SD card
pnpm exec tsx test/manual-test-linux.ts /mnt/sdcard
```

Note: Some systems may require sudo for blkid access:
```bash
sudo pnpm exec tsx test/manual-test-linux.ts /media/user/SDCARD
```

### Clean

```bash
pnpm clean
```

## Architecture

The library follows interface-first design principles:

- **Platform Detection**: Pure function for OS detection
- **Detector Interface**: Unified contract for all platform implementations
- **Factory Pattern**: `createDeviceDetector()` returns appropriate implementation
- **No Fallbacks**: Throw descriptive errors for unimplemented features (not mock data)
- **Child Process Integration**: Uses Node.js `child_process.exec` for platform tools

## Error Handling

All errors throw descriptive messages that explain the failure:

### Platform Not Supported
```
Error: MacOSDetector only works on macOS
Error: LinuxDetector only works on Linux
```

### Device Not Found
```
Error: Failed to detect device at /Volumes/nonexistent: Command failed: diskutil info "/Volumes/nonexistent"
Error: Failed to detect device at /mnt/nonexistent: Failed to find device path: Command failed: findmnt -n -o SOURCE "/mnt/nonexistent"
```

## Use Cases

### Sampler Backup Tool

The primary use case is identifying physical devices for backup operations:

```typescript
import { createDeviceDetector } from '@audiocontrol/lib-device-uuid';

async function validateBackupTarget(mountPath: string) {
  const detector = createDeviceDetector();
  const info = await detector.detectDevice(mountPath);

  // Store UUID in backup configuration
  const deviceId = info.volumeUUID || info.volumeSerial || info.devicePath;

  console.log(`Backup target identified: ${deviceId}`);
  console.log(`Label: ${info.volumeLabel}`);
  console.log(`Filesystem: ${info.filesystem}`);

  return deviceId;
}
```

### Device Tracking

Track device history across multiple mount sessions:

```typescript
const deviceHistory = new Map<string, DeviceInfo[]>();

async function recordDeviceMount(mountPath: string) {
  const detector = createDeviceDetector();
  const info = await detector.detectDevice(mountPath);

  const uuid = info.volumeUUID || info.volumeSerial || info.devicePath;
  if (!uuid) {
    throw new Error('Cannot track device without UUID or device path');
  }

  if (!deviceHistory.has(uuid)) {
    deviceHistory.set(uuid, []);
  }

  deviceHistory.get(uuid)!.push({
    ...info,
    timestamp: new Date()
  });
}
```

## License

Apache-2.0

## Repository

https://github.com/oletizi/ol_dsp/tree/main/modules/audio-tools/lib-device-uuid
