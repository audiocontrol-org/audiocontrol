# Sampler Library System - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD

## Technical Approach

Create a device-agnostic sampler library system that stores tone/patch data as human-readable YAML files alongside WAV audio data. The system uses a registry pattern for device-specific converters, allowing the same library infrastructure to support multiple sampler types.

**Key design decisions:**

1. **Device-agnostic core**: Common interfaces and storage logic
2. **Device-specific extensions**: Converters registered per device type
3. **Filesystem storage**: Local `~/.audiotools/library/{device}/` structure
4. **Zod validation**: All YAML files validated against typed schemas

## Module Structure

```
modules/sampler-library/
├── src/
│   ├── index.ts                      # Public exports
│   ├── types/
│   │   ├── common.ts                 # Device-agnostic types
│   │   └── index.ts
│   ├── schemas/
│   │   ├── common-schema.ts          # Base Zod schemas
│   │   ├── tone-schema.ts            # Tone YAML schema
│   │   ├── patch-schema.ts           # Patch YAML schema
│   │   ├── template-schema.ts        # Template YAML schema
│   │   └── index.ts
│   ├── converters/
│   │   ├── converter-registry.ts     # Device converter registry
│   │   ├── s330/
│   │   │   ├── tone-converter.ts     # S330Tone ↔ YAML
│   │   │   ├── patch-converter.ts    # S330Patch ↔ YAML
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── storage/
│   │   ├── library-paths.ts          # Path resolution
│   │   ├── file-storage.ts           # Read/write operations
│   │   └── index.ts
│   └── templates/
│       ├── template-engine.ts        # Template processing
│       ├── drum-kit.ts               # Drum kit generator
│       ├── velocity-layer.ts         # Velocity layer generator
│       └── index.ts
├── test/
│   ├── unit/
│   │   ├── schemas/
│   │   ├── converters/
│   │   ├── storage/
│   │   └── templates/
│   └── fixtures/
│       └── yaml/                     # Test YAML files
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Implementation Phases

### Phase 1: Core Module Setup

Create the sampler-library module with base configuration.

**Files to create:**
- `modules/sampler-library/package.json`
- `modules/sampler-library/tsconfig.json`
- `modules/sampler-library/vitest.config.ts`
- `modules/sampler-library/src/index.ts`
- `modules/sampler-library/src/types/common.ts`
- `modules/sampler-library/src/types/index.ts`

**Success criteria:**
- `pnpm install` succeeds
- `pnpm --filter @audiocontrol/sampler-library build` succeeds

### Phase 2: Zod Schemas

Define validated schemas for library YAML files.

**Files to create:**
- `modules/sampler-library/src/schemas/common-schema.ts`
- `modules/sampler-library/src/schemas/tone-schema.ts`
- `modules/sampler-library/src/schemas/patch-schema.ts`
- `modules/sampler-library/src/schemas/template-schema.ts`
- `modules/sampler-library/src/schemas/index.ts`

**Tone Schema:**
```typescript
import { z } from 'zod';

// Common envelope schema (device-agnostic)
const EnvelopeSchema = z.object({
  levels: z.array(z.number().min(0).max(127)),
  rates: z.array(z.number().min(0).max(127)),
  sustainPoint: z.number().min(0).optional(),
  endPoint: z.number().min(1).optional(),
});

// Base tone schema (all devices)
const BaseToneSchema = z.object({
  format: z.literal('sampler-tone'),
  device: z.string(),
  version: z.number(),
  name: z.string(),
  wave: z.object({
    file: z.string(),
    sampleRate: z.number(),
    loopMode: z.enum(['oneShot', 'forward', 'alternating', 'reverse']),
    loopPoint: z.number().min(0).optional(),
  }),
});

// S-330 specific extension
const S330ToneExtensionSchema = z.object({
  originalKey: z.number().min(0).max(127),
  outputAssign: z.number().min(0).max(7),
  transpose: z.number().min(0).max(127).default(64),
  fineTune: z.number().min(-64).max(63).default(0),
  lfo: z.object({
    rate: z.number().min(0).max(127),
    delay: z.number().min(0).max(127),
    sync: z.boolean(),
    mode: z.enum(['normal', 'one-shot']),
  }).optional(),
  tvf: z.object({
    cutoff: z.number().min(0).max(127),
    resonance: z.number().min(0).max(127),
    keyFollow: z.number().min(0).max(127),
    egDepth: z.number().min(0).max(127),
    egPolarity: z.enum(['normal', 'reverse']),
    enabled: z.boolean(),
    envelope: EnvelopeSchema.optional(),
  }).optional(),
  tva: z.object({
    level: z.number().min(0).max(127),
    keyRate: z.number().min(0).max(127),
    velRate: z.number().min(0).max(127),
    levelCurve: z.number().min(0).max(5),
    envelope: EnvelopeSchema,
  }).optional(),
});

