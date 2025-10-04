# @oletizi/sampler-export

Extract Akai sampler disk images and convert programs to modern formats (SFZ, DecentSampler). Supports batch extraction with intelligent timestamp-based change detection.

## Features

- **Disk image extraction**: Extract `.hds` and `.img` disk images from Akai S5000/S6000 and S3000XL samplers
- **Format conversion**: Convert programs to SFZ and DecentSampler formats
- **Batch processing**: Automatically discover and extract multiple disks
- **Timestamp detection**: Skip unchanged disks, extract only modified ones
- **Rsnapshot integration**: Works seamlessly with `@oletizi/sampler-backup`
- **Status indicators**: Clear visual feedback (✓ new, ↻ modified, ⊘ unchanged, ✗ failed)

## Installation

```bash
# Install from the audio-tools monorepo
pnpm install

# Build the package
pnpm --filter sampler-export build
```

## Quick Start

```bash
# Extract all disk images from rsnapshot backups
akai-extract batch

# Extract a single disk image
akai-extract disk ~/path/to/disk.hds ./output

# Convert a single program file
akai-extract convert s5k program.akp ./output
```

## CLI Commands

### `akai-extract disk`

Extract a single Akai disk image.

```bash
akai-extract disk <disk-image> <output-dir> [options]
```

**Arguments:**
- `disk-image` - Path to the Akai disk image (`.hds`, `.img`, etc.)
- `output-dir` - Output directory for extracted files

**Options:**
- `--no-sfz` - Skip SFZ conversion
- `--no-decentsampler` - Skip DecentSampler conversion

**Example:**
```bash
akai-extract disk ~/backups/HD1.hds ./extracted/HD1
```

**Output structure:**
```
./extracted/HD1/
├── samples/
│   ├── kick.wav
│   ├── snare.wav
│   └── ...
├── programs/
│   ├── DrumKit.akp
│   └── ...
├── sfz/
│   ├── DrumKit.sfz
│   └── ...
└── decentsampler/
    ├── DrumKit.dspreset
    └── ...
```

### `akai-extract batch`

Extract all disk images from backup directories with smart timestamp detection.

```bash
akai-extract batch [options]
```

**Options:**
- `--source <path>` - Source directory (default: `~/.audiotools/backup`)
- `--dest <path>` - Destination directory (default: `~/.audiotools/sampler-export/extracted`)
- `--samplers <types>` - Comma-separated sampler types (default: `s5k,s3k`)
- `--force` - Force re-extraction of all disks
- `--no-sfz` - Skip SFZ conversion
- `--no-decentsampler` - Skip DecentSampler conversion

**Example:**
```bash
# Extract all disks with default settings
akai-extract batch

# Extract only S5K disks
akai-extract batch --samplers s5k

# Force re-extract all disks
akai-extract batch --force

# Custom source and destination
akai-extract batch --source ~/custom-backups --dest ~/extracted
```

**Output:**
```
Scanning for disk images...
Found 3 disks (3 S5K, 0 S3K)

Extracting S5K disks:
  [1/3] HD0 ✓ new (125 samples, 42 programs)
  [2/3] HD1 ⊘ unchanged (last: 2025-10-03)
  [3/3] HD2 ↻ modified (disk updated: 2025-10-04) (256 samples, 89 programs)

Summary:
  New: 1
  Updated: 1
  Unchanged: 1
  Total samples: 381
  Total programs: 131
```

### `akai-extract convert`

Convert Akai program files to SFZ or DecentSampler.

```bash
akai-extract convert <sampler-type> <program-file> <output-dir> [options]
```

**Arguments:**
- `sampler-type` - Sampler type: `s5k` or `s3k`
- `program-file` - Path to Akai program file (`.akp` for S5K, `.a3p` for S3K)
- `output-dir` - Output directory for converted files

**Options:**
- `--format <format>` - Output format: `sfz`, `decentsampler`, or `both` (default: `both`)

**Example:**
```bash
# Convert S5K program to both formats
akai-extract convert s5k DrumKit.akp ./converted

# Convert S3K program to SFZ only
akai-extract convert s3k Bass.a3p ./converted --format sfz
```

## Timestamp-Based Change Detection

The batch extractor uses intelligent timestamp comparison to avoid unnecessary re-extraction:

**Extraction decision logic:**
1. **New disk**: Output directory doesn't exist → Extract
2. **Modified disk**: Disk image mtime > output directory mtime → Extract
3. **Unchanged disk**: Disk image mtime ≤ output directory mtime → Skip
4. **Force flag**: `--force` option overrides all checks → Extract

**Example scenarios:**

