# sampler-lib v1.0 Documentation

Complete documentation for the `@audiocontrol/sampler-lib` package version 1.0.

## Getting Started

- [Installation Guide](./installation.md) - Installation and setup instructions
- [Quick Start](./quick-start.md) - Get up and running in minutes

## Core Documentation

- [API Reference](./api-reference.md) - Complete API documentation
  - Binary format utilities (`bytes2numberLE`, `bytes2numberBE`, nibbles)
  - Sample processing interface (`Sample`, `SampleMetadata`)
  - MIDI utilities (`parseNote`, `scale`, note constants)
  - Akai data models (`AkaiDisk`, `AkaiProgramFile`, record types)
  - I/O utilities (`ProcessOutput`, file operations)
  - Configuration (`ServerConfig`, `ClientConfig`)
  - Result types (`Result`, `ByteArrayResult`, `NumberResult`, etc.)

## Practical Guides

- [Examples](./examples.md) - Practical usage examples
  - Convert sample to 16-bit 44.1kHz
  - Parse Akai disk structure
  - MIDI note conversion
  - Custom process output
  - Binary data processing

- [Troubleshooting](./troubleshooting.md) - Common issues and solutions
  - Cannot find module errors
  - Sample conversion distortion
  - MIDI note parsing returns NaN
  - Binary conversion unexpected results
  - Configuration files not found
  - Sample metadata missing

## API Categories

### Binary Operations
- `bytes2numberLE(b: number[]): number` - Little-endian conversion
- `bytes2numberBE(b: number[]): number` - Big-endian conversion
- `byte2nibblesLE(byte: number): [number, number]` - Nibble extraction
- `nibbles2byte(low: number, high: number): number` - Nibble packing

### Sample Processing
- `newSampleFromBuffer(buffer: Uint8Array): Sample` - Create sample from buffer
- `Sample.to16Bit()` - Convert to 16-bit
- `Sample.to441()` - Resample to 44.1kHz
- `Sample.trim(start, end)` - Trim samples
- `Sample.setRootNote(note)` - Set MIDI root note

### MIDI Utilities
- `parseNote(n: string): number` - Parse note string to MIDI number
- `scale(value, xmin, xmax, ymin, ymax): number` - Scale value between ranges
- `real2natural(value, min, max): number` - Real to natural range
- `natural2real(value, min, max): number` - Natural to real range
- `C3 = 60` - Middle C constant

### Data Models
- `AkaiDisk` - Complete disk structure
- `AkaiPartition` - Disk partition
- `AkaiVolume` - Partition volume
- `AkaiRecord` - File record (program, sample)
- `AkaiProgramFile` - Program with keygroups
- `SampleMetadata` - Sample metadata (rate, root note, loops)

## Version Information

**Current Version:** 1.0.0
**Release Date:** 2025-10-04
**Compatibility:** Node.js 18+, TypeScript 5.7+

## Package Relationships

This package is a dependency for:
- `@audiocontrol/sampler-devices` - Uses binary utils, data models
- `@audiocontrol/sampler-export` - Uses sample processing
- `@audiocontrol/sampler-backup` - Uses configuration, I/O utils
- `@audiocontrol/sampler-translate` - Uses sample processing, MIDI utils

## TypeScript Configuration

This package uses strict TypeScript:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

Import types explicitly:
```typescript
import type {
  Sample,
  SampleMetadata,
  AkaiDisk,
  ProcessOutput
} from '@audiocontrol/sampler-lib';
```

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/audio-tools/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/audio-tools/discussions)
- **Source Code**: [GitHub Repository](https://github.com/yourusername/audio-tools/tree/main/sampler-lib)
