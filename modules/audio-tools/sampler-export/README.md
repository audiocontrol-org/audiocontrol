# @oletizi/sampler-export

Extract and convert Akai sampler disk images to modern formats (SFZ, DecentSampler).

## Overview

`@oletizi/sampler-export` is a comprehensive toolkit for extracting files from Akai sampler disk images and converting proprietary sampler programs to modern, open formats. It supports both native Akai disk formats and DOS/FAT32-formatted media, with intelligent batch processing and cross-platform binary bundling.

**Key Features:**

- **Disk Image Extraction**: Extract files from Akai S1000, S3000, S5000, and S6000 disk images
- **Format Support**: Native Akai formats (.hds, .img) and DOS/FAT32 partitioned disks
- **Format Conversion**: Convert .a3p (S3K) and .akp (S5K/S6K) programs to SFZ and DecentSampler
- **Sample Conversion**: Convert Akai .a3s samples to standard WAV format
- **Batch Processing**: Automatically discover and extract multiple disk images with change detection
- **Cross-Platform**: Bundled mtools binaries for zero-configuration installation on macOS, Linux, and Windows

## Installation

```bash
# Using npm
npm install @oletizi/sampler-export

# Using pnpm
pnpm add @oletizi/sampler-export

# Using yarn
yarn add @oletizi/sampler-export
```

### Optional: System mtools Installation

While `sampler-export` bundles mtools binaries for most platforms, you can also use system-installed mtools as a fallback:

```bash
# macOS
brew install mtools

# Debian/Ubuntu Linux
sudo apt install mtools

# RHEL/CentOS Linux
sudo yum install mtools

# Windows
# Download from https://www.gnu.org/software/mtools/
```

## Quick Start

### Extract a Single Disk Image

```typescript
import { extractAkaiDisk } from '@oletizi/sampler-export';

// Extract an Akai disk image with format conversion
const result = await extractAkaiDisk({
  diskImage: '/path/to/disk.hds',
  outputDir: './extracted',
  convertToSFZ: true,
  convertToDecentSampler: true,
  quiet: false
});

console.log(`Extracted ${result.stats.samplesConverted} samples`);
console.log(`Converted ${result.stats.programsFound} programs`);
console.log(`Created ${result.stats.sfzCreated} SFZ files`);
console.log(`Created ${result.stats.dspresetCreated} DecentSampler presets`);
```

### Batch Extract Multiple Disks

```typescript
import { extractBatch } from '@oletizi/sampler-export';

// Automatically discover and extract all disk images from rsnapshot backup
const batchResult = await extractBatch({
  sourceDir: '~/.audiotools/backup',  // rsnapshot backup root
  destDir: '~/.audiotools/sampler-export/extracted',
  samplerTypes: ['s5k', 's3k'],  // S5K (S5000/S6000) and S3K (S3000)
  force: false,  // Skip unchanged disks (timestamp-based)
  convertToSFZ: true,
  convertToDecentSampler: true
});

console.log(`Processed ${batchResult.totalDisks} disks`);
console.log(`New: ${batchResult.successful}, Updated: ${batchResult.updated}`);
console.log(`Skipped: ${batchResult.skipped}, Failed: ${batchResult.failed}`);
```

### Convert Programs Directly

```typescript
import { convertA3PToSFZ, convertAKPToDecentSampler } from '@oletizi/sampler-export';

// Convert S3K program to SFZ
await convertA3PToSFZ(
  '/path/to/program.a3p',
  './output/sfz',
  './output/wav'
);

// Convert S5K program to DecentSampler
convertAKPToDecentSampler(
  '/path/to/program.akp',
  './output/decentsampler',
  './output/wav'
);
```

## API Reference

### Disk Extraction

#### `extractAkaiDisk(options: ExtractionOptions): Promise<ExtractionResult>`

Extract an Akai disk image and convert programs to modern formats.

**Parameters:**

