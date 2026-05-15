/**
 * Dev-only `window.__libraryPageTestHooks` namespace declaration.
 *
 * LibraryPage exposes a small set of dev-only test affordances on
 * `window.__libraryPageTestHooks` so the Tier 3 in-context credibility
 * spec can mount the ImportSamplesDialog without running the HTML5 DnD
 * round-trip (forbidden under the Tier 3 contract — see
 * `test/ui/in-context/README.md`).
 *
 * Production builds bypass the hook entirely because the LibraryPage's
 * `useEffect` body is gated on `import.meta.env.DEV`, which Vite folds
 * to a literal `false` at build time and tree-shakes the body.
 *
 * The hook namespace pattern mirrors the harness-globals namespace
 * (`src/pages/_harness/harness-globals.d.ts`) and the device-data-store
 * window export (`src/stores/deviceDataStore.ts:170`). Specs treat
 * missing entries as a contract failure (the hook must have been
 * mounted before the spec calls it).
 */
import type { SampleImportBundle } from '@/hooks/useImportSamples';

export {};

declare global {
  interface Window {
    __libraryPageTestHooks?: {
      /**
       * Open the ImportSamplesDialog with the given stub bundle. Routes
       * through the same production callback the DnD path eventually
       * invokes (`useImportSamples.openImportSamplesDialog`), so the
       * mounted dialog is the exact production dialog under test.
       */
      openImportSamplesDialog?: (name: string, bundle: SampleImportBundle) => void;
    };
  }
}