// Combined schema with device discriminator
export const ToneYamlSchema = BaseToneSchema.extend({
  s330: S330ToneExtensionSchema.optional(),
  // Future: jv1080: JV1080ToneExtensionSchema.optional(),
});

export type ToneYaml = z.infer<typeof ToneYamlSchema>;
```

**Success criteria:**
- Schema validation tests pass for valid/invalid YAML
- Type inference works correctly

### Phase 3: S-330 Converters

Implement bidirectional conversion between S330Tone/S330Patch and YAML.

**Files to create:**
- `modules/sampler-library/src/converters/converter-registry.ts`
- `modules/sampler-library/src/converters/s330/tone-converter.ts`
- `modules/sampler-library/src/converters/s330/patch-converter.ts`
- `modules/sampler-library/src/converters/s330/index.ts`
- `modules/sampler-library/src/converters/index.ts`

**Converter interface:**
```typescript
export interface ToneConverter<T> {
  readonly deviceType: string;
  toYaml(tone: T, wavFilename: string): ToneYaml;
  fromYaml(yaml: ToneYaml): T;
}

export interface PatchConverter<T> {
  readonly deviceType: string;
  toYaml(patch: T): PatchYaml;
  fromYaml(yaml: PatchYaml): T;
}

// Registry
export class ConverterRegistry {
  private toneConverters = new Map<string, ToneConverter<unknown>>();
  private patchConverters = new Map<string, PatchConverter<unknown>>();

  registerToneConverter<T>(converter: ToneConverter<T>): void {
    this.toneConverters.set(converter.deviceType, converter);
  }

  getToneConverter(deviceType: string): ToneConverter<unknown> | undefined {
    return this.toneConverters.get(deviceType);
  }
}
```

**Success criteria:**
- Round-trip conversion: `S330Tone → YAML → S330Tone` preserves all fields
- Unit tests achieve 80%+ coverage

### Phase 4: File Storage

Implement filesystem operations for library management.

**Files to create:**
- `modules/sampler-library/src/storage/library-paths.ts`
- `modules/sampler-library/src/storage/file-storage.ts`
- `modules/sampler-library/src/storage/index.ts`

**Path resolution:**
```typescript
import { homedir } from 'os';
import { join } from 'path';

export function getLibraryRoot(): string {
  return join(homedir(), '.audiotools', 'library');
}

export function getDeviceLibraryPath(device: string): string {
  return join(getLibraryRoot(), device);
}

export function getTonePath(device: string, toneName: string): string {
  return join(getDeviceLibraryPath(device), 'tones', `${toneName}.yaml`);
}

export function getToneWavePath(device: string, toneName: string): string {
  return join(getDeviceLibraryPath(device), 'tones', `${toneName}.wav`);
}

export function getPatchPath(device: string, patchName: string): string {
  return join(getDeviceLibraryPath(device), 'patches', `${patchName}.yaml`);
}

export function getTemplatePath(device: string, templateName: string): string {
  return join(getDeviceLibraryPath(device), 'templates', `${templateName}.yaml`);
}
```

**File storage interface:**
```typescript
export interface LibraryStorage {
  // Tone operations
  saveTone(device: string, name: string, yaml: ToneYaml, wavData: Uint8Array): Promise<void>;
  loadTone(device: string, name: string): Promise<{ yaml: ToneYaml; wavPath: string }>;
  listTones(device: string): Promise<string[]>;
  deleteTone(device: string, name: string): Promise<void>;

  // Patch operations
  savePatch(device: string, name: string, yaml: PatchYaml): Promise<void>;
  loadPatch(device: string, name: string): Promise<PatchYaml>;
  listPatches(device: string): Promise<string[]>;
  deletePatch(device: string, name: string): Promise<void>;

