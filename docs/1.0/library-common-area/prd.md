# Library Common Area - Product Requirements Document

**Created:** 2026-03-18
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

Every sample in the audiocontrol library is device-bound. `ToneYamlSchema` requires `device: DeviceType` and enforces that the matching device extension block is present via a `.refine()` validator (`tone-schema.ts:131-145`). The `name` field is constrained to 12 characters (`tone-schema.ts:121`) -- a device-specific limit inherited from the S-330's display width.

This means importing a WAV file requires the user to choose a target device upfront and provide device-specific parameters (e.g., `originalKey` for S-330) before the sample can be stored. Users who want to build a library of audio content -- trimming, normalizing, loop-editing, chopping -- must commit to a device context before they can even save their work.

The common area partially exists: `library/common/samples/` stores chopped samples produced by the sample chopper, using `ChoppedSampleSchema` with `format: 'chopped-sample'`. But there is no equivalent for individual samples -- a user cannot import a WAV, give it a name and basic wave parameters, and store it in the library without binding it to a device.

## User Stories

### Import and Organize

- As a user, I want to import a WAV file to the common area without choosing a target device so that I can build a sample library independently of any specific sampler.
- As a user, I want to browse and preview common-area samples alongside device-specific content in the library tree so that all my audio content is accessible from one place.
- As a user, I want to organize common-area samples into folders so that I can manage a growing collection.

### Edit

- As a user, I want to edit common-area samples with device-agnostic workflows (trim, normalize, loop, chop) so that I can prepare audio before deciding which device will use it.

### Promote and Demote

- As a user, I want to promote a common-area sample to a device tone so that when I'm ready to use it on a specific sampler, I can add the required device-specific parameters and get a valid device tone.
- As a user, I want to demote a device tone to the common area so that I can strip device-specific parameters and keep the audio and base metadata for reuse across devices.

## Success Criteria

- [ ] A `CommonSampleYamlSchema` is defined and exported from `sampler-library`
- [ ] Common samples are stored in `library/common/tones/` and scanned by the library filesystem layer
- [ ] Common samples appear in a dedicated section of `LibraryTreePanel`
- [ ] Users can import a WAV file directly to the common area without selecting a device
- [ ] Users can preview common-area samples (metadata + waveform display)
- [ ] A `PromotionConverter` interface exists with S-330 and S-550 implementations
- [ ] Users can promote a common sample to a device tone via the UI (providing device-specific defaults)
- [ ] Users can demote a device tone to the common area via the UI
- [ ] All new schemas and converters have unit tests with 80%+ coverage

## Scope

### In Scope

- **Schema:** New `CommonSampleYaml` schema (`format: 'common-sample'`, no `device` field)
- **Storage:** `library/common/tones/` directory layout, path utilities
- **Scanner:** `detectCommonTone` item detector, `listCommonTonesTree()` scanner function
- **Library tree:** New "Common Tones" section in `LibraryTreePanel`
- **Preview:** Metadata display + waveform for common samples
- **WAV import:** Import button, file picker, write YAML + WAV to common area
- **Promotion/demotion:** `PromotionConverter` interface with S-330 and S-550 implementations
- **Promotion UI:** "Promote to [device]" button on common sample preview, parameter form for required device-specific fields; "Demote to Common Area" button on device tone preview

### Out of Scope

- **Common-area patches** -- tones only for this feature. Patches require resolving tone references across the common/device boundary, which is a separate design problem.
- **Editing workflows for common samples** -- the `edit-workflow-architecture` feature defines the workflow pattern; specific workflows (trim, normalize, loop) that operate on common samples are Phase 2 features.
- **Batch operations** -- batch import, batch promote/demote are future enhancements.
- **Cloud sync** -- all storage is local via FSAA.
- **Promotion converters for devices beyond S-330/S-550** -- JV-1080 and D-110 converters will be added when those editor tracks begin.

## Architecture

### Key Design Decision: New Schema, Not Modified `ToneYaml`

Three alternatives were considered for representing device-agnostic samples:

