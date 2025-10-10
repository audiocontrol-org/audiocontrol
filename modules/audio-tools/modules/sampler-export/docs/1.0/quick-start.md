# Quick Start - sampler-export v1.0

## Extract a Single Disk Image

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

## Batch Extract Multiple Disks

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

## Convert Programs Directly

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

## Output Structure

```
outputDir/
  {diskName}/
    raw/         # Extracted raw files (.a3p, .akp, .a3s)
    wav/         # Converted WAV samples
    sfz/         # SFZ instrument files
    decentsampler/ # DecentSampler preset files
```

## Next Steps

- [Full API Reference](./api-reference.md)
- [Detailed Examples](./examples.md)
- [Configuration Guide](./configuration.md)
- [Troubleshooting](./troubleshooting.md)
