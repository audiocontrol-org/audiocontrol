/**
 * Phase 9 Task 6 — visual screenshot verification.
 *
 * One-shot artifact-generator spec (NOT a regression spec). Captures
 * full-page screenshots of every editor page on BOTH `/roland/s330/...`
 * and `/roland/s550/...` plus key dialog states, saving them under
 * `docs/1.0/001-IN-PROGRESS/s550-support/phase-9-task-6-screenshots/`
 * for visual verification that the Phase 9 Tasks 4-5 polish work didn't
 * regress anything visually on either device.
 *
 * Out of scope: assertions beyond "page mounted and the first stable
 * affordance is visible." The functional-regression gate is the
 * existing 146-spec `make test-ui-roland` suite — this spec only
 * captures pixels. Page-error listeners are NOT wired here because
 * fixture-mismatch console errors are already filtered correctly in
 * the canonical specs (`patches.spec.ts`, `library-flows-*.spec.ts`,
 * etc.); replicating those filters here would duplicate without adding
 * verification value.
 *
 * Dialog coverage rationale:
 *   - SaveSetDialog + LoadSetDialog: captured here. Reachable via simple
 *     UI clicks on LibraryPage after seeding a set into OPFS via the
 *     existing `seedOPFSSetManifest` helper.
 *   - ExportToneDialog: SKIPPED via `test.skip(...)` (line ~347).
 *     Opening it requires `tone.wave.endPoint > tone.wave.startPoint`
 *     (see `ToneEditorHead.tsx:59`); the `tones-bank-0` fixture's
 *     tone 0 decodes to identical wave start/end after replay, so the
 *     Export button never enables in the test environment.
 *   - The remaining library dialogs (DeleteDirectoryDialog,
 *     ExportPatchDialog, ImportLibraryPatchDialog,
 *     ImportLibraryToneDialog, ImportSampleDialog,
 *     ImportSamplesDialog, ImportToneDialog, MoveItemDialog) are
 *     mount-visible-asserted by the existing capability specs in
 *     `test/wiring/library-flows-dialogs.spec.ts` and siblings
 *     (CreateDirectoryDialog and RenameDirectoryDialog were dead-code
 *     orphans deleted as ROLAND-BUGFIX-DEL-002.)
 *     — their visual chrome is the SAME shared `<Dialog.Content>` +
 *     `.ac-input` / `.ac-select` / `.ac-checkbox` primitives polished
 *     in Task 5 commit `8e179806`. Screenshotting each from scratch
 *     requires re-implementing OPFS seeding for every dialog; the
 *     cost is high and the chrome is shared. The SaveSet/Load captures
 *     here prove the shared chrome.
 *
 * Output structure (11 captures per device × 2 devices = 22 total):
 *   docs/1.0/001-IN-PROGRESS/s550-support/phase-9-task-6-screenshots/
 *     s330/
 *       home.png
 *       patches.png
 *       tones-wave.png
 *       tones-pitch.png
 *       tones-filter.png
 *       tones-amp.png
 *       tones-lfo.png
 *       play.png
 *       library.png
 *       dialog-save-set.png
 *       dialog-load-set.png
 *       (workflows.png — NOT produced; WorkflowsPage unrouted in App.tsx)
 *       (dialog-export-tone.png — NOT produced; fixture gap, see above)
 *     s550/ (same 11 files)
 */
import path from 'node:path';
import url from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import {
  cleanupOPFS,
  connectLibraryOPFS,
} from '../wiring/library-flows-helpers';

/**
 * Seed a minimal valid set.yaml so SetsSection lists a clickable row.
 *
 * Path note: `listSets` (modules/roland-sxx0-editor/src/lib/library-sets.ts:58-60)
 * HARDCODES the scan path to `library/s330/sets/` regardless of the
 * editor's `config.deviceType`. This is a known limitation of the
 * current set-storage layer (separate from the per-device categories
 * surfaced by the library plugin's category list). So we seed under
 * `library/s330/sets/` for BOTH the s330 and s550 LoadSet tests —
 * the s550 library page reads the same s330-scoped set directory.
 *
 * The set manifest's `device:` field can be 's330' or 's550' (the
 * Zod schema accepts both — common-schema.ts:12), but the directory
 * path is fixed.
 */
async function seedOPFSSetForDevice(
  page: Page,
  device: 's330' | 's550',
  setName: string,
): Promise<void> {
  await page.evaluate(
    async ({ device, setName }) => {
      const root = await navigator.storage.getDirectory();
      const library = await root.getDirectoryHandle('library', { create: true });
      // Path hardcoded to s330 — see JSDoc above.
      const deviceDir = await library.getDirectoryHandle('s330', { create: true });
      const sets = await deviceDir.getDirectoryHandle('sets', { create: true });
      const setDir = await sets.getDirectoryHandle(setName, { create: true });
      const fileHandle = await setDir.getFileHandle('set.yaml', { create: true });
      const writable = await fileHandle.createWritable();
      const manifest = [
        'format: sampler-set',
        `device: ${device}`,
        'version: 1',
        `name: ${setName}`,
        'tones: []',
        'patches: []',
      ].join('\n');
      await writable.write(manifest);
      await writable.close();
    },
    { device, setName },
  );
}