```bash
# First run: All disks are new
akai-extract batch
# Output: HD0 ✓ new, HD1 ✓ new, HD2 ✓ new

# Second run: No changes
akai-extract batch
# Output: HD0 ⊘ unchanged, HD1 ⊘ unchanged, HD2 ⊘ unchanged

# After modifying HD1 on sampler
akai-extract batch
# Output: HD0 ⊘ unchanged, HD1 ↻ modified, HD2 ⊘ unchanged

# Force re-extraction
akai-extract batch --force
# Output: All disks re-extracted
```

## Integration with sampler-backup

This package is designed to work with `@oletizi/sampler-backup`'s rsnapshot-based backups:

**Directory structure:**
```
~/.audiotools/backup/          # Rsnapshot root
└── daily.0/                   # Latest snapshot (source for extraction)
    └── pi-scsi2/
        └── home/orion/images/
            ├── HD0.hds
            ├── HD1.hds
            └── ...

~/.audiotools/sampler-export/  # Extraction output
└── extracted/
    ├── s5k/                   # S5000/S6000 extractions
    │   ├── HD0/
    │   ├── HD1/
    │   └── ...
    └── s3k/                   # S3000XL extractions
```

**One-click workflow:**
```bash
# Backup and extract in one command
pnpm backup-and-extract
```

This runs:
1. `akai-backup batch` - Creates/updates rsnapshot backups
2. `akai-extract batch` - Extracts disks from `daily.0` snapshot

## Supported Formats

### Input Formats
- **S5000/S6000** (s5k): `.hds`, `.img` disk images
- **S3000XL** (s3k): `.hds`, `.img` disk images

### Output Formats

**SFZ:**
- Industry-standard sampler format
- Compatible with most DAWs and samplers
- Includes zone mapping, velocity layers, loop points

**DecentSampler:**
- Free sampler plugin format
- User-friendly interface
- Cross-platform (VST, AU, standalone)

## Programmatic Usage

```typescript
import { extractAkaiDisk, extractBatch } from '@oletizi/sampler-export';

// Extract a single disk
const result = await extractAkaiDisk({
    diskImage: '/path/to/disk.hds',
    outputDir: './output',
    convertToSFZ: true,
    convertToDecentSampler: true
});

if (result.success) {
    console.log(`Extracted ${result.stats.samplesConverted} samples`);
    console.log(`Found ${result.stats.programsFound} programs`);
}

// Batch extract
const batchResult = await extractBatch({
    sourceDir: '~/.audiotools/backup',
    destDir: '~/.audiotools/sampler-export/extracted',
    samplerTypes: ['s5k', 's3k'],
    force: false
});

console.log(`Total: ${batchResult.totalDisks}`);
console.log(`Successful: ${batchResult.successful}`);
console.log(`Updated: ${batchResult.updated}`);
console.log(`Skipped: ${batchResult.skipped}`);
```

## Advanced Configuration

### Custom Source Structure

By default, batch extraction expects rsnapshot structure (`daily.0/pi-scsi2/...`). You can specify a custom source:

```bash
akai-extract batch --source ~/my-backups
```

The extractor will look for:
- `~/my-backups/daily.0/pi-scsi2/*.hds` for S5K
- `~/my-backups/daily.0/s3k/*.hds` for S3K

### Sampler Type Mapping

Default mapping (configurable in code):
- `s5k` → `pi-scsi2` backup directory
- `s3k` → `s3k` backup directory

## Conversion Details

### SFZ Conversion

Converts Akai programs to SFZ format:
- Sample references (relative paths)
- Zone mapping (key ranges, velocity layers)
- Loop points (sustain loops, release loops)
- ADSR envelopes
- Filter settings
- LFO modulation

### DecentSampler Conversion

Converts Akai programs to DecentSampler preset format:
- Sample mapping
- Group structure
- ADSR envelopes
- UI layout (automatic generation)

## Requirements

- **Node.js** >= 18
- Sufficient disk space for extracted samples
- Optional: `@oletizi/sampler-backup` for rsnapshot integration

## Troubleshooting

**"No disk images found":**
```bash
# Check source directory structure
ls -R ~/.audiotools/backup/daily.0/

# Verify expected structure
# Should see: daily.0/pi-scsi2/home/orion/images/*.hds
```

**"Extraction failed":**
- Verify disk image is readable: `file disk.hds`
- Check disk image is valid Akai format
- Ensure output directory is writable

**Timestamp detection not working:**
- macOS: Uses mtime from `stat`
- Ensure filesystem supports modification times
- Use `--force` to override timestamp checks

## License

Apache-2.0
