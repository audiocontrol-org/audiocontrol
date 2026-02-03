## API Reference

### Format Converters

#### `decent2Sxk(infile, outdir, outstream?, progress?): Promise<AkaiS56ProgramResult>`

Converts a DecentSampler preset to Akai S5000/S6000 format.

**Parameters**:
- `infile: string` - Path to input .dspreset file
- `outdir: string` - Output directory for generated .AKP and .WAV files
- `outstream?: WriteStream` - Optional output stream for progress messages (default: process.stdout)
- `progress?: Progress` - Optional progress tracker

**Returns**: Promise resolving to `AkaiS56ProgramResult` with:
- `data: AkaiS56Program[]` - Generated programs
- `errors: Error[]` - Any errors encountered

**Features**:
- Parses DecentSampler XML format
- Extracts velocity layers and note ranges
- Converts and trims samples to S5000/S6000 compatible format (16-bit, 44.1kHz)
- Maps up to 4 velocity layers per keygroup
- Preserves sample root note tuning
- Generates unique sample names using hash-based naming

#### `mpc2Sxk(infile, outdir, outstream?, progress?): Promise<void>`

Converts an MPC program to Akai S5000/S6000 format.

**Parameters**:
- `infile: string` - Path to input .xpm MPC program file
- `outdir: string` - Output directory
- `outstream?: WriteStream` - Optional output stream (default: process.stdout)
- `progress?: Progress` - Optional progress tracker

**Features**:
- Parses MPC XML program format
- Extracts slice data from WAV files (embedded 'atem' chunk)
- Trims samples to slice boundaries
- Maps slices across MIDI keyboard (starting at C3)
- Applies detuning for progressive pitch shift effect

### S3K Translation

#### `map(ctx, mapFunction, opts): Promise<MapProgramResult>`

Maps audio files to an Akai S3000 program using a custom mapping function.

**Parameters**:
- `ctx: S3kTranslateContext` - Translation context with tools and factories
- `mapFunction: MapFunction` - Function to map audio sources to keygroups
- `opts: ProgramOpts` - Translation options

**Options** (`ProgramOpts`):
```typescript
interface ProgramOpts {
  source: string;      // Source directory with audio files
  target: string;      // Output directory
  partition: number;   // Akai partition number (1-8)
  prefix: string;      // Program name prefix (max 6 chars)
  wipeDisk: boolean;   // Format disk before writing
}
```

**Returns**: `Promise<MapProgramResult>` with:
- `data?: AbstractKeygroup[]` - Generated keygroup mappings
- `errors: Error[]` - Any errors encountered

#### `chop(cfg, tools, opts, sampleFactory?): Promise<ExecutionResult>`

Chops a long audio file into equally-sized segments and creates an S3K program.

**Parameters**:
- `cfg: ServerConfig` - Server configuration
- `tools: Akaitools` - Akai tools instance
- `opts: ChopOpts` - Chopping options
- `sampleFactory?: SampleFactory` - Optional sample factory

**Options** (`ChopOpts`):
```typescript
interface ChopOpts extends ProgramOpts {
  samplesPerBeat: number;  // Samples per beat (e.g., 22050 at 44.1kHz = 0.5s)
  beatsPerChop: number;    // Beats per chop (1 = one beat slices)
}
```

**Features**:
- Automatically converts to 16-bit, 44.1kHz
- Creates equally-sized chops
- Maps chops sequentially across keyboard
- Generates S3K program with all chops
- Supports stereo samples

### Mapping Functions

#### `mapLogicAutoSampler(sources): AbstractKeygroup[]`

Automatic mapping function for Logic-style multi-sampled instruments. Extracts note information from filenames and maps samples to appropriate key ranges.

**Filename Pattern**: Files must contain note name in format `-[NOTE]-` where NOTE is like `C3`, `F#4`, `Bb2`, etc.

**Example Filenames**:
- `Piano-C3-Soft.aiff`
- `Piano-F#4-Hard.aiff`
- `Bass-Bb2-mf.wav`

**Behavior**:
- Scans filenames for note patterns
- Groups samples by note number
- Creates non-overlapping keygroups
- Maps each sample from previous note to current note
- Supports multiple velocity layers per note (if present)

### Core Abstractions

#### `AudioSource`

Represents an audio file with metadata.

```typescript
interface AudioSource {
  meta: AudioMetadata;
  filepath: string;
  getSample(): Promise<Sample>;
}
```

#### `AudioMetadata`

Audio file metadata.

```typescript
interface AudioMetadata {
  sampleRate?: number;
  bitDepth?: number;
  channelCount?: number;
  sampleCount?: number;
  container?: string;
  codec?: string;
}
```

#### `AbstractProgram`, `AbstractKeygroup`, `AbstractZone`

Abstract representations of sampler programs for format-agnostic translation.

```typescript
interface AbstractProgram {
  keygroups: AbstractKeygroup[];
}

interface AbstractKeygroup {
  zones: AbstractZone[];
}

interface AbstractZone {
  highVelocity: number;
  lowVelocity: number;
  audioSource: AudioSource;
  lowNote: number;
  centerNote: number;
  highNote: number;
}
```

### Translation Context

#### `newDefaultTranslateContext(): Promise<S3kTranslateContext>`

Creates a default translation context for S3K operations.

**Returns**: Context with:
- `akaiTools: Akaitools` - Akai format tools
- `fs: fileio` - File system operations
- `audioFactory: AudioFactory` - Audio file loader
- `audioTranslate: AudioTranslate` - Format converter (FFmpeg)
- `getS3kDefaultProgramPath(count)` - Default program template getter

### Sample Manipulation

See `@audiocontrol/sampler-translate/sample` for the `Sample` interface:

```typescript
interface Sample {
  getMetadata(): SampleMetadata;
  getSampleCount(): number;
  getChannelCount(): number;
  getSampleRate(): number;
  getBitDepth(): number;
  setRootNote(note: number): void;
  trim(start: number, end: number): Sample;
  to16Bit(): Sample;
  to24Bit(): Sample;
  to441(): Sample;
  to48(): Sample;
  writeToStream(stream: WriteStream): Promise<number>;
}
```

## Configuration
