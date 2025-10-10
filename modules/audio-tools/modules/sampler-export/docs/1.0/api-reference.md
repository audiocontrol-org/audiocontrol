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