  // Template operations
  loadTemplate(device: string, name: string): Promise<TemplateYaml>;
  listTemplates(device: string): Promise<string[]>;
}
```

**Success criteria:**
- Tones save with .yaml and .wav files
- Load operations validate YAML against schema
- List operations return correct filenames

### Phase 5: Template Engine

Implement template processing for drum kits and velocity layers.

**Files to create:**
- `modules/sampler-library/src/templates/template-engine.ts`
- `modules/sampler-library/src/templates/drum-kit.ts`
- `modules/sampler-library/src/templates/velocity-layer.ts`
- `modules/sampler-library/src/templates/index.ts`

**Template schema:**
```yaml
# drum-kit.yaml
format: sampler-template
device: s330
version: 1
type: drum-kit

name: "808 Drum Kit"
description: "Classic 808-style drum kit layout"

kit:
  - name: Kick
    key: C2                # MIDI note 36
    tone: kick_808         # Reference to library tone

  - name: Snare
    key: D2                # MIDI note 38
    tone: snare_808

  - name: Closed Hi-Hat
    key: F#2               # MIDI note 42
    tone: hihat_closed_808
    muteGroup: 1           # Chokes open hi-hat

  - name: Open Hi-Hat
    key: A#2               # MIDI note 46
    tone: hihat_open_808
    muteGroup: 1
```

```yaml
# velocity-layer.yaml
format: sampler-template
device: s330
version: 1
type: velocity-layer

name: "Piano Multi-Layer"
description: "4-layer velocity-switched piano"

keyRange: [36, 96]         # C2 to C7
velocityLayers:
  - range: [1, 31]
    tone: piano_pp
  - range: [32, 63]
    tone: piano_p
  - range: [64, 95]
    tone: piano_mf
  - range: [96, 127]
    tone: piano_ff
```

**Template engine interface:**
```typescript
export interface TemplateResult<TPatch, TTone> {
  patches: TPatch[];
  tones: TTone[];
}

export interface TemplateEngine<TPatch, TTone> {
  applyDrumKit(
    template: DrumKitTemplate,
    libraryTones: Map<string, ToneYaml>
  ): TemplateResult<TPatch, TTone>;

  applyVelocityLayer(
    template: VelocityLayerTemplate,
    libraryTones: Map<string, ToneYaml>
  ): TemplateResult<TPatch, TTone>;
}
```

**Success criteria:**
- Drum kit template generates correct S330Patch with key mappings
- Velocity layer template generates correct velocity thresholds
- Templates fail gracefully when referenced tones are missing

### Phase 6: Editor UI Integration

Add library export/import functionality to s330-editor.

**Files to create:**
- `modules/s330-editor/src/stores/library-store.ts`
- `modules/s330-editor/src/components/library/LibraryBrowser.tsx`
- `modules/s330-editor/src/components/library/ExportToneDialog.tsx`
- `modules/s330-editor/src/components/library/ImportToneDialog.tsx`
- `modules/s330-editor/src/components/library/TemplateApplyDialog.tsx`
- `modules/s330-editor/src/components/library/index.ts`

**Files to modify:**
- `modules/s330-editor/package.json` - Add sampler-library dependency
- `modules/s330-editor/src/App.tsx` - Add LibraryBrowser panel
- `modules/s330-editor/src/components/tones/ToneEditor.tsx` - Add "Export to Library" button

**Library store:**
```typescript
import { create } from 'zustand';
import type { ToneYaml, PatchYaml, TemplateYaml } from '@audiocontrol/sampler-library';

interface LibraryState {
  // State
  tones: Map<string, ToneYaml>;
  patches: Map<string, PatchYaml>;
  templates: Map<string, TemplateYaml>;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadLibrary: () => Promise<void>;
  exportTone: (toneIndex: number, name: string) => Promise<void>;
  importTone: (toneName: string, targetIndex: number) => Promise<void>;
  exportPatch: (patchIndex: number, name: string) => Promise<void>;
  importPatch: (patchName: string, targetIndex: number) => Promise<void>;
  applyTemplate: (templateName: string) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  tones: new Map(),
  patches: new Map(),
  templates: new Map(),
  isLoading: false,
  error: null,