// Resolve the output directory relative to this spec file. The spec
// lives at `modules/roland-sxx0-editor/test/ui/`; the output is at
// `docs/1.0/001-IN-PROGRESS/s550-support/phase-9-task-6-screenshots/`.
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const OUTPUT_ROOT = path.join(
  REPO_ROOT,
  'docs',
  '1.0',
  '001-IN-PROGRESS',
  's550-support',
  'phase-9-task-6-screenshots',
);

type DeviceId = 's330' | 's550';

const DEVICES: readonly DeviceId[] = ['s330', 's550'] as const;

function deviceBasePath(device: DeviceId): string {
  return `/roland/${device}/editor`;
}

function screenshotPath(device: DeviceId, name: string): string {
  return path.join(OUTPUT_ROOT, device, `${name}.png`);
}

/**
 * Standard pre-navigation setup: clear localStorage so simulated-port
 * IDs don't leak across the suite. No page-error listener — see header
 * comment.
 */
async function setupPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
  });
}

/**
 * Capture a full-page screenshot. The harness viewport is 1280×720
 * (playwright.test-harness.config.ts:42), but `fullPage: true` extends
 * the capture to the document's full scroll height — which is what we
 * want for verification (off-viewport list rows + below-the-fold
 * footers are part of the visual surface being verified).
 */
async function capture(page: Page, device: DeviceId, name: string): Promise<void> {
  await page.screenshot({
    path: screenshotPath(device, name),
    fullPage: true,
  });
}

