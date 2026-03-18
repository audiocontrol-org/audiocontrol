# Sample Chopper Extraction - Workplan

**GitHub Milestone:** TBD
**GitHub Issues:** TBD

## Technical Approach

Extract the sample slicing workflow from `sampler-library` and `sampler-editor` into a standalone `@audiocontrol/sample-chopper` module. The module provides both a pure algorithm layer (no dependencies) and a React UI layer (peer deps on React + Radix).

**Key design decisions:**

1. **Render prop pattern** — `SampleChopperDialog` accepts `renderOutputConfig` for device-specific UI injection
2. **Design tokens over s330 classes** — Extracted components use `--ac-*` CSS custom properties
3. **Backward compatibility** — `sampler-library` re-exports all algorithm functions
4. **Zero device coupling** — No imports from `sampler-devices` or `sampler-library` in the new module

## Module Structure

```
modules/sample-chopper/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts              ← algorithm exports
│   ├── types.ts              ← SliceConfig, SliceResult, Slice (generic)
│   ├── audio-utils.ts
│   ├── transient-detector.ts
│   ├── silence-detector.ts
│   ├── fixed-slicer.ts
│   ├── manual-slicer.ts
│   ├── chopper.ts            ← sliceAudio(), analyzeForSlicing()
│   └── ui/
│       ├── index.ts          ← React UI exports
│       ├── utils.ts          ← cn() utility (clsx + tailwind-merge)
│       ├── components/
│       │   ├── WaveformEditor.tsx
│       │   ├── SampleChopperDialog.tsx
│       │   ├── SliceMethodPanel.tsx
│       │   └── SliceList.tsx
│       └── hooks/
│           ├── useAudioPreview.ts
│           └── useSampleChopper.ts
└── test/
    ├── chopper.test.ts
    ├── audio-utils.test.ts
    ├── transient-detector.test.ts
    ├── silence-detector.test.ts
    ├── fixed-slicer.test.ts
    └── manual-slicer.test.ts
```

## Implementation Phases

### Phase 1: Module Scaffold and Algorithm Extraction

Create `modules/sample-chopper/` with build tooling. Move pure algorithm files, stripping `DrumKitOutputConfig` and `slicesToDrumKit()`.

**Files to create:**

| File | Purpose |
|------|---------|
| `modules/sample-chopper/package.json` | Package config with tsup build |
| `modules/sample-chopper/tsconfig.json` | TypeScript config with @/ paths |
| `modules/sample-chopper/vitest.config.ts` | Vitest config with 80% coverage |
| `modules/sample-chopper/tsup.config.ts` | Build entry points |
| `modules/sample-chopper/src/types.ts` | Generic types (no S330 coupling) |
| `modules/sample-chopper/src/audio-utils.ts` | Audio analysis utilities |
| `modules/sample-chopper/src/transient-detector.ts` | Transient detection slicer |
| `modules/sample-chopper/src/silence-detector.ts` | Silence detection slicer |
| `modules/sample-chopper/src/fixed-slicer.ts` | Fixed interval slicer |
| `modules/sample-chopper/src/manual-slicer.ts` | Manual region slicer |
| `modules/sample-chopper/src/chopper.ts` | Orchestrator (sliceAudio, analyzeForSlicing) |
| `modules/sample-chopper/src/index.ts` | Barrel exports |

**Files to modify:**

| File | Change |
|------|--------|
| `sampler-library/src/sample-chopper/types.ts` | Keep only DrumKitOutputConfig, re-export rest |
| `sampler-library/src/sample-chopper/chopper.ts` | Keep only slicesToDrumKit, re-export rest |
| `sampler-library/src/sample-chopper/browser.ts` | Re-export from @audiocontrol/sample-chopper |
| `sampler-library/package.json` | Add sample-chopper dependency |

**Success criteria:** `pnpm --filter sample-chopper build` passes

### Phase 2: Test Migration

Move algorithm tests to new module. Verify backward compatibility.

**Success criteria:** `pnpm --filter sample-chopper test` and `pnpm --filter sampler-library test` pass

### Phase 3: React UI Extraction

Move UI components and hooks. Generalize types. Add render prop pattern. Replace CSS classes.

**Files to create/move:**

| File | Purpose |
|------|---------|
| `modules/sample-chopper/src/ui/utils.ts` | cn() utility |
| `modules/sample-chopper/src/ui/components/WaveformEditor.tsx` | Waveform canvas (move as-is) |
| `modules/sample-chopper/src/ui/components/SampleChopperDialog.tsx` | Dialog with renderOutputConfig prop |
| `modules/sample-chopper/src/ui/components/SliceMethodPanel.tsx` | Slice method tabs (extracted) |
| `modules/sample-chopper/src/ui/components/SliceList.tsx` | Manual slice list (extracted) |
| `modules/sample-chopper/src/ui/hooks/useAudioPreview.ts` | Audio playback hook (move as-is) |
| `modules/sample-chopper/src/ui/hooks/useSampleChopper.ts` | Slice state hook (generalized) |
| `modules/sample-chopper/src/ui/index.ts` | UI barrel exports |

**Files to create in sampler-editor:**

| File | Purpose |
|------|---------|
| `sampler-editor/src/components/library/S330KitOutputConfig.tsx` | S-330 specific kit config UI |

**Files to modify in sampler-editor:**

| File | Change |
|------|--------|
| `sampler-editor/src/components/library/ItemPreviewPanel.tsx` | Import from @audiocontrol/sample-chopper/ui |
| `sampler-editor/package.json` | Add sample-chopper dependency |

**Success criteria:** `pnpm --filter sampler-editor build` passes, dialog works identically

## Critical Files

| File | Action |
|------|--------|
| `sampler-library/src/sample-chopper/types.ts` | Split: pure types move, `DrumKitOutputConfig` stays |
| `sampler-library/src/sample-chopper/chopper.ts` | Split: `sliceAudio`/`analyzeForSlicing` move, `slicesToDrumKit` stays |
| `sampler-library/src/sample-chopper/browser.ts` | Rewrite to re-export from `@audiocontrol/sample-chopper` |
| `sampler-editor/src/hooks/useSampleChopper.ts` | Move + generalize `sampleRate` type |
| `sampler-editor/src/components/library/SampleChopperDialog.tsx` | Move + refactor to render prop |
| `sampler-editor/src/components/library/WaveformEditor.tsx` | Move as-is |

## Verification

- `pnpm --filter sample-chopper build` succeeds
- `pnpm --filter sample-chopper test` passes
- `pnpm --filter sampler-library test` passes
- `pnpm --filter sampler-editor build` succeeds
- No `sampler-devices` or `sampler-library` imports in `sample-chopper` module
