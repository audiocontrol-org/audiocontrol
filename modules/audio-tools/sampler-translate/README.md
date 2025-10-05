# Sampler Translate

Format translation and conversion utilities for hardware samplers. Convert between DecentSampler, Akai MPC, and Akai S3000/S5000/S6000 formats, with support for sample chopping, velocity layer mapping, and automatic program generation.

![sampler-translate](https://github.com/oletizi/ol_dsp/actions/workflows/sampler-translate.yml/badge.svg)

## Installation

```bash
npm install @oletizi/sampler-translate
```

### Dependencies

This package depends on:
- `@oletizi/sampler-lib` - Core sample manipulation and binary format utilities
- `@oletizi/sampler-devices` - Hardware sampler device abstraction and format specs
- `fluent-ffmpeg` - Audio format conversion (requires FFmpeg installed on system)
- `wavefile` - WAV file manipulation
- `music-metadata` - Audio file metadata parsing

**External Requirements**:
- FFmpeg must be installed on your system for audio format conversion
- For S3K translation: akaitools must be available (via sampler-devices)

## Quick Start

### Converting DecentSampler to Akai S5000/S6000

```typescript
import { decent2Sxk } from '@oletizi/sampler-translate';

// Convert a DecentSampler preset to Akai S5000/S6000 format
await decent2Sxk(
  '/path/to/preset.dspreset',  // Input DecentSampler file
  '/path/to/output',            // Output directory
  process.stdout,               // Progress output stream
  progressTracker               // Optional progress tracker
);
```

### Converting MPC to Akai S5000/S6000

```typescript
import { mpc2Sxk } from '@oletizi/sampler-translate';

// Convert an MPC program to Akai S5000/S6000 format
await mpc2Sxk(
  '/path/to/program.xpm',  // Input MPC program file
  '/path/to/output',       // Output directory
  process.stdout,          // Progress output stream
  progressTracker          // Optional progress tracker
);
```

### S3K Translation with Auto-Mapping

```typescript
import {
  newDefaultTranslateContext,
  map,
  mapLogicAutoSampler
} from '@oletizi/sampler-translate';

// Initialize translation context
const ctx = await newDefaultTranslateContext();

// Convert audio files to S3K program with automatic mapping
const result = await map(ctx, mapLogicAutoSampler, {
  source: '/path/to/samples',     // Directory with audio files
  target: '/path/to/output',       // Output directory
  partition: 1,                    // Akai partition number
  prefix: 'MYSAMP',                // Program name prefix
  wipeDisk: false                  // Whether to format disk first
});

if (result.errors.length > 0) {
  console.error('Translation errors:', result.errors);
}
```

### Sample Chopping for S3K

```typescript
import { chop } from '@oletizi/sampler-translate';
import { newServerConfig } from '@oletizi/sampler-lib';
import { newAkaitools, newAkaiToolsConfig } from '@oletizi/sampler-devices/s3k';

const config = await newServerConfig();
const tools = newAkaitools(await newAkaiToolsConfig());

// Chop a long sample into beats and create S3K program
const result = await chop(config, tools, {
  source: '/path/to/breakbeat.wav',  // Input audio file
  target: '/path/to/output',          // Output directory
  partition: 1,                       // Akai partition
  prefix: 'BREAK',                    // Program prefix
  wipeDisk: false,                    // Format disk first
  samplesPerBeat: 22050,              // Samples per beat (at 44.1kHz)
  beatsPerChop: 1                     // Beats per chop
});
```

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

See `@oletizi/sampler-translate/sample` for the `Sample` interface:

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

### Translation Context

The `TranslateContext` can be customized by providing implementations of:

```typescript
interface TranslateContext {
  fs: fileio;                    // File system operations
  audioFactory: AudioFactory;    // Audio file loading
  audioTranslate: AudioTranslate; // Format conversion
}
```

### Custom Audio Factory

```typescript
const customFactory: AudioFactory = {
  loadFromFile: async (filepath) => {
    // Custom implementation
    return {
      meta: { /* metadata */ },
      filepath: filepath,
      getSample: async () => { /* return Sample */ }
    };
  }
};

const ctx = {
  ...await newDefaultTranslateContext(),
  audioFactory: customFactory
};
```

### Custom Mapping Functions

Create custom mapping logic by implementing `MapFunction`:

```typescript
const customMapper: MapFunction = (sources: AudioSource[]) => {
  const keygroups: AbstractKeygroup[] = [];

  // Your custom mapping logic
  sources.forEach((source, index) => {
    keygroups.push({
      zones: [{
        audioSource: source,
        lowNote: 60 + index,
        centerNote: 60 + index,
        highNote: 60 + index,
        lowVelocity: 0,
        highVelocity: 127
      }]
    });
  });

  return keygroups;
};

// Use with map()
const result = await map(ctx, customMapper, opts);
```

## Examples

### Example 1: Convert Multi-Sampled Instrument

```typescript
import {
  newDefaultTranslateContext,
  map,
  mapLogicAutoSampler
} from '@oletizi/sampler-translate';

async function convertInstrument() {
  const ctx = await newDefaultTranslateContext();

  const result = await map(ctx, mapLogicAutoSampler, {
    source: '/path/to/Piano-Samples',  // Contains Piano-C3.aiff, Piano-D3.aiff, etc.
    target: '/path/to/S3K-Output',
    partition: 1,
    prefix: 'PIANO',
    wipeDisk: false
  });

  if (result.errors.length > 0) {
    console.error('Conversion failed:', result.errors);
    return;
  }

  console.log('Successfully created S3K program: PIANO.a3p');
}

convertInstrument();
```

### Example 2: Chop Breakbeat

```typescript
import { chop } from '@oletizi/sampler-translate';
import { newServerConfig } from '@oletizi/sampler-lib';
import { newAkaitools, newAkaiToolsConfig } from '@oletizi/sampler-devices/s3k';

async function chopBreak() {
  const config = await newServerConfig();
  const tools = newAkaitools(await newAkaiToolsConfig());

  // Chop 4-bar breakbeat at 120 BPM into 1-beat slices
  // At 44.1kHz: 120 BPM = 2 beats/sec = 0.5 sec/beat = 22050 samples/beat
  const result = await chop(config, tools, {
    source: '/path/to/breakbeat.wav',
    target: '/path/to/chopped-output',
    partition: 1,
    prefix: 'BREAK',
    wipeDisk: false,
    samplesPerBeat: 22050,  // 120 BPM at 44.1kHz
    beatsPerChop: 1         // 1-beat slices
  });

  if (result.errors.length === 0) {
    console.log('Breakbeat chopped successfully!');
  }
}

chopBreak();
```

### Example 3: Convert DecentSampler with Progress Tracking

```typescript
import { decent2Sxk, Progress } from '@oletizi/sampler-translate';

// Custom progress tracker
const progress: Progress = {
  total: 0,
  completed: 0,
  incrementTotal(n: number) {
    this.total += n;
  },
  incrementCompleted(n: number) {
    this.completed += n;
    console.log(`Progress: ${this.completed}/${this.total}`);
  },
  setCompleted(n: number) {
    this.completed = n;
  }
};

async function convertWithProgress() {
  const result = await decent2Sxk(
    '/path/to/strings.dspreset',
    '/path/to/output',
    process.stdout,
    progress
  );

  console.log(`Conversion complete: ${result.data.length} programs created`);
  if (result.errors.length > 0) {
    console.error('Errors:', result.errors);
  }
}

convertWithProgress();
```

### Example 4: Custom Velocity Layer Mapping

```typescript
import {
  newDefaultTranslateContext,
  map,
  MapFunction,
  AudioSource,
  AbstractKeygroup
} from '@oletizi/sampler-translate';

// Custom mapper for velocity layers
// Expects filenames like: Piano-C3-pp.aiff, Piano-C3-mf.aiff, Piano-C3-ff.aiff
const velocityLayerMapper: MapFunction = (sources: AudioSource[]) => {
  const keygroups: AbstractKeygroup[] = [];
  const noteMap = new Map<number, AudioSource[]>();

  // Group by note
  for (const source of sources) {
    const match = source.filepath.match(/-([A-G][#b]*[0-9])-/);
    if (match) {
      const noteNumber = parseNote(match[1]);
      if (!noteMap.has(noteNumber)) {
        noteMap.set(noteNumber, []);
      }
      noteMap.get(noteNumber)!.push(source);
    }
  }

  // Create keygroups with velocity layers
  for (const [note, layers] of noteMap) {
    const velocityRanges = [
      { low: 0, high: 42 },   // pp
      { low: 43, high: 84 },  // mf
      { low: 85, high: 127 }  // ff
    ];

    keygroups.push({
      zones: layers.slice(0, 3).map((layer, i) => ({
        audioSource: layer,
        lowNote: note,
        centerNote: note,
        highNote: note,
        lowVelocity: velocityRanges[i].low,
        highVelocity: velocityRanges[i].high
      }))
    });
  }

  return keygroups;
};

async function convertVelocityLayers() {
  const ctx = await newDefaultTranslateContext();

  const result = await map(ctx, velocityLayerMapper, {
    source: '/path/to/velocity-samples',
    target: '/path/to/output',
    partition: 1,
    prefix: 'VELPNO',
    wipeDisk: false
  });

  console.log('Velocity-layered program created');
}
```

## Format Support

### DecentSampler (.dspreset)

**Input**: DecentSampler XML preset file

**Features**:
- Parses `<groups>`, `<group>`, and `<sample>` elements
- Extracts note ranges (loNote, hiNote, rootNote)
- Extracts velocity ranges (loVel, hiVel)
- Extracts sample trim points (start, end)
- Supports envelope parameters (attack, decay, sustain, release)
- Handles relative sample paths

**Output**: Akai S5000/S6000 .AKP program + converted .WAV files

**Limitations**:
- Maximum 4 velocity layers per keygroup (S5K/S6K hardware limit)
- Envelope parameters not fully translated
- Effects not supported

### Akai MPC (.xpm)

**Input**: MPC XML program file + associated .WAV files

**Features**:
- Parses MPC program structure
- Extracts layer information
- Reads embedded slice data from WAV 'atem' chunk
- Supports slice start/end from program or embedded data
- Handles multi-sample programs

**Output**: Akai S5000/S6000 .AKP program + chopped .WAV files

**Limitations**:
- No velocity layer support in translation
- Filter/envelope settings not preserved

### Akai S3000 (.a3p)

**Input**: Audio files (WAV, AIFF, etc.)

**Features**:
- Automatic note detection from filenames
- Multi-sample keyboard mapping
- Stereo sample support
- Sample rate/bit depth conversion
- Velocity layer support
- Sample chopping utilities

**Output**: Akai S3000 .a3p program + .a3s sample files

**Requirements**:
- akaitools (via sampler-devices)
- FFmpeg for format conversion

## Troubleshooting

### FFmpeg Not Found

**Problem**: `Error: Cannot find ffmpeg`

**Solution**: Install FFmpeg on your system:
- **macOS**: `brew install ffmpeg`
- **Linux**: `sudo apt-get install ffmpeg` or `sudo yum install ffmpeg`
- **Windows**: Download from https://ffmpeg.org/download.html

### Audio Format Conversion Fails

**Problem**: `Error translating audio format`

**Solution**:
- Ensure FFmpeg is installed and in PATH
- Check that input file is a valid audio format
- Verify sufficient disk space for conversion
- Check file permissions

### S3K Program Generation Fails

**Problem**: `Error: akaitools not available`

**Solution**:
- Ensure `@oletizi/sampler-devices` is properly installed
- Verify akaitools configuration
- Check that default program templates exist

### Filename Pattern Not Recognized

**Problem**: Samples not mapped correctly with `mapLogicAutoSampler`

**Solution**:
- Ensure filenames contain note pattern: `-[NOTE]-`
- Valid note formats: `C3`, `F#4`, `Bb2`, `G#5`
- Example: `Piano-C3-Soft.wav` ✅
- Invalid: `Piano_C3.wav` ❌ (underscore instead of hyphen)

### Sample Rate/Bit Depth Issues

**Problem**: Samples won't load on hardware

**Solution**:
- S3K/S5K/S6K require 44.1kHz or 48kHz sample rate
- Bit depth must be 16-bit or 24-bit
- Use sample conversion methods:
  ```typescript
  sample.to441().to16Bit()
  ```

### Memory Issues with Large Files

**Problem**: Out of memory error when processing large samples

**Solution**:
- Process samples in batches
- Use streaming where possible
- Increase Node.js heap size: `NODE_OPTIONS=--max-old-space-size=4096`

### Partition Number Invalid

**Problem**: `Error: Invalid partition number`

**Solution**:
- S3000: Partitions 1-8 (default: 1)
- S5000/S6000: Partitions 1-16 (typical: 1)
- Use partition 1 for most cases

## Contributing

Contributions are welcome! Please ensure:

1. All tests pass: `pnpm test`
2. Code follows TypeScript strict mode
3. New features include tests
4. Public API changes include documentation updates
5. Examples are provided for new functionality

### Development Setup

```bash
# Install dependencies
pnpm install

# Build package
pnpm run build

# Run tests
pnpm test

# Run tests with coverage
pnpm run test:coverage

# Watch mode for development
pnpm run test:watch
```

### Adding New Format Support

To add support for a new sampler format:

1. Create parser in `lib-[format].ts`
2. Define format interfaces
3. Implement conversion to `AbstractProgram` structure
4. Add translation function to main exports
5. Write comprehensive tests
6. Document in README

## License

Apache-2.0

## Related Packages

- `@oletizi/sampler-lib` - Core sample manipulation utilities
- `@oletizi/sampler-devices` - Hardware sampler device abstractions
- `@oletizi/sampler-export` - Disk image extraction tools
- `@oletizi/sampler-midi` - MIDI communication utilities

## Support

- GitHub Issues: https://github.com/oletizi/ol_dsp/issues
- Documentation: See package source and inline JSDoc
- Examples: See `/examples` directory in source

---

**Note**: This package is part of the audio-tools monorepo focused on Akai sampler backup, extraction, and format conversion. For complete workflow including disk extraction and backup, see the parent project documentation.