1. **Add `'common'` to `DeviceType`** -- rejected. `ToneYamlSchema` has a `.refine()` (`tone-schema.ts:131-145`) that enforces the device extension block matches the device discriminator. Adding `'common'` would require exempting it from validation and polluting every downstream consumer that switches on `DeviceType`.

2. **Make `device` optional in `ToneYamlSchema`** -- rejected. Breaks existing validation and every consumer that expects `device` to exist. The 12-character name limit (`tone-schema.ts:121`) is also a device constraint that should not apply to common samples.

3. **New `CommonSampleYaml` schema** -- chosen. Follows the exact pattern established by `ChoppedSampleSchema` (`chopped-sample-schema.ts`): a standalone schema with its own `format` discriminator, no `device` field, and a relaxed `name` constraint (`max(128)` instead of `max(12)`). Device-specific constraints are applied at promotion time, not at storage time.

### `CommonSampleYamlSchema`

```typescript
const CommonSampleYamlSchema = z.object({
  format: z.literal('common-sample'),
  version: z.literal(1),
  name: z.string().min(1).max(128),
  wave: BaseWaveParamsSchema,
  tags: z.array(z.string()).optional(),
  description: z.string().optional(),
  sourceDevice: DeviceTypeSchema.optional(),  // breadcrumb for demoted tones
  createdAt: z.string().optional(),           // ISO 8601
  modifiedAt: z.string().optional(),          // ISO 8601
});
```

Key fields:
- `format: 'common-sample'` -- discriminator, parallel to `'sampler-tone'` and `'chopped-sample'`
- `wave: BaseWaveParamsSchema` -- reuses the existing base wave params (`common-schema.ts:22-31`): `file`, `sampleRate`, `loopMode`, optional `loopPoint`
- `sourceDevice` -- optional breadcrumb set when a tone is demoted, so the user knows where it came from
- `name` max is 128, not 12 -- the 12-character limit is a device constraint (S-330 display width) applied during promotion

### Storage Layout

```
library/
  common/
    samples/          # existing -- chopped samples
    tones/            # new -- common-area tones
      my-kick.yaml
      my-kick.wav
      drums/
        snare-01.yaml
        snare-01.wav
```

Each common tone is a YAML + WAV pair in a flat directory (same pattern as device tones in `library/{device}/tones/`). Subdirectories are organizational folders.

### Scanner Integration

A new `detectCommonTone` item detector follows the existing `ItemDetector` pattern (`library-fs.ts:221-225`). Unlike `detectTone` (which only checks for `.yaml` extension), `detectCommonTone` must parse the YAML to verify `format: 'common-sample'` -- this is more expensive but necessary because `library/common/tones/` could contain other YAML files.

```typescript
const detectCommonTone: ItemDetector = async (entry, parentDir, path) => {
  if (entry.kind !== 'file' || !entry.name.endsWith('.yaml')) return null;
  // Parse YAML, validate against CommonSampleYamlSchema
  // Return LibraryTreeNode with type: 'common-tone' or null
};
```

`LibraryTreeNode.type` union (`library-fs.ts:69`) gains `'common-tone'`.

A new `listCommonTonesTree()` function scans `library/common/tones/` using `scanLibraryDirectory` with `detectCommonTone`.

### Promotion and Demotion

```typescript
interface PromotionConverter<TDefaults> {
  promote(sample: CommonSampleYaml, defaults: TDefaults): ToneYaml;
  demote(tone: ToneYaml): CommonSampleYaml;
}
```

**S-330 promotion** requires `originalKey` (MIDI note 11-108) -- the S-330 tone extension has no sensible default for this field (`tone-schema.ts:82`). All other S-330 extension fields have defaults. The promotion UI must present a form for `originalKey` (and optionally other fields the user wants to customize).

**S-550 promotion** uses the same extension structure (`tone-schema.ts:106`) with the same `originalKey` requirement.