  loadLibrary: async () => {
    set({ isLoading: true, error: null });
    try {
      // Load library contents from filesystem
      // ...
      set({ isLoading: false });
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  exportTone: async (toneIndex: number, name: string) => {
    // Fetch tone data from device
    // Fetch wave data from device
    // Convert to YAML
    // Save to library
  },

  importTone: async (toneName: string, targetIndex: number) => {
    // Load YAML from library
    // Load WAV from library
    // Convert to device format
    // Upload to device
  },

  // ... other actions
}));
```

**Success criteria:**
- Export dialog saves tone + wave to library
- Import dialog loads tone + wave from library
- Library browser shows all library contents
- Template dialog applies templates to device

### Phase 7: Testing and Documentation

Comprehensive testing and documentation.

**Test files to create:**
- `modules/sampler-library/test/unit/schemas/tone-schema.test.ts`
- `modules/sampler-library/test/unit/schemas/patch-schema.test.ts`
- `modules/sampler-library/test/unit/schemas/template-schema.test.ts`
- `modules/sampler-library/test/unit/converters/s330/tone-converter.test.ts`
- `modules/sampler-library/test/unit/converters/s330/patch-converter.test.ts`
- `modules/sampler-library/test/unit/storage/file-storage.test.ts`
- `modules/sampler-library/test/unit/templates/drum-kit.test.ts`
- `modules/sampler-library/test/unit/templates/velocity-layer.test.ts`

**Success criteria:**
- All tests pass: `pnpm --filter @audiocontrol/sampler-library test`
- Coverage > 80%: `pnpm --filter @audiocontrol/sampler-library test:coverage`
- Build succeeds: `pnpm build`

## Files Summary

### New Files

| File | Purpose |
|------|---------|
| `modules/sampler-library/package.json` | Module package config |
| `modules/sampler-library/tsconfig.json` | TypeScript config |
| `modules/sampler-library/vitest.config.ts` | Vitest config |
| `modules/sampler-library/src/index.ts` | Public exports |
| `modules/sampler-library/src/types/common.ts` | Device-agnostic types |
| `modules/sampler-library/src/schemas/common-schema.ts` | Base Zod schemas |
| `modules/sampler-library/src/schemas/tone-schema.ts` | Tone YAML schema |
| `modules/sampler-library/src/schemas/patch-schema.ts` | Patch YAML schema |
| `modules/sampler-library/src/schemas/template-schema.ts` | Template YAML schema |
| `modules/sampler-library/src/converters/converter-registry.ts` | Device converter registry |
| `modules/sampler-library/src/converters/s330/tone-converter.ts` | S330 tone converter |
| `modules/sampler-library/src/converters/s330/patch-converter.ts` | S330 patch converter |
| `modules/sampler-library/src/storage/library-paths.ts` | Path resolution |
| `modules/sampler-library/src/storage/file-storage.ts` | Filesystem operations |
| `modules/sampler-library/src/templates/template-engine.ts` | Template processing |
| `modules/sampler-library/src/templates/drum-kit.ts` | Drum kit generator |
| `modules/sampler-library/src/templates/velocity-layer.ts` | Velocity layer generator |
| `modules/s330-editor/src/stores/library-store.ts` | Library state management |
| `modules/s330-editor/src/components/library/LibraryBrowser.tsx` | Library UI panel |
| `modules/s330-editor/src/components/library/ExportToneDialog.tsx` | Export dialog |
| `modules/s330-editor/src/components/library/ImportToneDialog.tsx` | Import dialog |
| `modules/s330-editor/src/components/library/TemplateApplyDialog.tsx` | Template UI |

### Modified Files

| File | Changes |
|------|---------|
| `modules/s330-editor/package.json` | Add sampler-library dependency |
| `modules/s330-editor/src/App.tsx` | Add LibraryBrowser panel |
| `modules/s330-editor/src/components/tones/ToneEditor.tsx` | Add "Export to Library" button |

## Verification

1. **Unit tests**
   ```bash
   pnpm --filter @audiocontrol/sampler-library test
   ```

2. **Coverage**
   ```bash
   pnpm --filter @audiocontrol/sampler-library test:coverage
   ```

3. **Build check**
   ```bash
   pnpm build
   ```

4. **Manual testing**
   - Export a tone from device to library
   - Verify YAML file is human-readable
   - Edit YAML manually
   - Import modified tone back to device
   - Verify changes took effect
   - Apply drum kit template
   - Verify key mappings are correct
