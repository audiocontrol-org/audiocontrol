## Troubleshooting

### Issue: "Cannot find module '@oletizi/sampler-lib'"

**Solution**: Ensure the package is installed and you're using the correct import path:

```bash
pnpm install @oletizi/sampler-lib
```

### Issue: Sample conversion produces distorted audio

**Solution**: Check the sample format and apply conversions in the correct order:

```typescript
// Correct order
sample.to16Bit().to441().cleanup();

// Check source format first
const metadata = sample.getMetadata();
console.log(`Source: ${metadata.bitDepth}-bit, ${metadata.sampleRate}Hz`);
```

### Issue: MIDI note parsing returns NaN

**Solution**: Ensure the note string follows scientific pitch notation (letter + optional sharp/flat + octave):

```typescript
// Valid formats
parseNote('C4');   // ✓
parseNote('A#3');  // ✓
parseNote('Bb2');  // ✓

// Invalid formats
parseNote('C');    // ✗ (missing octave)
parseNote('H4');   // ✗ (invalid note letter)
```

### Issue: Binary conversion gives unexpected results

**Solution**: Check endianness - Akai formats typically use big-endian:

```typescript
// For Akai data, usually use big-endian
const value = bytes2numberBE([0x12, 0x34]);

// Some fields may be little-endian
const value2 = bytes2numberLE([0x12, 0x34]);
```

### Issue: Configuration files not found

**Solution**: The library looks for config in `~/.audiotools` by default. Create the directory or specify a custom path:

```typescript
import { mkdir } from '@oletizi/sampler-lib';
import { homedir } from 'os';
import { join } from 'path';

const dataDir = join(homedir(), '.audiotools');
await mkdir(dataDir);

// Or use custom directory
const config = await loadClientConfig('/custom/path');
```

### Issue: Sample metadata missing or incorrect

**Solution**: Some WAV files may not have proper SMPL chunk. Check metadata existence:

```typescript
const metadata = sample.getMetadata();

if (metadata.rootNote === undefined) {
  console.log('No root note in WAV file, using default');
  sample.setRootNote(60); // Middle C
}
```

## TypeScript Configuration

This package uses strict TypeScript configuration:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

All public APIs are fully typed. Import types directly from the package:

```typescript
import type {
  Sample,
  SampleMetadata,
  AkaiDisk,
  ProcessOutput
} from '@oletizi/sampler-lib';
```

## Contributing
