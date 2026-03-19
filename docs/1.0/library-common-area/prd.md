# Library Common Area - Product Requirements Document

**Created:** 2026-03-18
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

Every piece of audio in the audiocontrol library is device-bound. `ToneYamlSchema` requires `device: DeviceType` and enforces that the matching device extension block is present via a `.refine()` validator (`tone-schema.ts:131-145`). Importing a WAV requires choosing a target device upfront and providing device-specific parameters before storage.

The common area partially exists: `library/common/samples/` stores chopped samples using `ChoppedSampleSchema`. But there is no general-purpose, device-agnostic abstraction for audio content. A user cannot import a WAV and store it in the library without binding it to a device. And the existing chopped sample format conflates two concerns: the audio data (a WAV file with intrinsic properties) and the musical structure (slices, key mappings, trigger behavior).

## Design Principles

The common area must be **vendor- and device-agnostic**. No Roland terminology ("tones", "patches"), no device-specific constraints. The vocabulary and abstractions should be drawn from general sampler concepts, informed by the [SFZ specification](https://sfzformat.com/headers/) hierarchy:

| SFZ concept | Common area equivalent | What it represents |
|---|---|---|
| Sample file | **Sample** | A WAV file + intrinsic audio properties (sample rate, loop points, root key) |
| Region / Group | **Program** | A collection of zones that map samples to key ranges, velocity layers, and triggers — describes how samples are played together as an instrument |

This two-level abstraction cleanly separates "what the audio is" from "how it's played."

## User Stories

### Import and Organize

- As a user, I want to import a WAV file to the common area without choosing a target device so that I can build a sample library independently of any specific sampler.
- As a user, I want to browse and preview common-area samples alongside device-specific content in the library tree so that all my audio content is accessible from one place.
- As a user, I want to organize common-area samples and programs into folders.

### Edit

- As a user, I want to edit common-area samples with device-agnostic workflows (trim, normalize, loop, chop) so that I can prepare audio before deciding which device will use it.

### Programs

- As a user, I want to create a program that maps multiple samples across a keyboard range so that I can build instruments (drum kits, velocity layers, splits) without committing to a device.
- As a user, I want the sample chopper to produce a program (not a separate format) so that chopped audio uses the same abstraction as everything else in the common area.

### Promote and Demote

- As a user, I want to promote a common-area sample to a device tone so that when I'm ready to use it on a specific sampler, I can add the required device-specific parameters.
- As a user, I want to promote a common-area program to a device patch so that a drum kit or velocity-layer instrument can be loaded onto a device.
- As a user, I want to demote a device tone to the common area so that I can strip device-specific parameters and keep the audio for reuse.

## Success Criteria

- [ ] A `SampleYamlSchema` is defined — device-agnostic, replaces the audio-description half of `ChoppedSampleSchema`
- [ ] A `ProgramYamlSchema` is defined — device-agnostic, replaces the musical-structure half of `ChoppedSampleSchema`
- [ ] Both schemas are stored under `library/common/samples/` (flat YAML+WAV for samples, directory bundles for programs)
- [ ] Common-area content appears in a dedicated section of `LibraryTreePanel`
- [ ] Users can import a WAV file directly to the common area
- [ ] Users can preview common-area samples (metadata + waveform)
- [ ] `PromotionConverter` interface exists with S-330 and S-550 implementations
- [ ] Users can promote a sample to a device tone and a program to a device patch
- [ ] All new schemas and converters have unit tests with 80%+ coverage
- [ ] Existing `ChoppedSampleSchema` consumers are migrated to the new schemas

## Scope

### In Scope

- **Sample schema** (`SampleYamlSchema`): device-agnostic audio metadata
- **Program schema** (`ProgramYamlSchema`): device-agnostic instrument mapping (zones, key ranges, velocity layers, playback config)
- **Storage layout**: unified under `library/common/samples/`
- **Scanner integration**: detectors for both schemas, tree listing functions
- **Library tree UI**: new "Samples" section in `LibraryTreePanel` showing both samples and programs
- **Preview**: metadata + waveform for samples, zone map for programs
- **WAV import**: import to common area without device selection
- **Promotion/demotion**: sample → device tone, program → device patch, and reverse
- **Migration path**: update `ChoppedSampleSchema` consumers to use new schemas

### Out of Scope

- **Full SFZ implementation** — we borrow the hierarchical concepts (sample → region → group) but do not implement the SFZ file format or its opcode system
- **Editing workflows** — the `edit-workflow-architecture` feature defines workflow patterns; specific editors for common-area content are Phase 2
- **Batch operations** — batch import, batch promote/demote are future enhancements
- **Cloud sync** — all storage is local via FSAA
- **Promotion converters beyond S-330/S-550** — added when those editor tracks begin

## Architecture

### Key Design Decision: Two New Schemas, Not Modified Existing Ones

**Why not add `'common'` to `DeviceType`?** `ToneYamlSchema` has a `.refine()` (`tone-schema.ts:131-145`) that enforces the device extension block matches the device discriminator. Adding `'common'` would require exempting it from validation and polluting every consumer that switches on `DeviceType`.

**Why not extend `ChoppedSampleSchema`?** It conflates audio properties (WAV file, sample rate) with musical structure (slices, triggers, playback). Separating these into sample and program gives us clean, composable abstractions — a program *references* samples rather than embedding audio metadata.

**Why two schemas?** The SFZ hierarchy demonstrates that "what the audio is" (sample) and "how it's played" (region/group/instrument) are fundamentally different concerns. Keeping them separate means:
- A sample can exist without being part of any program
- A program can reference multiple samples
- Editing audio (trim, normalize, loop) operates on samples; arranging instruments (key mapping, velocity layers) operates on programs

### `SampleYamlSchema`

A sample is a WAV file + intrinsic audio properties. One YAML + one WAV, stored as a pair in `library/common/samples/`.

```typescript
const SampleYamlSchema = z.object({
  format: z.literal('sample'),
  version: z.literal(1),
  name: z.string().min(1).max(128),
  file: z.string().min(1),                    // WAV filename
  sampleRate: z.number().int().positive(),
  loopMode: LoopModeSchema.optional(),         // oneShot if absent
  loopStart: z.number().int().min(0).optional(),
  loopEnd: z.number().int().min(0).optional(),
  rootKey: MidiNoteSchema.optional(),          // original pitch (SFZ: pitch_keycenter)
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  sourceDevice: DeviceTypeSchema.optional(),   // breadcrumb for demoted tones
  createdAt: z.string().optional(),
  modifiedAt: z.string().optional(),
});
```

Key differences from `BaseWaveParamsSchema` (`common-schema.ts:22-31`):
- `rootKey` — the original pitch of the sample (SFZ `pitch_keycenter`). Not present in `BaseWaveParams` because device tones store this in their device extension (`originalKey` in S-330).
- `loopStart`/`loopEnd` — replaces the single `loopPoint` from `BaseWaveParams` for more precise loop region definition.
- No `device` field — this is the whole point.

### `ProgramYamlSchema`

A program is an instrument definition: a collection of zones that map samples to performance parameters. Stored as a directory bundle (`program.yaml` + referenced sample WAVs or sample references).

```typescript
const ZoneSchema = z.object({
  sample: z.string().min(1),                   // sample name or path reference
  keyRange: KeyRangeSchema.optional(),         // [low, high] MIDI notes
  velocityRange: VelocityRangeSchema.optional(), // [low, high]
  rootKey: MidiNoteSchema.optional(),          // override sample's rootKey for this zone
  transpose: z.number().int().min(-64).max(63).optional(),
  fineTune: z.number().int().min(-64).max(63).optional(),
  muteGroup: z.number().int().min(0).optional(), // 0 = none, same non-zero group chokes
  label: z.string().optional(),                // human-readable name ("kick", "snare")
});

const ProgramYamlSchema = z.object({
  format: z.literal('program'),
  version: z.literal(1),
  name: z.string().min(1).max(128),
  zones: z.array(ZoneSchema).min(1),
  polyphony: PolyphonyModeSchema.optional(),   // mono | poly
  playbackMode: PlaybackModeSchema.optional(), // one-shot | gate
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().optional(),
  modifiedAt: z.string().optional(),
});
```

A zone maps directly to the SFZ `<region>` concept: one sample + the conditions under which it plays. The program itself is analogous to SFZ `<group>` — shared playback settings across all zones.

### Storage Layout

```
library/
  common/
    samples/
      my-kick.yaml           # SampleYaml — individual sample
      my-kick.wav
      drums/                  # organizational folder
        snare-01.yaml
        snare-01.wav
      my-drum-kit/            # ProgramYaml — program bundle
        program.yaml
        kick.wav
        snare.wav
        hihat.wav
  s330/
    tones/                    # device-bound (ToneYaml)
    patches/                  # device-bound (PatchYaml)
    ...
```

Samples are YAML+WAV pairs (like device tones). Programs are directory bundles containing `program.yaml` + audio files (like the existing chopped sample pattern with `manifest.yaml`).

The scanner distinguishes them: a `.yaml` file with `format: 'sample'` is a sample; a directory containing `program.yaml` with `format: 'program'` is a program.

### Migration from `ChoppedSampleSchema`

The existing `ChoppedSampleSchema` maps cleanly to the new model:

| ChoppedSample field | New location |
|---|---|
| `source`, `sampleRate` | `SampleYaml.file`, `SampleYaml.sampleRate` |
| `slices` | `ProgramYaml.zones` (each slice becomes a zone with a key range derived from `baseNote + index`) |
| `triggers` | `ProgramYaml.zones[].keyRange` (trigger mappings become zone key assignments) |
| `playback.polyphony` | `ProgramYaml.polyphony` |
| `playback.playbackMode` | `ProgramYaml.playbackMode` |
| `playback.muteGroups` | `ProgramYaml.zones[].muteGroup` (per-zone, not per-index array) |
| `drumKit.baseNote` | First zone's `keyRange[0]`, or computed from `rootKey + transpose` |

The sample chopper's output changes from producing a `ChoppedSample` to producing a `Program` + one or more `Sample` files.

### Promotion and Demotion

```typescript
interface SamplePromotionConverter<TDefaults> {
  promote(sample: SampleYaml, defaults: TDefaults): ToneYaml;
  demote(tone: ToneYaml): SampleYaml;
}

interface ProgramPromotionConverter<TDefaults> {
  promote(program: ProgramYaml, defaults: TDefaults): PatchYaml;
  demote(patch: PatchYaml): ProgramYaml;
}
```

**Sample → Tone** (S-330): requires `originalKey` (MIDI note 11-108). Maps `SampleYaml.rootKey` as a default if present. Name truncated to 12 chars at promotion time.

**Program → Patch** (S-330): each zone becomes a key group. Requires zone-level `originalKey` assignments. The promotion UI presents a form for device-specific parameters that don't have sensible defaults.

**Demotion** strips device extensions, sets `sourceDevice` breadcrumb, relaxes name constraints.

Copy semantics on promote/demote — common and device libraries stay independent.

### UI Integration

**LibraryTreePanel** gets a new "Samples" section (replacing the current "Samples" section that only shows chopped samples). This section shows both individual samples and programs from `library/common/samples/`.

**Preview panel**: samples show metadata + waveform; programs show zone map (key range visualization) + zone list.

## Dependencies

- **`edit-workflow-architecture`** (complete) — environment capability interfaces for file I/O

### Existing Assets

- **`ChoppedSampleSchema`** (`chopped-sample-schema.ts`) — existing device-agnostic format being superseded
- **`BaseWaveParamsSchema`** (`common-schema.ts:22-31`) — informs `SampleYaml` field design
- **`library-fs.ts`** — generic scanner infrastructure (`scanLibraryDirectory`, `ItemDetector`)
- **`LibraryTreePanel.tsx`** — existing "Samples" section for chopped samples (will be replaced)
- **`KeyRangeSchema`, `VelocityRangeSchema`** (`common-schema.ts:95-112`) — reused in `ZoneSchema`
- **`MidiNoteSchema`** (`common-schema.ts:87-90`) — reused for `rootKey`

## Open Questions

- [ ] **Should programs reference samples by name or embed them?** Propose: by filename within the program bundle directory. This keeps programs self-contained (portable as a directory) while avoiding data duplication within the bundle.
- [ ] **Should samples support multiple WAV files?** Propose: no, one WAV per sample. Multi-file instruments are programs.
- [ ] **How does `loopEnd` interact with existing `loopPoint`?** `BaseWaveParams` has `loopPoint` (a single offset). The new `SampleYaml` has `loopStart`/`loopEnd` for a full loop region. On promotion, these map to device-specific loop parameters. On demotion, device loop params map back.
- [ ] **Migration timeline for `ChoppedSampleSchema`?** Propose: keep both schemas working during the transition. The scanner detects both `format: 'chopped-sample'` and `format: 'program'`. Migration converters translate between them. Old format deprecated but readable.
- [ ] **Tags taxonomy?** Propose: freeform strings. Controlled vocabulary later if needed.

## Appendix

### SFZ Concept Mapping

| SFZ | audiocontrol common area | audiocontrol device-bound |
|---|---|---|
| Sample file | `SampleYaml` | WAV in device tone directory |
| `<region>` | `Zone` (within `ProgramYaml`) | Key group (within device patch) |
| `<group>` | `ProgramYaml` | Device patch |
| `<global>` | Not needed (single-program scope) | Not needed |
| `pitch_keycenter` | `SampleYaml.rootKey` or `Zone.rootKey` | `S330ToneExtension.originalKey` |
| `lokey`/`hikey` | `Zone.keyRange` | Key group key range |
| `lovel`/`hivel` | `Zone.velocityRange` | Key group velocity range |
| `group`/`off_by` | `Zone.muteGroup` | Patch-level mute groups |

### Schema Comparison

| Field | `SampleYaml` | `ProgramYaml` | `ToneYaml` (device) | `ChoppedSample` (deprecated) |
|---|---|---|---|---|
| `format` | `'sample'` | `'program'` | `'sampler-tone'` | `'chopped-sample'` |
| `device` | absent | absent | required | absent |
| `name` max | 128 | 128 | 12 | 128 |
| Audio ref | `file` (WAV) | zones reference samples | `wave.file` | `source` |
| Zones/regions | n/a | `zones[]` | n/a | `slices[]` |
| Key mapping | n/a | `zone.keyRange` | via device patch | via `triggers` |
| Loop | `loopMode`, `loopStart`, `loopEnd` | n/a (per-sample) | `wave.loopMode`, `wave.loopPoint` | n/a |
| Root key | `rootKey` | `zone.rootKey` (override) | `s330.originalKey` | `drumKit.baseNote` |
