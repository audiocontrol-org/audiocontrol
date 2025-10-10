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
