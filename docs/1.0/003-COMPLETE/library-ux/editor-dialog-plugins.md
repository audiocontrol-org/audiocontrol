# Editor Dialog Plugin Pattern (#175)

## Problem

Both editors render LoopEditorDialog, SampleChopperDialog, and SampleEditorDialog with nearly identical prop wiring (~50 lines each in LibraryPage). These are common-area editing tools — not device-specific. The state management is already shared via `useEditorDialogsCore`. Only the rendering is duplicated.

## Design

### Dialogs as plugins

Each dialog IS a plugin — a universal editing tool registered once and used by all editors. Device-specific behavior is injected via:

- **Output drivers**: how to save results (the existing `EditorDialogStrategy` pattern)
- **Rendering extensions**: slots for device-specific UI (e.g., chopper's `renderOutputConfig` for S3K kit config)

### `EditorDialogGroup` component

A single component in editor-core that renders all three dialogs. It accepts dialog state from `useEditorDialogsCore` and optional device-specific render props:

```typescript
interface EditorDialogGroupProps {
  editorDialogs: EditorDialogsCoreResult;
  libraryRoot: StorageDirectoryHandle | null;
  /** Device-specific chopper output config renderer (optional) */
  renderChopperOutputConfig?: (state: ChopperOutputState) => JSX.Element;
}
```

Each editor's LibraryPage replaces ~50 lines of dialog JSX with:

```tsx
<EditorDialogGroup
  editorDialogs={editorDialogs}
  libraryRoot={root}
  renderChopperOutputConfig={(state) => (
    <S3kKitOutputConfig state={state} config={...} onConfigChange={...} />
  )}
/>
```

## Files to create

| File | Contents |
|------|----------|
| `editor-core/src/components/library/EditorDialogGroup.tsx` | Shared dialog rendering |

## Files to modify

| File | Change |
|------|--------|
| `editor-core/package.json` | Add `@audiocontrol/loop-editor`, `@audiocontrol/sample-editor` deps |
| `editor-core/src/index.ts` | Export EditorDialogGroup |
| `akai-s3k-editor/src/pages/LibraryPage.tsx` | Replace dialog JSX with EditorDialogGroup |
| `roland-sxx0-editor/src/pages/LibraryPage.tsx` | Same |

## Future: synthesizer component plugins

This pattern applies to other shared synthesis concepts:
- Filter/amplitude envelope editors (ADSR with device-specific ranges)
- LFO editors (rate/depth/delay with device-specific waveform options)
- Output routing (device-specific output count and assignment)

Each becomes a plugin with a universal contract and device-specific drivers. The editor dialog work establishes the template.

## Verification

```bash
pnpm --filter editor-core build
pnpm --filter akai-s3k-editor build
pnpm --filter roland-sxx0-editor build
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-common-library-s3k
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-s3k-library
modules/e2e-infra/scripts/run-and-watch.sh test-e2e-roland-library
```
