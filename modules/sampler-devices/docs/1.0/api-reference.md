## API Reference

### Main Exports

#### `@audiocontrol/sampler-devices` (Default)

```typescript
// Core S3000XL types and utilities
export * from './devices/s3000xl';      // Auto-generated S3000XL interfaces
export * from './devices/specs';        // Device specifications
export * from './model/model-akai-s3000xl';  // S3000XL model classes
export * from './utils/akai-utils';     // Akai string/data utilities
export * from './io/akaitools';         // Disk operations
export * from './s5k';                  // S5K/S6K support
```

#### `@audiocontrol/sampler-devices/s3k` (S3000XL-specific)

```typescript
export * from './devices/s3000xl';
export * from './model/model-akai-s3000xl';
export * from './utils/akai-utils';
export * from './io/akaitools-core';
export * from './io/akaitools';
```

#### `@audiocontrol/sampler-devices/s5k` (S5000/S6000-specific)

```typescript
export * from './devices/s56k';
```

### Akaitools Interface

The core interface for all disk and device operations:

```typescript
interface Akaitools {
    // Disk operations
    readAkaiDisk(): Promise<AkaiDiskResult>;

    akaiFormat(partitionSize?: number, partitionCount?: number): Promise<ExecutionResult>;

    akaiWrite(sourcePath: string, targetPath: string, partition?: number): Promise<ExecutionResult>;

    akaiRead(sourcePath: string, targetPath: string, partition?: number, recursive?: boolean): Promise<ExecutionResult>;

    akaiList(akaiPath: string, partition?: number): Promise<AkaiRecordResult>;

    // Program/sample operations
    readAkaiProgram(file: string): Promise<AkaiProgramFile>;

    writeAkaiProgram(file: string, program: AkaiProgramFile): Promise<void>;

    writeAkaiSample(file: string, sample: SampleHeader): Promise<void>;

    wav2Akai(sourcePath: string, targetPath: string, targetName: string): Promise<ExecutionResult>;

    akai2Wav(sourcePath: string): Promise<ExecutionResult>;

    // Remote operations (SSH/PiSCSI)
    remoteSync(): Promise<ExecutionResult>;

    remoteVolumes(): Promise<RemoteVolumeResult>;

    remoteUnmount(volume: RemoteDisk): Promise<ExecutionResult>;

    remoteMount(volume: RemoteDisk): Promise<ExecutionResult>;
}
```

### Factory Functions

```typescript
// Create Akaitools instance
function newAkaitools(config?: AkaiToolsConfig): Akaitools;

// Create configuration
function newAkaiToolsConfig(): AkaiToolsConfig;
```

### Key Types

#### AkaiToolsConfig

```typescript
interface AkaiToolsConfig {
    diskPath?: string;           // Path to disk or disk image
    serverConfig?: ServerConfig; // SSH configuration for remote operations
    remote?: boolean;            // Enable remote mode
    verbose?: boolean;           // Verbose logging
    partition?: number;          // Default partition number
}
```

#### AkaiDiskResult

```typescript
interface AkaiDiskResult {
    volumes: AkaiVolume[];       // Disk volumes
    programs: AkaiProgramFile[]; // Programs on disk
    samples: SampleHeader[];     // Samples on disk
}
```

#### AkaiProgramFile

```typescript
interface AkaiProgramFile {
    header: ProgramHeader;       // Program metadata
    keygroups: KeyGroup[];       // Keygroups (zones)
    zones: Zone[];               // Individual zones
}
```

## Configuration