```typescript
interface ExtractionOptions {
  diskImage: string;              // Path to disk image (.hds, .img)
  outputDir: string;              // Base output directory
  convertToSFZ?: boolean;         // Convert programs to SFZ (default: true)
  convertToDecentSampler?: boolean; // Convert to DecentSampler (default: true)
  quiet?: boolean;                // Suppress console output (default: false)
}
```

**Returns:**

```typescript
interface ExtractionResult {
  success: boolean;               // Overall extraction success
  diskName: string;               // Extracted disk name
  outputDir: string;              // Actual output directory used
  stats: {
    samplesExtracted: number;     // Number of samples found
    samplesConverted: number;     // Number of samples converted to WAV
    programsFound: number;        // Number of programs found (.a3p, .akp)
    sfzCreated: number;           // Number of SFZ files created
    dspresetCreated: number;      // Number of DecentSampler presets created
  };
  errors: string[];               // Array of error messages
}
```

**Disk Format Detection:**

- Automatically detects DOS/FAT32 vs. native Akai formats
- Reads only boot sector (512 bytes) for efficient detection
- Routes to appropriate extractor based on format

**Output Directory Structure:**

```
outputDir/
  {diskName}/
    raw/         # Extracted raw files (.a3p, .akp, .a3s)
    wav/         # Converted WAV samples
    sfz/         # SFZ instrument files
    decentsampler/ # DecentSampler preset files
```

---

#### `extractBatch(options: BatchExtractionOptions): Promise<BatchExtractionResult>`

Extract multiple disk images with automatic discovery and change detection.

**Parameters:**

```typescript
interface BatchExtractionOptions {
  sourceDir?: string;             // Source directory (default: ~/.audiotools/backup)
  destDir?: string;               // Destination directory (default: ~/.audiotools/sampler-export/extracted)
  samplerTypes?: SamplerType[];   // ['s5k', 's3k'] (default: both)
  force?: boolean;                // Force re-extraction (default: false)
  convertToSFZ?: boolean;         // Convert to SFZ (default: true)
  convertToDecentSampler?: boolean; // Convert to DecentSampler (default: true)
}

type SamplerType = 's5k' | 's3k';
```

**Returns:**

```typescript
interface BatchExtractionResult {
  totalDisks: number;             // Total disks found
  successful: number;             // Successfully extracted (new)
  updated: number;                // Re-extracted (modified)
  skipped: number;                // Skipped (unchanged)
  failed: number;                 // Failed extractions
  warnings: number;               // Unsupported format warnings
  aggregateStats: {
    totalSamples: number;         // Total samples across all disks
    totalPrograms: number;        // Total programs across all disks
    totalSFZ: number;             // Total SFZ files created
    totalDecentSampler: number;   // Total DecentSampler presets created
  };
  details: DiskExtractionStatus[]; // Per-disk status details
}
```

**Smart Change Detection:**

- Timestamp comparison (disk mtime vs. output mtime)
- Content verification (checks for actual extracted files)
- Force flag to override and re-extract all disks

**rsnapshot Integration:**

Automatically searches rsnapshot backup structure:
```
sourceDir/
  daily.0/        # Most recent backup
    pi-scsi2/     # S5K sampler backup (via PiSCSI/SSH)
      home/orion/images/*.hds
    s3k/          # S3K sampler backup
      *.hds
```

---

### Format Converters

#### S3K (S1000/S3000) Converters

##### `parseA3P(filepath: string): Promise<S3KProgramData>`

Parse an Akai .a3p program file.

**Returns:**

```typescript
interface S3KProgramData {
  name: string;                   // Program name
  midiProg: number;               // MIDI program number
  midiChan: number;               // MIDI channel
  lowKey: number;                 // Playable key range (low)
  highKey: number;                // Playable key range (high)
  keygroups: S3KKeygroupData[];   // Array of keygroups
}

interface S3KKeygroupData {
  lowKey: number;                 // Keygroup key range (0-127)
  highKey: number;
  tune: number;                   // Tuning offset (semitones)
  sampleName: string;             // Referenced sample name
  lowVel: number;                 // Velocity range (0-127)
  highVel: number;
  volOffset: number;              // Volume offset (dB)
  panOffset: number;              // Pan offset (-50 to 50)
  pitch: number;                  // Pitch center (MIDI note)
}
```

