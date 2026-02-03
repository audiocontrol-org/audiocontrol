## Examples

### Example 1: Extract Single Disk with Error Handling

```typescript
import { extractAkaiDisk } from '@audiocontrol/sampler-export';

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
import { extractBatch } from '@audiocontrol/sampler-export';
import type { DiskExtractionStatus } from '@audiocontrol/sampler-export';

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
} from '@audiocontrol/sampler-export';

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
import { getMcopyBinary, isMcopyAvailable } from '@audiocontrol/sampler-export';

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
import { isDosDisk, extractDosDisk } from '@audiocontrol/sampler-export';

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

