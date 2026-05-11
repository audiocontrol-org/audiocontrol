/**
 * Library-flow capability spec — shared helpers.
 *
 * Wave 4 (#415) — library + dialog flow tests. Separated from the main
 * spec file so each helper has one canonical implementation and the
 * spec file stays under the 300-500 line cap.
 *
 * Library state setup approach:
 *
 *   The simulated transport handles the device side; the library side is
 *   driven via the real OPFS backend (`navigator.storage.getDirectory()`)
 *   that LibraryPage already wires through `LibraryConnectionUI`'s
 *   `data-testid="library-backend-opfs"` button. OPFS is per-origin and
 *   auto-available in Chromium without a user-gesture permission prompt,
 *   so the spec can:
 *
 *     1. `cleanupOPFS(page)` — wipe the OPFS root before the test so the
 *        library tree starts empty.
 *     2. Optionally `seedOPFSSetManifest(page, ...)` — write a minimal
 *        valid `set.yaml` so the SetsSection lists a set the user can
 *        select.
 *     3. `connectLibraryOPFS(page)` — click the "Browser Storage" button
 *        in the LibraryConnectionUI; the page picks up whatever was
 *        seeded.
 *
 *   The order matters: clearing OPFS BEFORE the page mounts the OPFS
 *   backend would be cleaner, but `connectToBackend('opfs')` only fires
 *   when the user clicks the button, so the spec runs cleanup just
 *   before that click. The runner uses `workers: 1`
 *   (playwright.test-harness.config.ts:26), so there's no cross-test
 *   OPFS contention to worry about — each spec sees a fresh page.
 *
 * Tradeoffs considered:
 *   - URL param `?library=mock&data=<scenario>` — would require a new
 *     mock backend implementing `StorageDirectoryHandle`. Real OPFS is
 *     already implemented and already mounted by the production code.
 *   - `addInitScript` seeding before page load — OPFS is async and
 *     LibraryConnectionUI only initialises the backend after the user
 *     clicks the "Browser Storage" button (`connectToBackend('opfs')`
 *     in editor-core's libraryConnectionStore.ts:219). Init-script
 *     seeding works for localStorage but adds no extra value over
 *     pre-click evaluate() seeding for OPFS.
 *   - Pre-populate via UI interactions (load + export) — would require
 *     captured device fixtures for the export round-trip first. None of
 *     the Wave 4 affordances need that depth.
 *
 *   Chosen: pre-click `page.evaluate()` OPFS seeding via the helpers in
 *   this file. Minimal new infrastructure, reuses production OPFS
 *   wiring, no mock-backend complexity.
 */
import { expect, type Page, type Locator } from '@playwright/test';

/**
 * URL used by every Wave 4 spec. The library page is mounted under
 * `/roland/s330/editor/` because the editor's legacy `useMidiStore`
 * alias is hardcoded to the s330 store (see
 * `modules/roland-sxx0-editor/src/stores/midiStore.ts:128`). The
 * simulated transport reads fixtures from `/test-fixtures/s330/`. The
 * `load-everything` scenario primes both tone and patch caches so the
 * `DeviceMemoryPanel` shows real entries the user can act on.
 */
export const LIBRARY_URL =
  '/roland/s330/editor/library?midi=simulated&scenario=load-everything';

/**
 * Tones-page URL uses the `tones-bank-0` fixture (NOT `load-everything`)
 * because the TonesPage mount sequence emits exactly `connect() +
 * loadToneRange(0, 8)` — the bytes the `tones-bank-0` capture records
 * (see modules/sampler-devices/test/fixtures/s330/tones-bank-0.ndjson).
 * `load-everything` records all 6 patch banks + all 6 tone banks, which
 * is what LibraryPage's manual Refresh-Device click drives — using it
 * on the Tones page would diverge at the first patch RQD the fixture
 * expects but the page doesn't emit.
 */
export const TONES_URL =
  '/roland/s330/editor/tones?midi=simulated&scenario=tones-bank-0';

/**
 * Patches-page URL uses `patches-bank-0` for the same reason — see
 * TONES_URL note above. The PatchesPage mount sequence is
 * `connect() + loadPatchRange(0, 8)`.
 */