##### `convertA3PToSFZ(a3pFile: string, outputDir: string, wavDir: string): Promise<string>`

Convert S3K program to SFZ format.

**Parameters:**
- `a3pFile` - Path to .a3p program file
- `outputDir` - Output directory for .sfz file
- `wavDir` - Directory containing WAV samples

**Returns:** Path to created SFZ file

**SFZ Mapping:**
- Key ranges: `lokey`, `hikey`, `pitch_keycenter`
- Velocity layers: `lovel`, `hivel`
- Tuning: `tune` (cents), `transpose` (semitones)
- Volume: `volume` (dB)
- Pan: `pan` (-100 to 100)

##### `convertA3PToDecentSampler(a3pFile: string, outputDir: string, wavDir: string): Promise<string>`

Convert S3K program to DecentSampler format.

**Parameters:** Same as `convertA3PToSFZ`

**Returns:** Path to created .dspreset file

**DecentSampler XML Structure:**
```xml
<DecentSampler minVersion="1.0.0">
  <groups attack="0.0" decay="0.0" sustain="1.0" release="0.1">
    <group name="ProgramName">
      <sample path="../wav/sample.wav"
              loNote="60" hiNote="72"
              rootNote="60"
              loVel="0" hivel="127"
              tuning="0" volume="0" pan="0"/>
    </group>
  </groups>
</DecentSampler>
```

---

#### S5K/S6K (S5000/S6000) Converters

##### `convertAKPToSFZ(akpPath: string, sfzOutputDir: string, wavOutputDir: string): string`

Convert S5K/S6K program to SFZ format.

**Parameters:**
- `akpPath` - Path to .AKP program file
- `sfzOutputDir` - Output directory for .sfz file
- `wavOutputDir` - Directory containing WAV samples

**Returns:** Path to created SFZ file

**Advanced Features:**
- Multi-zone support (up to 4 zones per keygroup)
- Filter parameters: `cutoff`, `resonance`
- ADSR envelope: `ampeg_attack`, `ampeg_decay`, `ampeg_sustain`, `ampeg_release`
- Global tuning and loudness

##### `convertAKPToDecentSampler(akpPath: string, outputDir: string, wavDir: string): string`

Convert S5K/S6K program to DecentSampler format.

**Parameters:** Same as `convertAKPToSFZ`

**Returns:** Path to created .dspreset file

---

### DOS/FAT Disk Extraction

#### `isDosDisk(diskImage: string): boolean`

Check if a disk image is DOS/FAT formatted.

**Detection Method:**
- Reads only first 512 bytes (boot sector)
- Checks for DOS boot signature (0x55AA at offset 0x1FE)
- Validates FAT filesystem markers ("FAT" string in boot sector)

**Efficiency:** Does not load entire disk image into memory.

#### `extractDosDisk(diskImage: string, diskName: string, outputDir: string, quiet: boolean): Promise<ExtractionResult>`

Extract files from DOS/FAT formatted Akai disk.

**Process:**
1. Detect MBR partition offset (reads partition table)
2. Execute mtools `mcopy` to extract files
3. Organize WAV/AIF audio files into `wav/` directory
4. Return extraction statistics

**Partition Detection:**
- Reads MBR partition table at offset 0x1BE
- Calculates partition start sector (little-endian 4 bytes at 0x1C6)
- Defaults to sector 63 (offset 32256) if detection fails

---

### Binary Management

#### `getMcopyBinary(): string`

Locate mtools mcopy binary with fallback chain.

**Precedence:**
1. Bundled binary for current platform (`bin/mtools/{platform}/mcopy`)
2. System-installed mcopy (via `which mcopy` or `where mcopy`)
3. Throw error with installation instructions

