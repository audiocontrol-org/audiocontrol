# @oletizi/sampler-devices

Device abstraction layer for communicating with Akai hardware samplers via MIDI SysEx. Provides TypeScript interfaces
for S3000XL and S5000/S6000 series samplers, including disk operations, program/sample management, and remote control.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Configuration](#configuration)
- [Code Generation](#code-generation)
- [Device Support](#device-support)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Installation

```bash
npm install @oletizi/sampler-devices
```

**Dependencies:**

- `@oletizi/sampler-lib` - Core Akai format handling
- External `akaitools` binary (for disk operations)

## Quick Start

### Working with S3000XL

```typescript
import {newAkaitools, AkaiToolsConfig} from '@oletizi/sampler-devices/s3k';

// Create configuration for local disk
const config: AkaiToolsConfig = {
    diskPath: '/dev/disk4',  // Local disk or disk image
    verbose: true
};

const tools = newAkaitools(config);

// Read disk contents
const disk = await tools.readAkaiDisk();
console.log(`Volumes: ${disk.volumes.length}`);
console.log(`Programs: ${disk.programs.length}`);
console.log(`Samples: ${disk.samples.length}`);

// Read a program file
const program = await tools.readAkaiProgram('MYPROGRAM.AKP');
console.log(`Program: ${program.header.PRNAME}`);
console.log(`Keygroups: ${program.keygroups.length}`);
```

### Working with S5000/S6000

```typescript
import {parseS56kChunk, BasicProgram, Chunk} from '@oletizi/sampler-devices/s5k';

// Parse S5K/S6K chunk data
const chunk: Chunk = parseS56kChunk(rawData);
console.log(`Type: ${chunk.type}, Length: ${chunk.length}`);

// Work with program data
const program = new BasicProgram(data);
console.log(`Program name: ${program.getName()}`);
```

### Remote Operations (PiSCSI/SSH)

```typescript
import {newAkaitools} from '@oletizi/sampler-devices/s3k';

// Configure for remote sampler via SSH
const config = {
    serverConfig: {
        host: 'piscsi.local',
        user: 'pi',
        sshKeyPath: '~/.ssh/id_rsa'
    },
    remote: true,
    verbose: true
};

const tools = newAkaitools(config);

// List remote volumes
const volumes = await tools.remoteVolumes();
volumes.disks.forEach(disk => {
    console.log(`${disk.id}: ${disk.name} (${disk.mounted ? 'mounted' : 'unmounted'})`);
});

// Mount a volume
await tools.remoteMount(volumes.disks[0]);

// Sync changes
await tools.remoteSync();
```

## API Reference

### Main Exports

#### `@oletizi/sampler-devices` (Default)

```typescript
// Core S3000XL types and utilities
export * from './devices/s3000xl';      // Auto-generated S3000XL interfaces
export * from './devices/specs';        // Device specifications
export * from './model/model-akai-s3000xl';  // S3000XL model classes
export * from './utils/akai-utils';     // Akai string/data utilities
export * from './io/akaitools';         // Disk operations
export * from './s5k';                  // S5K/S6K support
```

#### `@oletizi/sampler-devices/s3k` (S3000XL-specific)

```typescript
export * from './devices/s3000xl';
export * from './model/model-akai-s3000xl';
export * from './utils/akai-utils';
export * from './io/akaitools-core';
export * from './io/akaitools';
```

#### `@oletizi/sampler-devices/s5k` (S5000/S6000-specific)

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

### Local Disk Configuration

```typescript
const config: AkaiToolsConfig = {
    diskPath: '/dev/disk4',      // macOS: /dev/diskN
                                 // Linux: /dev/sdX
                                 // Windows: \\.\\PhysicalDriveN
    verbose: true,
    partition: 1                 // Optional: specify partition
};
```

### Remote Configuration (SSH/PiSCSI)

```typescript
const config: AkaiToolsConfig = {
    serverConfig: {
        host: 'piscsi.local',
        port: 22,
        user: 'pi',
        sshKeyPath: '~/.ssh/id_rsa'
    },
    remote: true,
    verbose: true
};
```

### Disk Image Configuration

```typescript
const config: AkaiToolsConfig = {
    diskPath: './backups/sampler-disk.img',
    verbose: true
};
```

## Code Generation

### CRITICAL: Auto-Generated Files

**DO NOT MANUALLY EDIT** the following auto-generated files. Your changes WILL be overwritten.

| File                     | Lines  | Generator            | Purpose                   |
|--------------------------|--------|----------------------|---------------------------|
| `src/devices/s3000xl.ts` | 4,868  | `src/gen-s3000xl.ts` | S3000XL device interfaces |
| Files in `src/gen/`      | Varies | Various generators   | Generator implementations |

**All auto-generated files have headers like:**

```typescript
//
// GENERATED Fri Oct 03 2025 22:37:37 GMT-0700 (Pacific Daylight Time). DO NOT EDIT.
//
```

### Why Code Generation?

The Akai S3000XL has hundreds of parameters across multiple data structures (ProgramHeader, KeyGroup, Zone,
SampleHeader, etc.). Hand-writing parsers and serializers for these structures would be:

- Error-prone (easy to get byte offsets wrong)
- Tedious (repetitive boilerplate)
- Hard to maintain (changes require updating multiple places)

Code generation solves this by:

- Single source of truth (YAML specification)
- Guaranteed consistency between parsers/writers
- Easy to extend (add fields to spec, regenerate)
- Automated JSDoc comments from descriptions

### Generating S3000XL Device Code

The S3000XL device interfaces are auto-generated from YAML specifications.

#### Run the Generator

```bash
cd sampler-devices
npm run gen
```

Or manually:

```bash
tsx src/gen-s3000xl.ts src/devices
```

This will regenerate `src/devices/s3000xl.ts` with a new timestamp.

#### Specification File

The generator reads from:

```
src/gen/akai-s3000xl.spec.yaml
```

This YAML file defines:

- Interface structures (ProgramHeader, KeyGroup, Zone, etc.)
- Field types and descriptions
- Byte offsets and data layouts
- MIDI SysEx message structures

**Example from spec:**

```yaml
- name: ProgramHeader
  className: ProgramHeaderClient
  headerOffset: 0
  fields:
    - n: PRNAME          # Field name
      d: Name of program # Description
      t: string          # Type
      s: 12              # Size in bytes
    - n: PRGNUM
      d: MIDI program number; Range 0 to 128
      t: number
      s: 1
```

#### Generator Implementation

Located at `src/gen/gen-s3000xl-device.ts`, the generator:

1. **Parses YAML** specification
2. **Generates TypeScript interfaces** for each structure
3. **Creates parser functions** (binary → TypeScript objects)
4. **Creates writer functions** (TypeScript objects → binary)
5. **Generates getter/setter methods** with SysEx support
6. **Adds JSDoc comments** from descriptions

#### What Gets Generated

The generator produces **4,868 lines** of TypeScript code including:

**Interfaces** (data structures):

```typescript
export interface ProgramHeader {
    PRNAME: string    // Name of program
    PRNAMELabel: string
    PRGNUM: number    // MIDI program number; Range: 0 to 128
    PRGNUMLabel: string
    // ... 50+ more fields
    raw: number[]     // Raw sysex message data
}
```

**Parser functions** (binary → objects):

```typescript
export function parseProgramHeader(
    raw: number[],
    headerOffset: number,
    header: ProgramHeader
): void {
    // Parses bytes and populates header object
}
```

**Writer functions** (objects → binary):

```typescript
export function ProgramHeader_writePRNAME(
    header: ProgramHeader,
    value: string
): void {
    // Updates header.raw with new value
}
```

**Classes** (with save methods):

```typescript
export class ProgramHeaderClient {
    constructor(device: Device, header: ProgramHeader) {
    }

    async save(): Promise<void> {
        return this.device.sendRaw(this.header.raw);
    }

    getName(): string {
        return this.header.PRNAME;
    }

    setName(v: string): void { /* ... */
    }

    // ... getters/setters for all fields
}
```

### If You Need to Modify Generated Code

**DO NOT** edit the generated `.ts` files directly. Instead:

1. **Modify the specification**: Edit `src/gen/akai-s3000xl.spec.yaml`
   ```yaml
   # Add a new field
   - n: NEWFIELD
     d: Description of new field
     t: number
     s: 2  # Size in bytes
   ```

2. **Update the generator** (if needed): Edit `src/gen/gen-s3000xl-device.ts`
    - Only needed for structural changes
    - Most changes only require spec updates

3. **Regenerate**: Run `npm run gen`
   ```bash
   npm run gen
   ```

4. **Test**: Verify changes work correctly
   ```bash
   npm test
   ```

5. **Commit both**: Commit spec changes AND regenerated code together
   ```bash
   git add src/gen/akai-s3000xl.spec.yaml
   git add src/devices/s3000xl.ts
   git commit -m "feat: add NEWFIELD to S3000XL spec"
   ```

### Other Generators

#### S56K Generator

Located at the repository root:

```bash
tsx gen-s56k.ts
```

Generates S5000/S6000 series device code with chunk-based parsing.

#### Generator Development

When creating new generators:

1. **Follow the pattern** in `src/gen/gen-s3000xl-device.ts`
2. **Add header comments** with generation timestamp
3. **Include "DO NOT EDIT" warnings** in generated files
4. **Add npm script** in `package.json`:
   ```json
   {
     "scripts": {
       "gen:s6k": "tsx src/gen-s6k.ts src/devices"
     }
   }
   ```
5. **Document in this README** in the Code Generation section
6. **Test thoroughly** before committing generated code

### Verifying Generated Code

After regenerating, verify:

1. **Header timestamp updated**:
   ```bash
   head -5 src/devices/s3000xl.ts
   # Should show current date/time
   ```

2. **No TypeScript errors**:
   ```bash
   npm run build
   ```

3. **Tests still pass**:
   ```bash
   npm test
   ```

4. **File size reasonable**:
   ```bash
   wc -l src/devices/s3000xl.ts
   # Should be around 4,868 lines
   ```

## Device Support

### Akai S3000XL

**Full support** for:

- Disk operations (read, write, format, list)
- Program management (read, write, parse)
- Sample operations (WAV conversion, read, write)
- Remote control via SSH/PiSCSI
- MIDI SysEx communication

**Supported operations:**

- Read entire disk structure
- Parse program files (.AKP)
- Parse sample files (.AKS)
- Convert WAV ↔ Akai format
- Remote mount/unmount volumes
- Remote sync operations

### Akai S5000/S6000

**Partial support** for:

- Chunk-based data parsing
- Program structure handling
- Basic data operations

**Note**: S5K/S6K support is less complete than S3000XL. Contributions welcome.

### Device Specifications

Device specifications are defined in `src/devices/specs.ts`:

```typescript
export const programOutputSpec: DeviceSpec = {
    specName: 'programOutputSpec',
    className: 'ProgramOutput',
    sectionCode: Section.PROGRAM,
    items: [
        ["Loudness", "number|0|100|1", /* ... */],
        ["VelocitySensitivity", "number|-100|100|1", /* ... */],
        // ... more parameters
    ]
};
```

Access all specs:

```typescript
import {getDeviceSpecs} from '@oletizi/sampler-devices';

const specs = getDeviceSpecs();
```

## Examples

### Example 1: Backup All Programs

```typescript
import {newAkaitools} from '@oletizi/sampler-devices/s3k';

async function backupAllPrograms(diskPath: string, outputDir: string) {
    const tools = newAkaitools({diskPath, verbose: true});
    const disk = await tools.readAkaiDisk();

    for (const program of disk.programs) {
        const filename = `${program.header.PRNAME}.akp`;
        await tools.akaiRead(
            filename,                    // Source: program on disk
            `${outputDir}/${filename}`,  // Target: local file
            1,                           // Partition
            false                        // Not recursive
        );
        console.log(`Backed up: ${filename}`);
    }
}

await backupAllPrograms('/dev/disk4', './backup');
```

### Example 2: Convert WAV to Akai Sample

```typescript
import {newAkaitools} from '@oletizi/sampler-devices/s3k';

async function importWavSample(wavPath: string, diskPath: string, sampleName: string) {
    const tools = newAkaitools({diskPath, verbose: true});

    const result = await tools.wav2Akai(
        wavPath,           // Source WAV file
        diskPath,          // Target disk
        sampleName         // Akai sample name (8.3 format)
    );

    if (result.code === 0) {
        console.log(`Imported ${sampleName} successfully`);
    } else {
        console.error(`Import failed: ${result.errors.join(', ')}`);
    }
}

await importWavSample('./samples/kick.wav', '/dev/disk4', 'KICK001');
```

### Example 3: List Remote Volumes

```typescript
import {newAkaitools} from '@oletizi/sampler-devices/s3k';

async function listRemoteVolumes() {
    const tools = newAkaitools({
        serverConfig: {
            host: 'piscsi.local',
            user: 'pi',
            sshKeyPath: '~/.ssh/id_rsa'
        },
        remote: true,
        verbose: true
    });

    const volumes = await tools.remoteVolumes();

    console.log('Available volumes:');
    volumes.disks.forEach(disk => {
        console.log(`  ${disk.id}: ${disk.name}`);
        console.log(`    Mounted: ${disk.mounted ? 'Yes' : 'No'}`);
        console.log(`    Device: ${disk.devicePath || 'N/A'}`);
    });
}

await listRemoteVolumes();
```

### Example 4: Parse S5K/S6K Data

```typescript
import {parseS56kChunk, BasicProgram} from '@oletizi/sampler-devices/s5k';

async function parseS6KProgram(data: Uint8Array) {
    const chunk = parseS56kChunk(data);

    if (chunk.type === 'PROGRAM') {
        const program = new BasicProgram(chunk.data);
        console.log(`Program: ${program.getName()}`);
        console.log(`Zones: ${program.getZoneCount()}`);
    }
}
```

### Example 5: Modify and Save Program

```typescript
import {newAkaitools} from '@oletizi/sampler-devices/s3k';

async function setProgramVolume(diskPath: string, programFile: string, loudness: number) {
    const tools = newAkaitools({diskPath, verbose: true});

    // Read program
    const program = await tools.readAkaiProgram(programFile);

    // Modify (requires working with generated S3000XL interfaces)
    // Note: This is a simplified example
    program.header.OUTLEV = loudness; // Output level

    // Write back
    await tools.writeAkaiProgram(programFile, program);
    console.log(`Updated ${programFile} loudness to ${loudness}`);
}

await setProgramVolume('/dev/disk4', 'BASS001.AKP', 80);
```

## Troubleshooting

### "akaitools not found"

**Problem**: External `akaitools` binary not installed or not in PATH.

**Solution**:

1. Install akaitools: https://github.com/philburk/akaitools
2. Ensure it's in your system PATH
3. Or specify full path in configuration

```typescript
// If akaitools is not in PATH, use full path
process.env.PATH += ':/usr/local/bin:/opt/homebrew/bin';
```

### "Permission denied" accessing disk

**Problem**: Insufficient permissions to access disk device.

**Solution** (macOS/Linux):

```bash
# Run with sudo
sudo node your-script.js

# Or add your user to disk group (Linux)
sudo usermod -a -G disk $USER
```

**Solution** (macOS - unmount disk first):

```bash
diskutil list                    # Find your disk
diskutil unmountDisk /dev/disk4  # Unmount before accessing
```

### Remote operations timeout

**Problem**: SSH connection times out or fails.

**Solution**:

1. Verify SSH connectivity: `ssh pi@piscsi.local`
2. Check SSH key permissions: `chmod 600 ~/.ssh/id_rsa`
3. Increase timeout in configuration:
   ```typescript
   const config = {
     serverConfig: {
       host: 'piscsi.local',
       user: 'pi',
       sshKeyPath: '~/.ssh/id_rsa',
       timeout: 30000  // 30 seconds
     },
     remote: true
   };
   ```

### "Invalid partition" error

**Problem**: Specified partition doesn't exist or is invalid.

**Solution**:

1. List partitions first:
   ```typescript
   const disk = await tools.readAkaiDisk();
   console.log(`Partitions: ${disk.volumes.length}`);
   ```
2. Use valid partition number (usually 1-4)
3. Omit partition parameter to use default

### Generated code out of sync

**Problem**: Changes to spec files don't take effect.

**Solution**:

1. Regenerate code: `npm run gen`
2. Rebuild package: `npm run build`
3. Check generator ran successfully (no errors)
4. Verify generated file headers have new timestamp

### TypeScript errors after regeneration

**Problem**: Generated code doesn't compile.

**Solution**:

1. Check YAML spec syntax: `yamllint src/gen/akai-s3000xl.spec.yaml`
2. Verify generator script has no errors
3. Run tests to identify issues: `npm test`
4. Review generator output for warnings

### Import errors

**Problem**: `Cannot find module '@oletizi/sampler-devices/s3k'`

**Solution**:

1. Ensure package is installed: `npm install @oletizi/sampler-devices`
2. Check package.json exports are correct
3. Use correct import paths:
    - `@oletizi/sampler-devices` (default)
    - `@oletizi/sampler-devices/s3k` (S3000XL)
    - `@oletizi/sampler-devices/s5k` (S5000/S6000)

### "No such file" when reading program

**Problem**: Program file doesn't exist on disk.

**Solution**:

1. List disk contents first:
   ```typescript
   const records = await tools.akaiList('/', 1);
   records.records.forEach(r => console.log(r.name));
   ```
2. Use exact filename (case-sensitive, 8.3 format)
3. Verify partition number is correct

## Contributing

Contributions are welcome! This package is part of the audio-tools monorepo.

### Development Setup

```bash
# Clone the monorepo
git clone https://github.com/oletizi/ol_dsp.git
cd ol_dsp/modules/audio-tools/sampler-devices

# Install dependencies
pnpm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build
npm run build
```

### Testing

```bash
# Unit tests
npm test

# Integration tests (requires hardware/disk image)
npm run integration

# Watch mode
npm run test:watch
```

### Code Quality Standards

- **TypeScript strict mode** required
- **80%+ test coverage** required
- **All imports use `@/` pattern** (configured in tsconfig.json)
- **Files < 500 lines** (auto-generated files exempt)
- **Interface-first design** with dependency injection

### Generator Modifications

If modifying code generators:

1. Update generator script (`src/gen/*.ts`)
2. Update specification file (`src/gen/*.yaml`)
3. Regenerate code: `npm run gen`
4. Test thoroughly: `npm test`
5. Commit spec, generator, AND generated code together

### Pull Request Guidelines

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes following code quality standards
3. Add/update tests for new functionality
4. Ensure all tests pass: `npm test`
5. Update this README if adding features
6. Commit with clear messages
7. Push and create pull request

### Known Issues

- S5K/S6K support is incomplete (contributions welcome)
- Some MIDI SysEx operations require hardware for testing
- Remote operations require PiSCSI or similar SSH-accessible SCSI emulator

### Future Enhancements

- Complete S5K/S6K support
- Direct MIDI SysEx communication (without akaitools binary)
- Web-based disk browser
- GUI for program editing
- Additional sampler format support (E-mu, Ensoniq, etc.)

## Special Thanks

- [Hiroyuki Ohsaki for akaitools](https://www.lsnl.jp/~ohsaki/software/akaitools/) - Essential disk operation tools
- [Seb Francis for reverse engineering the Akai S5000/S6000 program format](https://burnit.co.uk/AKPspec/) -
  Comprehensive S5K/S6K documentation

## License

Apache-2.0

## Related Packages

- **[@oletizi/sampler-lib](../sampler-lib)**: Core Akai format handling and utilities
- **[@oletizi/sampler-export](../sampler-export)**: Disk image extraction and format conversion
- **[@oletizi/sampler-backup](../sampler-backup)**: Automated sampler backup system
- **[@oletizi/sampler-midi](../sampler-midi)**: MIDI communication layer
- **[@oletizi/sampler-translate](../sampler-translate)**: Format translation (Akai → SFZ, DecentSampler, etc.)

## Support

- **Issues**: https://github.com/oletizi/ol_dsp/issues
- **Documentation**: See README files in related packages
- **Examples**: Check `test/` directory for more examples

---

**Package Version**: 7.0.0
**Last Updated**: 2025-10-04
**Maintainer**: Orion Letizi