export const PATCHES_URL =
  '/roland/s330/editor/patches?midi=simulated&scenario=patches-bank-0';

/**
 * Clear OPFS for the current origin. Mirrors the OPFS_HELPERS pattern
 * from `test/e2e/device-sets.spec.ts:213-225` but kept local to the
 * UI suite so this file doesn't reach into e2e helpers (e2e/ requires
 * the real bridge + hardware).
 */
export async function cleanupOPFS(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (!('storage' in navigator) || typeof navigator.storage.getDirectory !== 'function') {
      throw new Error('OPFS not available — test environment cannot satisfy library-flow specs');
    }
    const root = await navigator.storage.getDirectory();
    // FileSystemDirectoryHandle exposes .values() returning an async
    // iterator over child handles (each carries `name` and `kind`).
    // We collect names first so removeEntry calls don't perturb the
    // ongoing iteration.
    const rootWithValues = root as unknown as {
      values(): AsyncIterable<{ name: string; kind: string }>;
    };
    const names: string[] = [];
    for await (const entry of rootWithValues.values()) {
      names.push(entry.name);
    }
    for (const name of names) {
      try {
        await root.removeEntry(name, { recursive: true });
      } catch (err) {
        if ((err as { name?: string } | null)?.name !== 'NotFoundError') throw err;
      }
    }
  });
}

/**
 * Write a minimal valid `set.yaml` under `library/s330/sets/<setName>/`
 * so the SetsSection lists a row the user can click. The manifest must
 * pass `SetYamlSchema` (modules/sampler-library/src/schemas/set-schema.ts:72)
 * — format, device, version, name, tones[], patches[] are required;
 * tones/patches can be empty arrays.
 *
 * Format strings (`format: sampler-set`, `device: s330`) are pinned to
 * the schema literals; if the schema ever drifts the test fails loudly
 * at SetsSection parse time, which is the intended contract.
 */
export async function seedOPFSSetManifest(
  page: Page,
  setName: string,
): Promise<void> {
  await page.evaluate(async ({ setName }) => {
    const root = await navigator.storage.getDirectory();
    const library = await root.getDirectoryHandle('library', { create: true });
    const s330 = await library.getDirectoryHandle('s330', { create: true });
    const sets = await s330.getDirectoryHandle('sets', { create: true });
    const setDir = await sets.getDirectoryHandle(setName, { create: true });
    const fileHandle = await setDir.getFileHandle('set.yaml', { create: true });
    const writable = await fileHandle.createWritable();
    const manifest = [
      'format: sampler-set',
      'device: s330',
      'version: 1',
      `name: ${setName}`,
      'tones: []',
      'patches: []',
    ].join('\n');
    await writable.write(manifest);
    await writable.close();
  }, { setName });
}

/**
 * Click the LibraryConnectionUI "Browser Storage" button to connect the
 * OPFS backend, then wait for the library tree to render its sections
 * (proves `useLibraryConnection.root` is now non-null and the
 * PluginLibraryBrowser swapped out the empty-state pane for the
 * `ac-plugin-library-browser-sections` div).
 *
 * The button carries `data-testid="library-backend-opfs"` (see
 * modules/editor-core/src/components/library/LibraryConnectionUI.tsx:92).
 */
export async function connectLibraryOPFS(page: Page): Promise<void> {
  const button = page.getByTestId('library-backend-opfs');
  await expect(button).toBeVisible({ timeout: 5_000 });
  await button.click();
  // The Sets header is rendered by the SetsSection that mounts only
  // when libraryHandle becomes truthy. Polling for it confirms the
  // backend connection completed and the PluginLibraryBrowser swapped
  // its empty-state pane for the populated sections.
  const libRegion = page.locator('[data-capability="C-LIB-01"]');
  await expect(libRegion.getByText(/^Sets$/)).toBeVisible({ timeout: 5_000 });
}

/**
 * Locator for the SetsSection's set item; the row carries
 * `data-testid="set-item-<name>"` (modules/roland-sxx0-editor/src/
 * components/library/SetItem.tsx:111).
 */
export function setItem(page: Page, setName: string): Locator {
  return page.getByTestId(`set-item-${setName}`);
}