**Platform Detection:**
- `darwin-arm64` (macOS Apple Silicon)
- `darwin-x64` (macOS Intel)
- `linux-x64` (Linux x86-64)
- `linux-arm64` (Linux ARM64)
- `win32-x64` (Windows 64-bit)

**Error Handling:**

Throws descriptive error with platform-specific installation instructions:
```
mcopy binary not found for platform darwin-arm64.
Please install mtools:
  macOS: brew install mtools
  Linux: sudo apt install mtools (Debian/Ubuntu) or sudo yum install mtools (RHEL/CentOS)
  Windows: Install mtools from https://www.gnu.org/software/mtools/
```

#### `isMcopyAvailable(): boolean`

Check if mcopy is available (bundled or system).

**Returns:** `true` if mcopy can be located, `false` otherwise.

---

## Configuration

### Environment Variables

**None required.** The package uses sensible defaults and automatic platform detection.

### mtools Integration

The package automatically sets `MTOOLS_SKIP_CHECK=1` when invoking mcopy to skip mtools.conf configuration file checks. This allows zero-configuration operation with bundled binaries.

### Batch Extraction Defaults

```typescript
const DEFAULT_SOURCE_DIR = '~/.audiotools/backup';
const DEFAULT_DEST_DIR = '~/.audiotools/sampler-export/extracted';
const DEFAULT_RSNAPSHOT_INTERVAL = 'daily.0';  // Most recent backup
```

**Customization:**

```typescript
await extractBatch({
  sourceDir: '/custom/backup/location',
  destDir: '/custom/output/location',
  samplerTypes: ['s5k'],  // Extract only S5K disks
  force: true  // Force re-extraction of all disks
});
```

---

## Examples

### Example 1: Extract Single Disk with Error Handling

```typescript
import { extractAkaiDisk } from '@oletizi/sampler-export';

async function extractWithErrorHandling(diskPath: string) {
  try {
    const result = await extractAkaiDisk({
      diskImage: diskPath,
      outputDir: './extracted',
      convertToSFZ: true,
      convertToDecentSampler: true,
      quiet: false
    });

    if (!result.success) {
      console.error('Extraction failed:');
      result.errors.forEach(err => console.error(`  - ${err}`));
      return;
    }

    console.log('Extraction successful!');
    console.log(`  Output: ${result.outputDir}`);
    console.log(`  Samples: ${result.stats.samplesConverted}/${result.stats.samplesExtracted}`);
    console.log(`  Programs: ${result.stats.programsFound}`);
    console.log(`  SFZ: ${result.stats.sfzCreated}`);
    console.log(`  DecentSampler: ${result.stats.dspresetCreated}`);

    if (result.errors.length > 0) {
      console.warn('Warnings:');
      result.errors.forEach(err => console.warn(`  - ${err}`));
    }
  } catch (err) {
    console.error(`Fatal error: ${err.message}`);
  }
}

await extractWithErrorHandling('/path/to/disk.hds');
```

### Example 2: Batch Extraction with Status Monitoring

```typescript
import { extractBatch } from '@oletizi/sampler-export';
import type { DiskExtractionStatus } from '@oletizi/sampler-export';

async function batchExtractWithMonitoring() {
  const result = await extractBatch({
    sourceDir: '~/.audiotools/backup',
    destDir: '~/.audiotools/sampler-export/extracted',
    samplerTypes: ['s5k', 's3k'],
    force: false
  });

  console.log('\n=== Batch Extraction Summary ===');
  console.log(`Total disks: ${result.totalDisks}`);
  console.log(`Successful: ${result.successful}`);
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Warnings: ${result.warnings}`);

  console.log('\n=== Aggregate Statistics ===');
  console.log(`Total samples: ${result.aggregateStats.totalSamples}`);
  console.log(`Total programs: ${result.aggregateStats.totalPrograms}`);
  console.log(`Total SFZ files: ${result.aggregateStats.totalSFZ}`);
  console.log(`Total DecentSampler presets: ${result.aggregateStats.totalDecentSampler}`);

  // Report failed disks
  const failedDisks = result.details.filter(d => d.status === 'failed');
  if (failedDisks.length > 0) {
    console.log('\n=== Failed Disks ===');
    failedDisks.forEach(disk => {
      console.log(`  ${disk.disk.name}: ${disk.reason}`);
    });
  }

  // Report warnings (unsupported formats)
  const warningDisks = result.details.filter(d => d.status === 'warning');
  if (warningDisks.length > 0) {
    console.log('\n=== Unsupported Formats ===');
    warningDisks.forEach(disk => {
      console.log(`  ${disk.disk.name}: ${disk.reason}`);
    });
  }
}

