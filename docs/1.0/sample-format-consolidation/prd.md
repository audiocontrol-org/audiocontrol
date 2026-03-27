# Sample Format Consolidation - Product Requirements Document

**Created:** 2026-03-22
**Status:** Draft
**Owner:** Orion Letizi

## Problem Statement

The library has two parallel metadata formats for audio samples in `library/common/samples/`:

| Format | Metadata File | WAV File | Fields | Origin |
|--------|--------------|----------|--------|--------|
| Chopped Sample | `manifest.yaml` | `source.wav` | slices, triggers, playback config, drumKit | S-330/S-550 editor, sample chopper |
| Sample | `sample.yaml` | `sample.wav` | loop points, rootKey, tags | Portable library module |

This causes:
1. **Duplicate UI sections**: "Chopped Samples" and "Samples" show overlapping content from the same directory
2. **Two code paths**: Separate detectors, loaders, savers, schemas, and preview panels
3. **Feature gap**: Samples can't have slices; chopped samples can't have loop points or rootKey
4. **Format confusion**: The same directory can't contain both formats; users must choose one

A chopped sample is just a sample with slice definitions. There's no reason for a separate format.

## User Stories

- As a sound designer, I want a single "Samples" section that shows all my samples regardless of whether they have slices, loop points, or both.
- As a developer, I want one sample schema that supports all audio metadata (loop points, slices, triggers, drumKit config) so I don't maintain two parallel code paths.
- As a user, I want to chop a sample into slices and still see its loop points and rootKey metadata.

## Solution

Extend `SampleYaml` with optional slice, trigger, playback, and drumKit fields from `ChoppedSampleSchema`. A sample with slices is a chopped sample. A sample without slices is a plain sample. One format, one metadata file (`sample.yaml`), one WAV file (`sample.wav`).

### Extended SampleYaml Fields

```yaml
# Existing fields (unchanged)
format: sample
version: 1
name: "Kick Drum Kit"
file: sample.wav
sampleRate: 30000
loopMode: forward       # NEW: coexists with slices
loopStart: 1024         # NEW: coexists with slices
loopEnd: 4096           # NEW: coexists with slices
rootKey: 60             # NEW: coexists with slices
tags: [drums, kit]

# New optional slice fields
slices:
  - label: kick
    startSample: 0
    endSample: 15000
  - label: snare
    startSample: 15000
    endSample: 30000

triggers:
  - triggerId: "midi:36"
    sliceIndex: 0
  - triggerId: "midi:38"
    sliceIndex: 1

playback:
  polyphony: poly
  playbackMode: one-shot
  muteGroups: [0, 0]

drumKit:
  baseNote: 36
  transpose: 0
  velocitySensitivity: 2
```

### Backward Compatibility

- `detectSample()` reads `sample.yaml` (new and existing)
- Legacy `manifest.yaml` files are still detected and loaded by falling back to the old detector, but presented as `type: 'sample'` with slice metadata
- New saves always write `sample.yaml` + `sample.wav`

## Success Criteria

- [ ] Single "Samples" section in library (no "Chopped Samples")
- [ ] Samples with slices show slice count in tree and slice details in preview
- [ ] Existing `manifest.yaml` samples still load (backward compat)
- [ ] New chopped samples saved as `sample.yaml`
- [ ] Loop points and slices coexist on the same sample
- [ ] "Open in Chopper" action available on samples with or without existing slices

## Scope

### In Scope

- Extend SampleYaml schema with slice/trigger/playback/drumKit fields
- Update detectors, loaders, savers in sampler-library
- Remove choppedSamples category from library plugins
- Update LibraryPage to remove duplicate state/handling
- Show slice info in CommonSamplePreviewPanel
- Backward-compat reading of manifest.yaml

### Out of Scope

- Automatic migration of existing manifest.yaml → sample.yaml files on disk
- Program.yaml changes (program format is separate and stays)
- DrumKit section changes (v2 drum kits in `library/s330/drum-kits/` are separate)

## Dependencies

- SampleYaml schema (sampler-library)
- ChoppedSampleSchema (sampler-library, to be deprecated)
- Library tree detection (sampler-library/library-fs.ts)
- Plugin architecture (editor-core)
