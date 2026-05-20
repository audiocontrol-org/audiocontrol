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
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  SampleYamlSchema,
  ToneYamlSchema,
  PatchYamlSchema,
} from '@audiocontrol/sampler-library';
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
 * Resolve a fixture file relative to `modules/roland-sxx0-editor/test/e2e/fixtures/`.
 *
 * The Wave 4 close-out approach (Decision 3, commit 28992738) is to
 * REUSE validated fixtures on disk rather than construct YAML in code.
 * Every helper that seeds a library entry into OPFS routes through
 * `readFixtureText` / `readFixtureBytes` so the bytes the spec writes
 * are the same bytes any other consumer (e2e tests, library round-trip
 * tooling) would see.
 */
const FIXTURES_ROOT = path.resolve(
  path.dirname(url.fileURLToPath(import.meta.url)),
  '../e2e/fixtures',
);

function readFixtureText(relativePath: string): string {
  return fs.readFileSync(path.join(FIXTURES_ROOT, relativePath), 'utf-8');
}

function readFixtureBytes(relativePath: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(FIXTURES_ROOT, relativePath)));
}

/**
 * Convert a `Uint8Array` to a plain `number[]` so it survives
 * structured-clone serialization across the Playwright bridge into
 * `page.evaluate`. The browser side reconstructs a `Uint8Array` before
 * writing into OPFS.
 */
function bytesToTransfer(buf: Uint8Array): number[] {
  return Array.from(buf);
}

/**
 * Seed a Roland S-330 individual library tone into OPFS by copying a
 * validated fixture from `test/e2e/fixtures/tones/<fixtureName>.yaml`
 * (and its companion `.wav`) into
 * `library/s330/tones/<targetName>.yaml` + `<targetName>.wav`.
 *
 * The YAML is parsed through `ToneYamlSchema` before being written so
 * any drift between the on-disk fixture and the published schema fails
 * the test at seeding time (not at dialog-mount time), keeping the
 * failure signal close to its cause.
 *
 * The seeded path matches `loadIndividualTone`'s expected layout
 * (`modules/roland-sxx0-editor/src/lib/library-tones.ts:339`), which
 * the s330 plugin's `tones` category surfaces as a single-node tree
 * keyed by file name. Clicking the corresponding `library-tone-<id>`
 * tree node routes through `useRolandSelectionMapping` to a
 * `selection.type === 'individualTone'` state, which arms
 * `ImportLibraryToneDialog` via the preview panel's "Import to Device"
 * button.
 */
export async function seedOPFSTone(
  page: Page,
  options: { fixtureName?: string; targetName?: string } = {},
): Promise<void> {
  const fixtureName = options.fixtureName ?? 'basic-sine';
  const targetName = options.targetName ?? fixtureName;

  const yamlText = readFixtureText(`tones/${fixtureName}.yaml`);
  const wavBytes = readFixtureBytes(`tones/${fixtureName}.wav`);

  // Schema-validate before writing. A parse throw here means the
  // fixture has drifted from the schema — fail loudly at the source.
  ToneYamlSchema.parse(parseYaml(yamlText));

  await page.evaluate(
    async ({ yamlText, wavBytes, targetName }) => {
      const root = await navigator.storage.getDirectory();
      const library = await root.getDirectoryHandle('library', { create: true });
      const s330 = await library.getDirectoryHandle('s330', { create: true });
      const tones = await s330.getDirectoryHandle('tones', { create: true });

      const yamlHandle = await tones.getFileHandle(`${targetName}.yaml`, { create: true });
      const yamlWritable = await yamlHandle.createWritable();
      await yamlWritable.write(yamlText);
      await yamlWritable.close();

      const wavHandle = await tones.getFileHandle(`${targetName}.wav`, { create: true });
      const wavWritable = await wavHandle.createWritable();
      await wavWritable.write(new Uint8Array(wavBytes));
      await wavWritable.close();
    },
    { yamlText, wavBytes: bytesToTransfer(wavBytes), targetName },
  );
}

/**
 * Seed a Roland S-330 individual library patch bundle into OPFS by
 * copying `test/e2e/fixtures/patches/<fixtureName>.yaml` into a
 * `library/s330/patches/<targetName>/patch.yaml` directory bundle.
 *
 * `loadIndividualPatch`
 * (`modules/roland-sxx0-editor/src/lib/library-patches.ts:294`)
 * expects a directory containing `patch.yaml` and an optional `tones/`
 * subdirectory; the patch-tree detector
 * (`modules/sampler-library/src/library-fs.ts:282`) treats the
 * containing directory's name as the tree node's `id` and pulls the
 * `name` field from the YAML for the tree node's `node.name`.
 *
 * `targetName` defaults to the `fixtureName` (kebab-case directory name),
 * which is deliberately distinct from the fixture's YAML `name` field
 * (e.g., `basic-patch` directory holds a YAML with `name: Basic Patch`).
 * The mismatch exercises `useRolandLibraryData`'s meta-packing path
 * (#418): the selection mapping resolves the patch's directory identity
 * via `node.meta.directoryName`, NOT the YAML display name. Pre-#418 this
 * would have failed because `useRolandLibraryData` shipped raw
 * `LibraryTreeNode[]` with no `meta`, forcing the fallback through
 * `node.name` (the YAML display name) — which then handed
 * `loadIndividualPatch` the wrong directory.
 *
 * The basic-patch fixture uses `keyGroups` only (no `s330.toneLayer1`),
 * so `getPatchToneDependencies` returns an empty list and the dialog
 * doesn't need any seeded tones-under-this-patch. That's sufficient
 * for the D-LIB-13 mount-only assertion. If a later test needs the
 * tones-mapping UI populated, it should seed the appropriate
 * `tones/T<NN>.yaml` files explicitly — there is no shape-construction
 * fallback in this helper.
 */