await batchExtractWithMonitoring();
```

### Example 3: Custom Format Conversion Pipeline

```typescript
import {
  parseA3P,
  createSFZ,
  convertA3PToDecentSampler
} from '@oletizi/sampler-export';

async function customConversionPipeline(a3pPath: string) {
  // Step 1: Parse the program
  const program = await parseA3P(a3pPath);

  console.log(`Program: ${program.name}`);
  console.log(`MIDI: Program ${program.midiProg}, Channel ${program.midiChan}`);
  console.log(`Keygroups: ${program.keygroups.length}`);

  // Step 2: Filter keygroups (e.g., only velocity layers 64-127)
  const filteredProgram = {
    ...program,
    keygroups: program.keygroups.filter(kg => kg.lowVel >= 64)
  };

  console.log(`Filtered keygroups: ${filteredProgram.keygroups.length}`);

  // Step 3: Create custom SFZ with filtered data
  const sfzPath = createSFZ(
    filteredProgram,
    './output/sfz',
    './output/wav',
    a3pPath
  );

  console.log(`Created SFZ: ${sfzPath}`);

  // Step 4: Also create DecentSampler preset (uses original program)
  await convertA3PToDecentSampler(
    a3pPath,
    './output/decentsampler',
    './output/wav'
  );
}

await customConversionPipeline('/path/to/program.a3p');
```

### Example 4: Platform Detection and Binary Management

```typescript
import { getMcopyBinary, isMcopyAvailable } from '@oletizi/sampler-export';

