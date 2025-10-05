# @oletizi/sampler-lib

Core library providing shared utilities, binary format parsing, and data models for Akai sampler interaction. This package serves as the foundation for the audio-tools monorepo, offering essential tools for working with Akai sampler formats and MIDI data.

![sampler-lib](https://github.com/oletizi/ol_dsp/actions/workflows/sampler-lib.yml/badge.svg)

## Features

- **Binary Format Parsing**: Low-level utilities for parsing Akai binary data formats (byte/nibble conversion, endianness handling)
- **MIDI Utilities**: Note parsing, scaling functions, and MIDI data structures
- **Sample Processing**: WAV file manipulation, format conversion, and metadata handling
- **Akai Data Models**: TypeScript interfaces for Akai disk structures, programs, and samples
- **I/O Utilities**: Process output handling, file operations, and result types
- **Configuration Management**: Client and server configuration for sampler applications

## Installation

```bash
# Using pnpm (recommended for monorepo)
pnpm add @oletizi/sampler-lib

# Using npm
npm install @oletizi/sampler-lib

# Using yarn
yarn add @oletizi/sampler-lib
```

## Quick Start

### Parsing MIDI Notes

```typescript
import { parseNote, C3 } from '@oletizi/sampler-lib';

// Parse string note to MIDI number
const midiNote = parseNote('C4');  // Returns 72
const midiNote2 = parseNote('A#3'); // Returns 70

// Use predefined constants
console.log(C3); // 60 (Middle C)
```

### Working with Binary Data

```typescript
import {
  bytes2numberLE,
  bytes2numberBE,
  byte2nibblesLE,
  nibbles2byte
} from '@oletizi/sampler-lib';

// Convert bytes to numbers
const littleEndian = bytes2numberLE([0x12, 0x34]); // 13330
const bigEndian = bytes2numberBE([0x12, 0x34]);    // 4660

// Work with nibbles
const [low, high] = byte2nibblesLE(0xAB); // [11, 10]
const byte = nibbles2byte(11, 10);         // 0xAB
```

### Processing WAV Samples

```typescript
import { newSampleFromBuffer, Sample } from '@oletizi/sampler-lib';

// Load sample from buffer
const sample: Sample = newSampleFromBuffer(wavBuffer);

// Get metadata
const metadata = sample.getMetadata();
console.log(`Sample rate: ${metadata.sampleRate}Hz`);
console.log(`Root note: ${metadata.rootNote}`);
console.log(`Channels: ${metadata.channelCount}`);

// Process sample
const processed = sample
  .to16Bit()           // Convert to 16-bit
  .to441()             // Resample to 44.1kHz
  .trim(100, 5000)     // Trim samples
  .cleanup();          // Clean up WAV structure

// Set root note
sample.setRootNote(60); // Middle C
```

### Working with Akai Disk Structures

```typescript
import {
  AkaiDisk,
  AkaiPartition,
  AkaiVolume,
  AkaiRecord,
  AkaiRecordType
} from '@oletizi/sampler-lib';

// Work with disk structure
const disk: AkaiDisk = {
  timestamp: Date.now(),
  name: 'My Disk',
  partitions: []
};

// Iterate through records
disk.partitions.forEach((partition: AkaiPartition) => {
  partition.volumes.forEach((volume: AkaiVolume) => {
    volume.records.forEach((record: AkaiRecord) => {
      if (record.type === AkaiRecordType.SAMPLE) {
        console.log(`Sample: ${record.name}`);
      }
    });
  });
});
```

### Scaling and Conversion Utilities

```typescript
import { scale, real2natural, natural2real } from '@oletizi/sampler-lib';

// Scale value from one range to another
const scaled = scale(50, 0, 100, 0, 127); // 63.5

// Convert between real and natural ranges
const natural = real2natural(75, 0, 100);  // 75
const real = natural2real(75, 0, 100);     // 75
```

## API Reference

### Core Utilities (`lib-core.ts`)

#### Sequence Generation

```typescript
newSequence(base?: string): () => string
```
Creates a sequence generator with timestamp-based unique IDs.

```typescript
const seq = newSequence('sample');
console.log(seq()); // "sample-1234567890-0"
console.log(seq()); // "sample-1234567890-1"
```

#### MIDI Utilities

```typescript
parseNote(n: string): number
```
Parses MIDI note string to MIDI note number. Supports scientific pitch notation (C4, A#3, Bb2, etc.).

**Constants:**
- `C3` = 60 (Middle C)
- `C0` = 24

#### Binary Conversion

```typescript
bytes2numberLE(b: number[]): number
bytes2numberBE(b: number[]): number
byte2nibblesLE(byte: number): [number, number]
nibbles2byte(lowNibble: number, highNibble: number): number
```

#### Scaling Functions

```typescript
scale(value: number | string, xmin: number | string, xmax: number | string,
      ymin: number | string, ymax: number | string): number

real2natural(value: number | string, min: number | string, max: number | string): number
natural2real(value: number | string, min: number | string, max: number | string): number
```

#### Result Types

```typescript
interface Result {
  errors: any[]
  data: any
}

interface ByteArrayResult extends Result {
  data: number[]
}

interface NumberResult extends Result {
  data: number
}

interface StringResult extends Result {
  data: string
}

interface BooleanResult extends Result {
  data: boolean
}
```

### Sample Processing (`model/sample.ts`)

#### Sample Interface

```typescript
interface Sample {
  getMetadata(): SampleMetadata
  getSampleCount(): number
  getChannelCount(): number
  getSampleRate(): number
  getBitDepth(): number
  setRootNote(r: number): void
  trim(start: number, end: number): Sample
  to16Bit(): Sample
  to441(): Sample
  cleanup(): Sample
  write(buf: Buffer, offset: number): number
  writeToStream(stream: WriteStream): Promise<number>
  getSampleData(): Float64Array
  getRawData(): Uint8Array
}
```

#### Sample Metadata

```typescript
interface SampleMetadata {
  manufacturerId: number
  productId: number
  samplePeriod: number
  rootNote: number
  pitchFraction: number
  smpteFormat: number
  smpteOffset: number
  loopCount: number
  sampleLength: number
  channelCount: number
  bitDepth: number
  sampleRate: number
}
```

### Akai Data Models (`model/akai.ts`)

#### Configuration

```typescript
interface AkaiToolsConfig {
  diskFile: string
  akaiToolsPath: string
  piscsiHost?: string
  scsiId?: number
}
```

#### Program Files

```typescript
interface AkaiProgramFile {
  program: ProgramHeader
  keygroups: KeygroupHeader[]
}
```

#### Disk Structures

```typescript
enum AkaiRecordType {
  NULL = 'NULL',
  PARTITION = 'S3000 PARTITION',
  VOLUME = 'S3000 VOLUME',
  PROGRAM = 'S3000 PROGRAM',
  SAMPLE = 'S3000 SAMPLE'
}

interface AkaiRecord {
  type: AkaiRecordType
  name: string
  block: number
  size: number
}

interface AkaiVolume extends AkaiRecord {
  records: AkaiRecord[]
}

interface AkaiPartition extends AkaiRecord {
  volumes: AkaiVolume[]
}

interface AkaiDisk {
  timestamp: number
  name: string
  partitions: AkaiPartition[]
}
```

#### Remote Disk Support

```typescript
interface RemoteDisk {
  scsiId: number
  lun?: number
  image: string
}
```

### I/O Utilities (`lib-io.ts`)

#### Process Output

```typescript
interface ProcessOutput {
  log(msg: string | Object): void
  error(msg: string | Error | Object): void
  write(data: string | Object): void
}

// Factory functions
newStreamOutput(outstream: Writeable, errstream: Writeable,
                debug?: boolean, prefix?: string): ProcessOutput

newServerOutput(debug?: boolean, prefix?: string): ProcessOutput
newClientOutput(debug?: boolean, prefix?: string): ProcessOutput
```

#### File Operations

```typescript
objectFromFile(filename: string): Promise<Result>
```

### Configuration (`lib-config-server.ts`, `lib-config-client.ts`)

#### Server Configuration

```typescript
interface ServerConfig {
  piscsiHost: string
  s3kScsiId: number
  akaiTools: string
  akaiDisk: string
  s3k: string
  sourceRoot: string
  targetRoot: string
  sessionRoot: string
  jobsRoot: string
  logfile: string
  getS3kDefaultProgramPath(keygroupCount: number): string
}

newServerConfig(dataDir?: string): Promise<ServerConfig>
```

#### Client Configuration

```typescript
interface ClientConfig {
  midiInput: string
  midiOutput: string
}

newClientConfig(): ClientConfig
loadClientConfig(dataDir?: string): Promise<ClientConfig>
saveClientConfig(cfg: ClientConfig, dataDir?: string): Promise<string>
```

#### File System Utilities

```typescript
import { mkdir } from '@oletizi/sampler-lib';

await mkdir('/path/to/directory'); // Creates directory if it doesn't exist
```

## Configuration

### Default Data Directory

The library uses `~/.audiotools` as the default data directory for configuration and session files.

### Server Configuration

```typescript
import { newServerConfig } from '@oletizi/sampler-lib';

const config = await newServerConfig();
// Defaults:
// - piscsiHost: "pi-scsi2.local"
// - s3kScsiId: 4
// - sourceRoot: ~/.audiotools/source
// - targetRoot: ~/.audiotools/target
// - sessionRoot: ~/.audiotools/sessions
```

### Client Configuration

```typescript
import { loadClientConfig, saveClientConfig } from '@oletizi/sampler-lib';

// Load existing config
const config = await loadClientConfig();

// Modify and save
config.midiInput = 'My MIDI Input';
config.midiOutput = 'My MIDI Output';
await saveClientConfig(config);
```

## Examples

### Example 1: Convert Sample to 16-bit 44.1kHz

```typescript
import { newSampleFromBuffer } from '@oletizi/sampler-lib';
import { readFile, writeFile } from 'fs/promises';

async function convertSample(inputPath: string, outputPath: string) {
  const buffer = await readFile(inputPath);
  const sample = newSampleFromBuffer(new Uint8Array(buffer));

  const converted = sample
    .to16Bit()
    .to441()
    .cleanup();

  const outputBuffer = Buffer.alloc(converted.getRawData().length);
  converted.write(outputBuffer, 0);
  await writeFile(outputPath, outputBuffer);
}
```

### Example 2: Parse Akai Disk Structure

```typescript
import { AkaiDisk, AkaiRecordType } from '@oletizi/sampler-lib';

function findSamples(disk: AkaiDisk): string[] {
  const samples: string[] = [];

  for (const partition of disk.partitions) {
    for (const volume of partition.volumes) {
      for (const record of volume.records) {
        if (record.type === AkaiRecordType.SAMPLE) {
          samples.push(record.name);
        }
      }
    }
  }

  return samples;
}
```

### Example 3: MIDI Note Conversion

```typescript
import { parseNote, C3 } from '@oletizi/sampler-lib';

function transposeNote(noteString: string, semitones: number): number {
  const midiNote = parseNote(noteString);
  return midiNote + semitones;
}

console.log(transposeNote('C4', 7)); // 79 (G4)
console.log(transposeNote('A3', -12)); // 57 (A2)
```

### Example 4: Custom Process Output

```typescript
import { newStreamOutput, ProcessOutput } from '@oletizi/sampler-lib';

// Create custom output handler
const output: ProcessOutput = newStreamOutput(
  process.stdout,
  process.stderr,
  true,  // debug enabled
  'MyApp'  // prefix
);

output.log('Processing started');
output.write('Processing data...\n');
output.error(new Error('Something went wrong'));
```

### Example 5: Binary Data Processing

```typescript
import { bytes2numberLE, nibbles2byte } from '@oletizi/sampler-lib';

// Parse Akai sample header (example)
function parseSampleHeader(buffer: Buffer): { length: number, rootNote: number } {
  // Sample length (4 bytes, little-endian at offset 0)
  const lengthBytes = [buffer[0], buffer[1], buffer[2], buffer[3]];
  const length = bytes2numberLE(lengthBytes);

  // Root note (1 byte at offset 4)
  const rootNote = buffer[4];

  return { length, rootNote };
}
```

## Relationship to Other Packages

### sampler-devices

`sampler-lib` is a dependency of `sampler-devices`, providing:
- Core binary parsing utilities
- Shared data models (AkaiProgramFile, etc.)
- MIDI note conversion functions

### sampler-export

Uses `sampler-lib` for:
- Sample format conversion (WAV processing)
- Binary data parsing utilities
- Akai disk structure models

### sampler-backup

Uses `sampler-lib` for:
- Configuration management
- Process output utilities
- Result types

### sampler-translate

Uses `sampler-lib` for:
- Sample processing
- MIDI utilities
- Binary conversion functions

## Troubleshooting

### Issue: "Cannot find module '@oletizi/sampler-lib'"

**Solution**: Ensure the package is installed and you're using the correct import path:

```bash
pnpm install @oletizi/sampler-lib
```

### Issue: Sample conversion produces distorted audio

**Solution**: Check the sample format and apply conversions in the correct order:

```typescript
// Correct order
sample.to16Bit().to441().cleanup();

// Check source format first
const metadata = sample.getMetadata();
console.log(`Source: ${metadata.bitDepth}-bit, ${metadata.sampleRate}Hz`);
```

### Issue: MIDI note parsing returns NaN

**Solution**: Ensure the note string follows scientific pitch notation (letter + optional sharp/flat + octave):

```typescript
// Valid formats
parseNote('C4');   // ✓
parseNote('A#3');  // ✓
parseNote('Bb2');  // ✓

// Invalid formats
parseNote('C');    // ✗ (missing octave)
parseNote('H4');   // ✗ (invalid note letter)
```

### Issue: Binary conversion gives unexpected results

**Solution**: Check endianness - Akai formats typically use big-endian:

```typescript
// For Akai data, usually use big-endian
const value = bytes2numberBE([0x12, 0x34]);

// Some fields may be little-endian
const value2 = bytes2numberLE([0x12, 0x34]);
```

### Issue: Configuration files not found

**Solution**: The library looks for config in `~/.audiotools` by default. Create the directory or specify a custom path:

```typescript
import { mkdir } from '@oletizi/sampler-lib';
import { homedir } from 'os';
import { join } from 'path';

const dataDir = join(homedir(), '.audiotools');
await mkdir(dataDir);

// Or use custom directory
const config = await loadClientConfig('/custom/path');
```

### Issue: Sample metadata missing or incorrect

**Solution**: Some WAV files may not have proper SMPL chunk. Check metadata existence:

```typescript
const metadata = sample.getMetadata();

if (metadata.rootNote === undefined) {
  console.log('No root note in WAV file, using default');
  sample.setRootNote(60); // Middle C
}
```

## TypeScript Configuration

This package uses strict TypeScript configuration:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

All public APIs are fully typed. Import types directly from the package:

```typescript
import type {
  Sample,
  SampleMetadata,
  AkaiDisk,
  ProcessOutput
} from '@oletizi/sampler-lib';
```

## Contributing

This package is part of the audio-tools monorepo. Contributions should follow the project's coding standards:

- Use `@/` import pattern for internal imports
- Maintain TypeScript strict mode compliance
- Add tests for all new functionality (80%+ coverage target)
- Document all public APIs with JSDoc comments
- Keep files under 500 lines (refactor if larger)

### Development Setup

```bash
# Clone the monorepo
git clone <repository-url>
cd modules/audio-tools

# Install dependencies
pnpm install

# Run tests
cd sampler-lib
pnpm test

# Run tests with coverage
pnpm test:coverage

# Build
pnpm build
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

### Package Architecture

```
sampler-lib/
├── src/
│   ├── index.ts              # Main exports
│   ├── lib-core.ts           # Core utilities (MIDI, binary, scaling)
│   ├── lib-io.ts             # I/O utilities
│   ├── lib-config-client.ts  # Client configuration
│   ├── lib-config-server.ts  # Server configuration
│   ├── lib-fs-server.ts      # File system utilities
│   └── model/
│       ├── akai.ts           # Akai data structures
│       └── sample.ts         # Sample processing
├── test/
│   └── unit/                 # Unit tests
└── package.json
```

## License

Apache-2.0

## Author

Orion Letizi

---

For more information about the audio-tools project, see the [main repository README](../../README.md).
