## Examples

### Example 1: Convert Multi-Sampled Instrument

```typescript
import {
  newDefaultTranslateContext,
  map,
  mapLogicAutoSampler
} from '@audiocontrol/sampler-translate';

async function convertInstrument() {
  const ctx = await newDefaultTranslateContext();

  const result = await map(ctx, mapLogicAutoSampler, {
    source: '/path/to/Piano-Samples',  // Contains Piano-C3.aiff, Piano-D3.aiff, etc.
    target: '/path/to/S3K-Output',
    partition: 1,
    prefix: 'PIANO',
    wipeDisk: false
  });

  if (result.errors.length > 0) {
    console.error('Conversion failed:', result.errors);
    return;
  }

  console.log('Successfully created S3K program: PIANO.a3p');
}

convertInstrument();
```

### Example 2: Chop Breakbeat

```typescript
import { chop } from '@audiocontrol/sampler-translate';
import { newServerConfig } from '@audiocontrol/sampler-lib';
import { newAkaitools, newAkaiToolsConfig } from '@audiocontrol/sampler-devices/s3k';

async function chopBreak() {
  const config = await newServerConfig();
  const tools = newAkaitools(await newAkaiToolsConfig());

  // Chop 4-bar breakbeat at 120 BPM into 1-beat slices
  // At 44.1kHz: 120 BPM = 2 beats/sec = 0.5 sec/beat = 22050 samples/beat
  const result = await chop(config, tools, {
    source: '/path/to/breakbeat.wav',
    target: '/path/to/chopped-output',
    partition: 1,
    prefix: 'BREAK',
    wipeDisk: false,
    samplesPerBeat: 22050,  // 120 BPM at 44.1kHz
    beatsPerChop: 1         // 1-beat slices
  });

  if (result.errors.length === 0) {
    console.log('Breakbeat chopped successfully!');
  }
}

chopBreak();
```

### Example 3: Convert DecentSampler with Progress Tracking

```typescript
import { decent2Sxk, Progress } from '@audiocontrol/sampler-translate';

// Custom progress tracker
const progress: Progress = {
  total: 0,
  completed: 0,
  incrementTotal(n: number) {
    this.total += n;
  },
  incrementCompleted(n: number) {
    this.completed += n;
    console.log(`Progress: ${this.completed}/${this.total}`);
  },
  setCompleted(n: number) {
    this.completed = n;
  }
};

async function convertWithProgress() {
  const result = await decent2Sxk(
    '/path/to/strings.dspreset',
    '/path/to/output',
    process.stdout,
    progress
  );

  console.log(`Conversion complete: ${result.data.length} programs created`);
  if (result.errors.length > 0) {
    console.error('Errors:', result.errors);
  }
}

convertWithProgress();
```

### Example 4: Custom Velocity Layer Mapping

```typescript
import {
  newDefaultTranslateContext,
  map,
  MapFunction,
  AudioSource,
  AbstractKeygroup
} from '@audiocontrol/sampler-translate';

// Custom mapper for velocity layers
// Expects filenames like: Piano-C3-pp.aiff, Piano-C3-mf.aiff, Piano-C3-ff.aiff
const velocityLayerMapper: MapFunction = (sources: AudioSource[]) => {
  const keygroups: AbstractKeygroup[] = [];
  const noteMap = new Map<number, AudioSource[]>();

  // Group by note
  for (const source of sources) {
    const match = source.filepath.match(/-([A-G][#b]*[0-9])-/);
    if (match) {
      const noteNumber = parseNote(match[1]);
      if (!noteMap.has(noteNumber)) {
        noteMap.set(noteNumber, []);
      }
      noteMap.get(noteNumber)!.push(source);
    }
  }

  // Create keygroups with velocity layers
  for (const [note, layers] of noteMap) {
    const velocityRanges = [
      { low: 0, high: 42 },   // pp
      { low: 43, high: 84 },  // mf
      { low: 85, high: 127 }  // ff
    ];

    keygroups.push({
      zones: layers.slice(0, 3).map((layer, i) => ({
        audioSource: layer,
        lowNote: note,
        centerNote: note,
        highNote: note,
        lowVelocity: velocityRanges[i].low,
        highVelocity: velocityRanges[i].high
      }))
    });
  }

  return keygroups;
};

async function convertVelocityLayers() {
  const ctx = await newDefaultTranslateContext();

  const result = await map(ctx, velocityLayerMapper, {
    source: '/path/to/velocity-samples',
    target: '/path/to/output',
    partition: 1,
    prefix: 'VELPNO',
    wipeDisk: false
  });

  console.log('Velocity-layered program created');
}
```

## Format Support