function checkMcopyAvailability() {
  if (!isMcopyAvailable()) {
    console.error('mcopy is not available on this system');
    console.error('Please install mtools or ensure platform is supported');
    return;
  }

  try {
    const mcopyPath = getMcopyBinary();
    console.log(`mcopy binary located: ${mcopyPath}`);

    // Determine if bundled or system
    if (mcopyPath.includes('/bin/mtools/')) {
      console.log('Using bundled mcopy binary');
    } else {
      console.log('Using system-installed mcopy');
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}

checkMcopyAvailability();
```

### Example 5: Extract DOS/FAT Disk Directly

```typescript
import { isDosDisk, extractDosDisk } from '@oletizi/sampler-export';

async function extractDosFormattedDisk(diskPath: string) {
  // Check format first
  if (!isDosDisk(diskPath)) {
    console.log('Not a DOS/FAT formatted disk');
    return;
  }

  console.log('DOS/FAT disk detected');

  // Extract
  const result = await extractDosDisk(
    diskPath,
    'my-disk',
    './output',
    false  // quiet = false for verbose output
  );

  if (result.success) {
    console.log('DOS disk extraction successful!');
    console.log(`  Audio files found: ${result.stats.samplesExtracted}`);
  } else {
    console.error('DOS disk extraction failed:');
    result.errors.forEach(err => console.error(`  - ${err}`));
  }
}

await extractDosFormattedDisk('/path/to/dos-disk.img');
```

---

## Troubleshooting

### Problem: "mcopy binary not found"

**Symptom:**
```
Error: mcopy binary not found for platform darwin-arm64.
Please install mtools:
  macOS: brew install mtools
  ...
```

**Solutions:**

1. **Install system mtools** (recommended):
   ```bash
   # macOS
   brew install mtools

   # Linux (Debian/Ubuntu)
   sudo apt install mtools

   # Linux (RHEL/CentOS)
   sudo yum install mtools
   ```

2. **Check platform support**:
   - Verify your platform is supported: `darwin-arm64`, `darwin-x64`, `linux-x64`, `linux-arm64`, `win32-x64`
   - Run `node -p "process.platform + '-' + process.arch"` to check your platform

3. **Verify bundled binaries**:
   ```bash
   ls node_modules/@oletizi/sampler-export/bin/mtools/
   ```

---

### Problem: "Extraction failed: mcopy exited with code 1"

**Symptom:**
```
Extraction failed: mcopy exited with code 1: Init A: non DOS media
```

**Causes:**
- Disk image is not DOS/FAT formatted (native Akai format)
- Partition offset detection failed
- Corrupted disk image

**Solutions:**

1. **Check disk format**:
   ```typescript
   import { isDosDisk } from '@oletizi/sampler-export';
   console.log(isDosDisk('/path/to/disk.hds'));
   ```

2. **Try native Akai extraction**:
   If `isDosDisk()` returns `false`, the disk is in native Akai format. The `extractAkaiDisk()` function should automatically detect this and use akaitools instead of mcopy.

3. **Check disk image integrity**:
   ```bash
   # Verify file exists and is readable
   ls -lh /path/to/disk.hds

   # Check file size (should be reasonable, e.g., 1-2GB for S5000/S6000)
   du -h /path/to/disk.hds
   ```

---

### Problem: "Sample not found: {sampleName}"

**Symptom:**
```
Sample not found: moogb3600
Warning: Some samples could not be located
```

**Causes:**
- Sample files not extracted (extraction failed earlier)
- Sample naming mismatch (Akai uses internal names)
- WAV files in unexpected location

**Solutions:**

1. **Verify WAV directory**:
   ```bash
   ls -la ./extracted/{diskname}/wav/
   ```

2. **Check sample naming patterns**:
   The converter tries multiple patterns:
   - `samplename.wav`
   - `samplename_-l.wav` (stereo left)
   - `samplename_-r.wav` (stereo right)
   - `{programname}*_-l.wav` (wildcard match)

3. **Manual sample organization**:
   If samples are in different location, copy them to the `wav/` directory:
   ```bash
   cp /path/to/samples/*.wav ./extracted/{diskname}/wav/
   ```

---

### Problem: "Batch extraction finds no disks"

**Symptom:**
```
Found 0 disks (0 S5K, 0 S3K)
```

**Causes:**
- rsnapshot backup structure not found
- Wrong source directory
- No backups created yet

**Solutions:**

1. **Verify rsnapshot backup structure**:
   ```bash
   # Check backup root
   ls -la ~/.audiotools/backup/

   # Check for daily.0 interval
   ls -la ~/.audiotools/backup/daily.0/

   # Check for sampler directories
   ls -la ~/.audiotools/backup/daily.0/pi-scsi2/
   ls -la ~/.audiotools/backup/daily.0/s3k/
   ```

2. **Run rsnapshot backup first**:
   ```bash
   # Using @oletizi/sampler-backup
   akai-backup batch
   ```

3. **Use custom source directory**:
   ```typescript
   await extractBatch({
     sourceDir: '/custom/backup/location',
     destDir: './output'
   });
   ```

---

### Problem: "Velocity range reversed (lovel > hivel)"

**Symptom:**
SFZ or DecentSampler preset plays incorrectly or has no sound.

**Cause:**
Akai program has invalid velocity ranges in keygroup data.

**Solution:**
The converters automatically fix this:
```typescript
// Auto-correction in converter
if (lovel > hivel) {
  [lovel, hivel] = [hivel, lovel];  // Swap values
}
```

If issues persist, manually edit the generated SFZ:
```sfz
lovel=0
hivel=127
```

---

### Problem: "High memory usage during extraction"

**Cause:**
Large disk images (>2GB) being loaded entirely into memory.

**Solution:**
The package is designed to avoid this:

- **DOS disk detection**: Reads only 512 bytes (boot sector)
- **Partition detection**: Reads only MBR (first sector)
- **mcopy extraction**: Streams files directly from disk image

If experiencing high memory usage, check:
1. Node.js version (use v16+ for better memory management)
2. Number of concurrent extractions (batch process runs serially)
3. Disk image corruption (may cause parsing errors)

---

### Problem: Platform-Specific Issues

#### macOS: "mcopy: command not found" after Homebrew install

**Solution:**
```bash
# Verify Homebrew installation
which mcopy

# Add Homebrew to PATH if needed
export PATH="/opt/homebrew/bin:$PATH"  # Apple Silicon
export PATH="/usr/local/bin:$PATH"     # Intel
```

#### Linux: Permission denied executing bundled binary

**Solution:**
```bash
# Make bundled binary executable
chmod +x node_modules/@oletizi/sampler-export/bin/mtools/*/mcopy
```

#### Windows: "mcopy.exe is not recognized"

**Solution:**
1. Install mtools from GNU website
2. Add mtools bin directory to PATH
3. Restart terminal/command prompt

---

## Contributing

Contributions are welcome! Please follow these guidelines:

### Development Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/audio-tools.git
cd audio-tools/sampler-export

# Install dependencies
pnpm install

# Build the package
pnpm run build

# Run tests
pnpm test

# Run tests with coverage
pnpm run test:coverage
```

### Code Quality Standards

- **TypeScript strict mode** required
- **Test coverage** 80%+ (aim for 95%+ on converters)
- **File size limit** 300-500 lines (refactor if larger)
- **Import pattern** Always use `@/` for internal imports
- **No fallbacks** Throw descriptive errors instead of mock data

### Testing Guidelines

```typescript
// Use dependency injection for testability
import { getMcopyBinary } from '@/utils/mtools-binary.js';

// Test with mocked dependencies
import { vi } from 'vitest';

describe('extractDosDisk', () => {
  it('should handle mcopy errors gracefully', async () => {
    // Mock getMcopyBinary to throw error
    vi.mock('@/utils/mtools-binary.js', () => ({
      getMcopyBinary: () => { throw new Error('not found'); }
    }));

    const result = await extractDosDisk('disk.img', 'test', './out', true);
    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('not found');
  });
});
```

### Pull Request Process

1. Create feature branch: `git checkout -b feature/my-feature`
2. Write tests for new functionality
3. Ensure all tests pass: `pnpm test`
4. Update documentation (README, JSDoc comments)
5. Submit pull request with clear description

### Reporting Issues

Please include:
- Platform (OS, architecture)
- Node.js version
- Package version
- Disk image format (if applicable)
- Full error message
- Steps to reproduce

---

## License

Apache-2.0

---

## Credits

**Author:** Orion Letizi

**Dependencies:**
- [mtools](https://www.gnu.org/software/mtools/) - DOS/FAT disk image manipulation
- [@oletizi/sampler-devices](https://www.npmjs.com/package/@oletizi/sampler-devices) - Akai device abstraction and binary format parsing
- [@oletizi/sampler-lib](https://www.npmjs.com/package/@oletizi/sampler-lib) - Akai file format utilities
- [xmlbuilder2](https://www.npmjs.com/package/xmlbuilder2) - DecentSampler XML generation
- [glob](https://www.npmjs.com/package/glob) - File pattern matching
- [pathe](https://www.npmjs.com/package/pathe) - Cross-platform path handling

**Related Projects:**
- [@oletizi/sampler-backup](https://www.npmjs.com/package/@oletizi/sampler-backup) - rsnapshot-based sampler backup
- [@oletizi/sampler-translate](https://www.npmjs.com/package/@oletizi/sampler-translate) - Additional format translation utilities

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history and migration guides.

---

**Need Help?**

- Report issues: https://github.com/yourusername/audio-tools/issues
- Discussion: https://github.com/yourusername/audio-tools/discussions
- Email: your.email@example.com