**Demotion** strips the device extension block, sets `sourceDevice` to the original device type, and relaxes validation (the 12-character name is preserved as-is since it's within the 128-character common limit).

Promotion and demotion **copy** audio files rather than referencing them. This keeps common and device libraries independent -- deleting a device tone doesn't break the common area, and vice versa.

### UI Integration

**LibraryTreePanel** (`LibraryTreePanel.tsx`, currently 611 lines) gains a new "Common Tones" `TreeSection` between the device-specific sections and the existing "Samples" (chopped samples) section. This follows the same pattern as the existing tree sections.

**Preview panel** for common samples shows: name, description, tags, wave parameters (sample rate, loop mode, loop point), waveform visualization, and a "Promote to [device]" dropdown button.

**Device tone preview** gains a "Demote to Common Area" button that strips device params and copies to `library/common/tones/`.

## Dependencies

- **`edit-workflow-architecture`** (complete) -- defines the workflow navigation pattern and environment capability interfaces used by the import and promotion UI flows.

### Existing Assets

- **`ChoppedSampleSchema`** (`chopped-sample-schema.ts`) -- reference implementation for a device-agnostic library schema with its own format discriminator
- **`BaseWaveParamsSchema`** (`common-schema.ts:22-31`) -- reused directly in the new schema
- **`library-fs.ts`** -- generic scanner infrastructure (`scanLibraryDirectory`, `ItemDetector` pattern) that the new detector plugs into
- **`LibraryTreePanel.tsx`** -- existing tree UI with `TreeSection` component pattern for the new section
- **`listChoppedSamplesTree()`** (`library-fs.ts:491-497`) -- reference for scanning `library/common/` subdirectories

## Open Questions

- [ ] **Multiple WAV files per common sample?** Propose: no, single WAV per common sample (matching the device tone pattern). Multi-sample instruments are a different abstraction.
- [ ] **Copy or reference on promotion?** Propose: copy. Keeps common and device libraries independent. Reference would save disk space but creates fragile cross-references.
- [ ] **Name length for common samples?** Propose: 128 characters. Device-specific limits (e.g., 12 for S-330) are enforced at promotion time. If the name is too long, the promotion UI prompts the user to shorten it.
- [ ] **Should `detectCommonTone` validate the full schema or just check the `format` field?** Full validation is safer but slower. Checking only `format: 'common-sample'` is fast but could surface invalid files in the tree. Propose: full `safeParse` (matching the `detectChoppedSample` pattern at `library-fs.ts:374`).
- [ ] **Tags taxonomy?** Propose: freeform strings for now. A controlled vocabulary can be added later without schema changes since tags are already `z.array(z.string())`.

## Appendix

### Existing Library Layout

```
library/
  s330/
    tones/              # device-bound tones (ToneYaml with device: 's330')
    patches/            # device-bound patches
    drum-kits/          # drum kit bundles
    sets/               # saved device state snapshots
  s550/
    tones/
    patches/
    drum-kits/
    sets/
  common/
    samples/            # chopped samples (ChoppedSampleSchema) -- exists today
    tones/              # common-area tones (CommonSampleYaml) -- NEW
```

### Schema Comparison

| Field | `ToneYaml` | `CommonSampleYaml` | `ChoppedSample` |
|-------|-----------|-------------------|-----------------|
| `format` | `'sampler-tone'` | `'common-sample'` | `'chopped-sample'` |
| `device` | required (`DeviceType`) | absent | absent |
| `version` | positive int | `1` (literal) | `1` (literal) |
| `name` max | 12 | 128 | 128 |
| `wave` | `BaseWaveParams` | `BaseWaveParams` | n/a (has `source` + `sampleRate`) |
| Device extension | required (validated by `.refine()`) | absent | absent |
| `tags` | absent | optional | absent |
| `sourceDevice` | absent | optional | absent |
| `description` | absent | optional | optional |
| Timestamps | absent | optional | optional |

### Promotion Parameter Requirements by Device

| Device | Required on Promotion | Has Sensible Default |
|--------|----------------------|---------------------|
| S-330 | `originalKey` | No -- must be specified by user |
| S-330 | `outputAssign` | Yes -- defaults to 0 |
| S-330 | `transpose`, `fineTune` | Yes -- default to 0 |
| S-550 | `originalKey` | No -- must be specified by user |
| S-550 | `outputAssign` | Yes -- defaults to 0 |
