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