test.describe('Phase 9 Task 6 — visual screenshots', () => {
  test.describe.configure({ mode: 'serial' });

  for (const device of DEVICES) {
    const basePath = deviceBasePath(device);

    test(`${device}: home page`, async ({ page }) => {
      await setupPage(page);
      await page.goto(`${basePath}/?midi=simulated&scenario=load-everything`);
      await page.waitForLoadState('networkidle');

      // Auto-connect settles when the Disconnect button mounts (positive
      // signal — mirrors home.spec.ts:64-67).
      await expect(page.getByTestId('disconnect-button')).toBeVisible({
        timeout: 10_000,
      });
      await capture(page, device, 'home');
    });

    test(`${device}: patches page`, async ({ page }) => {
      await setupPage(page);
      await page.goto(`${basePath}/patches?midi=simulated&scenario=patches-bank-0`);
      await page.waitForLoadState('networkidle');

      // First patch row settles when bank-0 load completes.
      await expect(page.getByTestId('patch-item-0')).toBeVisible({
        timeout: 10_000,
      });

      // Click into slot 0 so the detail pane renders the editor instead
      // of the "Select a patch to edit" placeholder — the editor is the
      // primary visual surface to verify.
      await page.getByTestId('patch-item-0').click();
      await expect(page.getByTestId('patch-editor')).toBeVisible({
        timeout: 5_000,
      });

      await capture(page, device, 'patches');
    });

    test(`${device}: tones page (5 tabs)`, async ({ page }) => {
      await setupPage(page);
      await page.goto(`${basePath}/tones?midi=simulated&scenario=tones-bank-0`);
      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('tone-item-0')).toBeVisible({
        timeout: 10_000,
      });
      await page.getByTestId('tone-item-0').click();
      await expect(page.getByTestId('tone-detail')).toBeVisible({
        timeout: 5_000,
      });

      // Wave is the default tab; capture before any tab switching.
      await capture(page, device, 'tones-wave');

      // Click each non-default tab and capture. The tabs render as
      // radios in an AcRadioTabs radiogroup; the visible click target
      // is the <label class="ac-radio-tab"> wrapper that forwards to
      // the sr-only radio via htmlFor. Updated 2026-05-24 per
      // AUDIT-20260524-11 (closed) — was getByRole('tab'), which
      // depended on the faux role="tab" attribute the component never
      // honored.
      const tabs: readonly ['Pitch' | 'Filter' | 'Amp' | 'LFO', string][] = [
        ['Pitch', 'tones-pitch'],
        ['Filter', 'tones-filter'],
        ['Amp', 'tones-amp'],
        ['LFO', 'tones-lfo'],
      ];
      for (const [tabName, fileName] of tabs) {
        await page.locator('label.ac-radio-tab', { hasText: tabName }).click();
        // Brief settle for the CSS-only radio-driven tab transition.
        await page.waitForTimeout(150);
        await capture(page, device, fileName);
      }
    });

    test(`${device}: play page`, async ({ page }) => {
      await setupPage(page);
      await page.goto(`${basePath}/play?midi=simulated&scenario=play-init`);
      await page.waitForLoadState('networkidle');

      // First multi part settles when the function-params load completes.
      await expect(page.getByTestId('part-0-channel')).toBeVisible({
        timeout: 10_000,
      });
      await capture(page, device, 'play');
    });

    // WorkflowsPage skipped: the page module exists at
    // src/pages/WorkflowsPage.tsx but is NOT mounted in App.tsx
    // (App.tsx:22-29 routes index/play/patches/tones/library only; the
    // catch-all `<Route path="*" element={<Navigate to="" replace />}>`
    // redirects /workflows back to the home page). This is consistent
    // with the workplan note that Workflows is "not yet at v3
    // (landing-pattern)" (README.md:54-55) — and the page didn't
    // receive a polish commit in Phase 9 Task 4 (only Patches / Tones
    // / Play / Library / Home were amended). Documented as a fixture
    // gap in the screenshot README; not blocking Phase 9 Task 6 since
    // the page isn't a polished surface in this phase.
    test.skip(`${device}: workflows page (NOT ROUTED — see README)`, async () => {
      // intentionally empty
    });

    test(`${device}: library page`, async ({ page }) => {
      await setupPage(page);
      await page.goto(`${basePath}/library?midi=simulated&scenario=load-everything`);
      await page.waitForLoadState('networkidle');

      // Heading + experimental badge are the stable structural signals
      // that the page mounted (mirrors library.spec.ts:50/66).
      await expect(
        page.getByRole('heading', { name: 'Library' }),
      ).toBeVisible({ timeout: 10_000 });
      await capture(page, device, 'library');
    });

    test(`${device}: SaveSetDialog`, async ({ page }) => {
      await setupPage(page);
      await page.goto(`${basePath}/library?midi=simulated&scenario=load-everything`);
      await page.waitForLoadState('networkidle');

      // Connect OPFS so the Save button enables. `cleanupOPFS` + connect
      // = empty library, button enabled, dialog renders the "create new
      // set" form state.
      await cleanupOPFS(page);
      await connectLibraryOPFS(page);

      const saveButton = page.getByTestId('save-set-button');
      await expect(saveButton).toBeEnabled({ timeout: 10_000 });
      await saveButton.click();

      // SaveSetDialog mounts the "set-name-input" field at
      // SaveSetDialog.tsx:88. Wait for it as the canonical "dialog open"
      // signal.
      await expect(page.getByTestId('set-name-input')).toBeVisible({
        timeout: 5_000,
      });
      await capture(page, device, 'dialog-save-set');
    });

    test(`${device}: LoadSetDialog`, async ({ page }) => {
      await setupPage(page);
      await page.goto(`${basePath}/library?midi=simulated&scenario=load-everything`);
      await page.waitForLoadState('networkidle');

      // Seed a set manifest so the SetsSection lists a set the user can
      // select. The Load button only enables once a set is selected.
      await cleanupOPFS(page);
      await seedOPFSSetForDevice(page, device, 'demo-set');
      await connectLibraryOPFS(page);

      // Wait for the seeded set to appear in the SetsSection, then click
      // it to set the selection. The SetsSection row uses
      // `set-item-<setName>` (see `setItem` locator in
      // library-flows-helpers.ts:400).
      const setNode = page.getByTestId('set-item-demo-set');
      await expect(setNode).toBeVisible({ timeout: 10_000 });
      await setNode.click();

      const loadButton = page.getByTestId('load-set-button');
      await expect(loadButton).toBeEnabled({ timeout: 5_000 });
      await loadButton.click();

      // LoadSetDialog mounts the "confirm-load-set" button at
      // LoadSetDialog.tsx:187.
      await expect(page.getByTestId('confirm-load-set')).toBeVisible({
        timeout: 5_000,
      });
      await capture(page, device, 'dialog-load-set');
    });

    // ExportToneDialog skipped: opening the dialog requires
    // `tone.wave.endPoint > tone.wave.startPoint` (`hasSampleData`
    // check in ToneEditorHead.tsx:59), AND the wave data to be cached
    // in useWaveDataCache. The tones-bank-0 fixture's tone 0 has
    // identical wave start/end after fixture replay, so the Export
    // button stays disabled in this test environment. Driving the
    // dialog open would require either a different fixture or a
    // dedicated tone with valid wave bounds. The dialog's chrome is
    // the same shared dialog primitives polished in Task 5 commit
    // `8e179806`, and the SaveSet/Load dialog captures here exercise
    // the same `<Dialog.Content>` shell + footer rhythm — visual
    // verification of the export dialog specifically is documented as
    // a fixture gap in the screenshot README and proven separately
    // by the import-tone dialog mounted in
    // `test/wiring/library-flows-dialogs.spec.ts`
    // (D-LIB-12: ImportLibraryToneDialog) which shares the same
    // primitives.
    test.skip(`${device}: ExportToneDialog (SKIPPED — see README)`, async () => {
      // intentionally empty
    });
  }
});