export async function seedOPFSPatch(
  page: Page,
  options: { fixtureName?: string; targetName?: string } = {},
): Promise<{ patchDirName: string; patchDisplayName: string }> {
  const fixtureName = options.fixtureName ?? 'basic-patch';

  const yamlText = readFixtureText(`patches/${fixtureName}.yaml`);
  const parsed = PatchYamlSchema.parse(parseYaml(yamlText));

  // Default directory name to the kebab-case `fixtureName` (NOT the YAML
  // `name` field). This forces the round-trip to traverse the meta-packing
  // path in `useRolandLibraryData` (#418); a mismatch between
  // directory-name and YAML-name would have failed pre-#418.
  const patchDirName = options.targetName ?? fixtureName;

  await page.evaluate(
    async ({ yamlText, targetName }) => {
      const root = await navigator.storage.getDirectory();
      const library = await root.getDirectoryHandle('library', { create: true });
      const s330 = await library.getDirectoryHandle('s330', { create: true });
      const patches = await s330.getDirectoryHandle('patches', { create: true });
      const patchDir = await patches.getDirectoryHandle(targetName, { create: true });

      const yamlHandle = await patchDir.getFileHandle('patch.yaml', { create: true });
      const writable = await yamlHandle.createWritable();
      await writable.write(yamlText);
      await writable.close();
    },
    { yamlText, targetName: patchDirName },
  );

  return { patchDirName, patchDisplayName: parsed.name };
}

/**
 * Seed a common-area library sample bundle into OPFS by copying
 * `test/e2e/fixtures/samples/<fixtureName>/sample.yaml` + `sample.wav`
 * into `library/common/samples/<targetName>/sample.yaml` + `sample.wav`.
 *
 * Common-area samples are device-agnostic (no `device` field) and the
 * editor's sample dialogs (Loop Editor, Sample Editor, Sample Chopper)
 * load them through `useEditorDialogsCore.loadWavData` which calls
 * `loadSample` (`modules/sampler-library/src/common-area/samples.ts:238`)
 * — that function reads `sample.yaml` + `sample.wav` from
 * `library/common/samples/<path>/<name>/` and parses the YAML through
 * `SampleYamlSchema`. The Wave 4 close-out reuses the same schema for
 * pre-write validation so any drift fails the test before the dialog
 * ever opens.
 *
 * The `targetName` becomes the tree-node `id` rendered by the s330
 * plugin's `samples` category (via `listCommonSamplesTree` →
 * `detectSample`); clicking the `library-sample-<id>` tree node maps
 * to `selection.type === 'sample'`, which the preview panel surfaces
 * with affordances that open the Loop Editor / Sample Editor /
 * Chopper dialogs.
 */
export async function seedOPFSSample(
  page: Page,
  options: { fixtureName?: string; targetName?: string } = {},
): Promise<void> {
  const fixtureName = options.fixtureName ?? 'basic-sine';
  const targetName = options.targetName ?? fixtureName;

  const yamlText = readFixtureText(`samples/${fixtureName}/sample.yaml`);
  const wavBytes = readFixtureBytes(`samples/${fixtureName}/sample.wav`);
  SampleYamlSchema.parse(parseYaml(yamlText));

  await page.evaluate(
    async ({ yamlText, wavBytes, targetName }) => {
      const root = await navigator.storage.getDirectory();
      const library = await root.getDirectoryHandle('library', { create: true });
      const common = await library.getDirectoryHandle('common', { create: true });
      const samples = await common.getDirectoryHandle('samples', { create: true });
      const sampleDir = await samples.getDirectoryHandle(targetName, { create: true });

      const yamlHandle = await sampleDir.getFileHandle('sample.yaml', { create: true });
      const yamlWritable = await yamlHandle.createWritable();
      await yamlWritable.write(yamlText);
      await yamlWritable.close();

      const wavHandle = await sampleDir.getFileHandle('sample.wav', { create: true });
      const wavWritable = await wavHandle.createWritable();
      await wavWritable.write(new Uint8Array(wavBytes));
      await wavWritable.close();
    },
    { yamlText, wavBytes: bytesToTransfer(wavBytes), targetName },
  );
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
