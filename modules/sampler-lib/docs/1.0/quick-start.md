## Quick Start

### Parsing MIDI Notes

```typescript
import { parseNote, C3 } from '@audiocontrol/sampler-lib';

// Parse string note to MIDI number
const midiNote = parseNote('C4');  // Returns 72
const midiNote2 = parseNote('A#3'); // Returns 70

// Use predefined constants
console.log(C3); // 60 (Middle C)
```

### Working with Binary Data

```typescript
import {
  bytes2numberLE,
  bytes2numberBE,
  byte2nibblesLE,
  nibbles2byte
} from '@audiocontrol/sampler-lib';

// Convert bytes to numbers
const littleEndian = bytes2numberLE([0x12, 0x34]); // 13330
const bigEndian = bytes2numberBE([0x12, 0x34]);    // 4660

// Work with nibbles
const [low, high] = byte2nibblesLE(0xAB); // [11, 10]
const byte = nibbles2byte(11, 10);         // 0xAB
```

### Processing WAV Samples

```typescript
import { newSampleFromBuffer, Sample } from '@audiocontrol/sampler-lib';

// Load sample from buffer
const sample: Sample = newSampleFromBuffer(wavBuffer);

// Get metadata
const metadata = sample.getMetadata();
console.log(`Sample rate: ${metadata.sampleRate}Hz`);
console.log(`Root note: ${metadata.rootNote}`);
console.log(`Channels: ${metadata.channelCount}`);

// Process sample
const processed = sample
  .to16Bit()           // Convert to 16-bit
  .to441()             // Resample to 44.1kHz
  .trim(100, 5000)     // Trim samples
  .cleanup();          // Clean up WAV structure

// Set root note
sample.setRootNote(60); // Middle C
```

### Working with Akai Disk Structures

```typescript
import {
  AkaiDisk,
  AkaiPartition,
  AkaiVolume,
  AkaiRecord,
  AkaiRecordType
} from '@audiocontrol/sampler-lib';

// Work with disk structure
const disk: AkaiDisk = {
  timestamp: Date.now(),
  name: 'My Disk',
  partitions: []
};

// Iterate through records
disk.partitions.forEach((partition: AkaiPartition) => {
  partition.volumes.forEach((volume: AkaiVolume) => {
    volume.records.forEach((record: AkaiRecord) => {
      if (record.type === AkaiRecordType.SAMPLE) {
        console.log(`Sample: ${record.name}`);
      }
    });
  });
});
```

### Scaling and Conversion Utilities

```typescript
import { scale, real2natural, natural2real } from '@audiocontrol/sampler-lib';

// Scale value from one range to another
const scaled = scale(50, 0, 100, 0, 127); // 63.5

// Convert between real and natural ranges
const natural = real2natural(75, 0, 100);  // 75
const real = natural2real(75, 0, 100);     // 75
```

## API Reference
