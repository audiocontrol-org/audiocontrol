## Examples

### Example 1: Convert Sample to 16-bit 44.1kHz

```typescript
import { newSampleFromBuffer } from '@oletizi/sampler-lib';
import { readFile, writeFile } from 'fs/promises';

async function convertSample(inputPath: string, outputPath: string) {
  const buffer = await readFile(inputPath);
  const sample = newSampleFromBuffer(new Uint8Array(buffer));

  const converted = sample
    .to16Bit()
    .to441()
    .cleanup();

  const outputBuffer = Buffer.alloc(converted.getRawData().length);
  converted.write(outputBuffer, 0);
  await writeFile(outputPath, outputBuffer);
}
```

### Example 2: Parse Akai Disk Structure

```typescript
import { AkaiDisk, AkaiRecordType } from '@oletizi/sampler-lib';

function findSamples(disk: AkaiDisk): string[] {
  const samples: string[] = [];

  for (const partition of disk.partitions) {
    for (const volume of partition.volumes) {
      for (const record of volume.records) {
        if (record.type === AkaiRecordType.SAMPLE) {
          samples.push(record.name);
        }
      }
    }
  }

  return samples;
}
```

### Example 3: MIDI Note Conversion

```typescript
import { parseNote, C3 } from '@oletizi/sampler-lib';

function transposeNote(noteString: string, semitones: number): number {
  const midiNote = parseNote(noteString);
  return midiNote + semitones;
}

console.log(transposeNote('C4', 7)); // 79 (G4)
console.log(transposeNote('A3', -12)); // 57 (A2)
```

### Example 4: Custom Process Output

```typescript
import { newStreamOutput, ProcessOutput } from '@oletizi/sampler-lib';

// Create custom output handler
const output: ProcessOutput = newStreamOutput(
  process.stdout,
  process.stderr,
  true,  // debug enabled
  'MyApp'  // prefix
);

output.log('Processing started');
output.write('Processing data...\n');
output.error(new Error('Something went wrong'));
```

### Example 5: Binary Data Processing

```typescript
import { bytes2numberLE, nibbles2byte } from '@oletizi/sampler-lib';

// Parse Akai sample header (example)
function parseSampleHeader(buffer: Buffer): { length: number, rootNote: number } {
  // Sample length (4 bytes, little-endian at offset 0)
  const lengthBytes = [buffer[0], buffer[1], buffer[2], buffer[3]];
  const length = bytes2numberLE(lengthBytes);

  // Root note (1 byte at offset 4)
  const rootNote = buffer[4];

  return { length, rootNote };
}
```

## Relationship to Other Packages
