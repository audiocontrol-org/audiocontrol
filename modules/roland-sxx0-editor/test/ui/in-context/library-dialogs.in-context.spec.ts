/**
 * @credibleAgainst contexts sticky-overlay zero-width-grid pointer-events-none-ancestor
 *
 * Tier 3 in-context spec for `LIVE-S550-LIB-001` (issue #429) — the
 * library-dialog family `Dialog.Description` accessibility fix. Mounts
 * the production LibraryPage and verifies each of the four affected
 * Radix dialogs renders an accessible description that Radix wires
 * through `aria-describedby`, eliminating the runtime warning
 * `Warning: Missing 'Description' or 'aria-describedby={undefined}'
 * for {DialogContent}.`
 *
 * Family scope — four dialogs per the controller's audit:
 *
 *   D-LIB-10 — SaveSetDialog          (visible description; production-wired)
 *   D-LIB-11 — LoadSetDialog          (visible description; production-wired)
 *   D-LIB-XX1 — CreateDirectoryDialog (VisuallyHidden description; orphan)
 *   D-LIB-XX2 — RenameDirectoryDialog (VisuallyHidden description; orphan)
 *
 * The S-550 capability inventory
 * (`ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md`) carries D-IDs for the
 * two production-wired dialogs (D-LIB-10 + D-LIB-11). The two
 * directory dialogs are orphan components — defined under
 * `src/components/library/` but never instantiated by production
 * pages (folder CRUD on LibraryPage routes through editor-core's
 * `LibraryBrowser` and its own `CreateFolderDialog`). They received
 * the same `Dialog.Description` fix as a preventive measure so a
 * future caller wiring them up does not re-introduce the a11y warning.
 * The test names use placeholder D-IDs (`D-LIB-XX1` / `D-LIB-XX2`)
 * because the inventory does not currently enumerate them; assigning a
 * stable D-ID is operator-owned inventory work and out of scope for
 * the #429 remediation. The spec name explicitly carries `#429` so
 * the test → issue trace is unambiguous regardless of D-ID drift.
 *
 * Per-test design (Design B from the implementer brief — separate
 * `test()` blocks rather than a single comprehensive walk):
 *
 *   Each `test()` block opens one dialog via the correct production
 *   trigger or dev-only test hook, then asserts:
 *
 *     CLAIM 1 — The dialog is reachable: `Dialog.Content` mounts and
 *     `getByRole('dialog')` resolves a visible element.
 *
 *     CLAIM 2 — The dialog carries an accessible description: the
 *     `Dialog.Content` element has a non-empty `aria-describedby` whose
 *     target element exists in the DOM and has non-empty text content
 *     (visible OR `VisuallyHidden`-wrapped). This is the bug-sensitive
 *     assertion — pre-fix code rendered `Dialog.Content` without
 *     either, leaving `aria-describedby` absent.
 *
 *     CLAIM 3 — Tier 3 credibility: the spec's pre-dialog production
 *     interaction (page navigation → connecting the library backend
 *     → clicking the production trigger / firing the dev hook) is
 *     inside the App-level `BrokenContextWrapper`, so launching the
 *     spec with `AC_BROKEN_CONTEXT=sticky-overlay|zero-width-grid|
 *     pointer-events-none-ancestor` makes one of those steps fail
 *     before the dialog ever opens. The credibility declaration at
 *     the top of this file lists the three context variants the
 *     credibility runner exercises (`tools/check-credibility.ts`
 *     spawns one process per declared variant).
 *
 * Dialog-opening discipline:
 *
 *   - SaveSetDialog opens via the production "Save to Library..."
 *     button in the LibraryPage header (`LibraryPage.tsx:381`,
 *     accessible name resolved by `getByRole('button', { name:
 *     /Save to Library/i })`).
 *
 *   - LoadSetDialog opens via the production "Load Selected Set"
 *     button (`LibraryPage.tsx:382`); the button is disabled until a
 *     set is selected, so the spec first seeds a set into OPFS,
 *     connects the backend, then clicks the seeded set's row in the
 *     SetsSection before clicking the Load button.
 *
 *   - CreateDirectoryDialog + RenameDirectoryDialog open via the
 *     dev-only window hooks
 *     `window.__libraryPageTestHooks.openCreateDirectoryDialog()` /
 *     `openRenameDirectoryDialog()`. These hooks were added in the
 *     #429 remediation commit because the dialogs are orphan
 *     components with no production trigger; the hooks route through
 *     local mount state in LibraryPage so the rendered dialogs are the
 *     exact production components under test (sharing the same
 *     `Dialog.Description` fix). Production builds tree-shake the
 *     hook installation entirely because the `useEffect` is gated on
 *     `import.meta.env.DEV`. Mirrors the precedent set by
 *     `__libraryPageTestHooks.openImportSamplesDialog` (used by
 *     `import-samples-dialog.in-context.spec.ts`).
 *
 * Selector discipline — Tier 3 contract enforced by
 * `@audiocontrol/eslint-plugin-test-discipline`:
 *
 *   - Accessible queries only (`getByRole` / `getByText`).
 *   - Real pointer events via `page.mouse.*` (zero-arg
 *     `locator.click()` is forbidden).
 *   - No `getByTestId(...)` / `[data-testid=...]`.
 *
 *   The "Save to Library..." and "Load Selected Set" buttons currently
 *   carry `data-testid` attributes for the wiring suite, but their
 *   accessible name (button text) is the canonical Tier 3 selector
 *   path. Likewise, the SetsSection row is resolved by `getByText` on
 *   the seeded set name rather than by `data-testid`.
 *
 * Fixture state:
 *
 *   The page mounts with `?midi=simulated&scenario=load-everything`
 *   so DeviceMemoryPanel populates with real tone + patch entries —
 *   matches the precedent set by `import-samples-dialog.in-context.spec.ts`.
 *   The LoadSet test additionally seeds a minimal `set.yaml` under
 *   OPFS so the SetsSection has a row to select.
 */
import { test, expect, type Page } from '@playwright/test';
// Reuse the Tier 2 contract helper — same env-var → URL-param
// translation pattern as the sibling in-context specs.
import { brokenHarnessUrl } from '../contract/_credibility-url';

const LIBRARY_URL =
  '/roland/s330/editor/library?midi=simulated&scenario=load-everything';

/**
 * Connect the OPFS library backend so the LibraryPage swaps the
 * "Not Connected" empty state for the populated library tree and
 * enables the header buttons. Mirrors the helper in
 * `import-samples-dialog.in-context.spec.ts`. Driven through
 * `page.mouse.*` per the Tier 3 selector contract.
 */
async function connectLibrary(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: /Browser Storage/i });
  await expect(button).toBeVisible({ timeout: 5_000 });
  const buttonBox = await button.boundingBox();
  expect(buttonBox, 'Browser Storage button must have a bounding box').not.toBeNull();
  if (buttonBox === null) {
    throw new Error('Browser Storage button boundingBox returned null');
  }
  await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  await expect(page.getByText(/^Sets$/, { exact: true }).first()).toBeVisible({
    timeout: 5_000,
  });
}

/**
 * Clear OPFS for the current origin so each test starts from a known
 * empty library. Inlined here (rather than imported from
 * `test/wiring/library-flows-helpers.ts`) because Tier 3 specs may
 * not import from `test/wiring/` (the wiring helpers reach into
 * `test/e2e/fixtures/` which Tier 3 isolation forbids).
 */
async function cleanupOPFS(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (!('storage' in navigator) || typeof navigator.storage.getDirectory !== 'function') {
      throw new Error('OPFS not available — test environment cannot satisfy library-dialog specs');
    }
    const root = await navigator.storage.getDirectory();
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
 * Seed a minimal valid `set.yaml` under `library/s330/sets/<setName>/`
 * so the SetsSection lists a clickable row. Same shape as the wiring
 * suite's helper; inlined here per the cleanupOPFS rationale above.
 */
async function seedOPFSSetManifest(page: Page, setName: string): Promise<void> {
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
 * Drive a real pointer click through the page's center coordinates.
 * Tier 3 forbids zero-arg `locator.click()`; this helper centralises
 * the `mouse.move / down / up` ceremony so each test block stays
 * readable.
 */
async function clickByPointer(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
}

/**
 * Verify the dialog's accessible description contract:
 *   1. `getByRole('dialog')` resolves and is visible.
 *   2. The dialog element carries a non-empty `aria-describedby`.
 *   3. The element referenced by `aria-describedby` exists in the DOM
 *      and has non-empty trimmed text content.
 *
 * Radix Dialog auto-wires `aria-describedby` from a `Dialog.Description`
 * child (visible or `VisuallyHidden.Root`-wrapped); pre-fix code
 * omitted both, leaving the attribute unset and triggering the runtime
 * warning. Asserting the linked element has non-empty text catches
 * regressions where the attribute is present but its target was
 * removed (a separate failure mode that pure-attribute checks miss).
 */
async function assertDialogHasAccessibleDescription(
  page: Page,
  dialogLabel: string,
): Promise<void> {
  const dialog = page.getByRole('dialog');
  await expect(dialog, `${dialogLabel}: dialog must be visible`).toBeVisible({
    timeout: 5_000,
  });
  await expect(
    dialog,
    `${dialogLabel}: Dialog.Content must carry a non-empty aria-describedby (Radix wires this from <Dialog.Description>)`,
  ).toHaveAttribute('aria-describedby', /\S+/, { timeout: 5_000 });

  const descriptionText = await dialog.evaluate((el) => {
    if (!(el instanceof HTMLElement)) {
      throw new Error(`dialog is not an HTMLElement: ${el.tagName}`);
    }
    const id = el.getAttribute('aria-describedby');
    if (id === null || id.trim() === '') return null;
    const description = document.getElementById(id);
    if (description === null) return null;
    return (description.textContent ?? '').trim();
  });
  expect(
    descriptionText,
    `${dialogLabel}: aria-describedby must reference an element that exists in the DOM`,
  ).not.toBeNull();
  expect(
    descriptionText,
    `${dialogLabel}: Dialog.Description target element must have non-empty trimmed text content`,
  ).not.toBe('');
}

test.describe('Library-dialog family Dialog.Description — Tier 3 in-context (#429 / LIVE-S550-LIB-001)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(brokenHarnessUrl(LIBRARY_URL), { waitUntil: 'networkidle' });
    await cleanupOPFS(page);
  });

  test('D-LIB-10: SaveSetDialog renders an accessible description', async ({ page }) => {
    // Connect OPFS so the "Save to Library..." header button enables.
    // Under a broken context the connect fails (sticky-overlay
    // occludes the button; zero-width-grid collapses it; pointer-
    // events-none-ancestor blocks the click) — that's the credibility
    // gate the broken-context declaration lists.
    await connectLibrary(page);

    // Click the "Save to Library..." button — production trigger.
    // The button's accessible name is its visible text; the regex
    // pins the substring "Save to Library" without depending on the
    // ellipsis or any trailing punctuation drift.
    const saveButton = page.getByRole('button', { name: /Save to Library/i });
    await expect(saveButton).toBeVisible({ timeout: 5_000 });
    await expect(saveButton).toBeEnabled({ timeout: 5_000 });
    const saveBox = await saveButton.boundingBox();
    expect(saveBox, 'Save to Library button must have a bounding box').not.toBeNull();
    if (saveBox === null) {
      throw new Error('saveButton boundingBox returned null after expect');
    }
    await clickByPointer(page, saveBox.x + saveBox.width / 2, saveBox.y + saveBox.height / 2);

    await assertDialogHasAccessibleDescription(page, 'SaveSetDialog');
  });

  test('D-LIB-11: LoadSetDialog renders an accessible description', async ({ page }) => {
    // LoadSet requires a selected set; seed one into OPFS before
    // connecting so SetsSection lists it after the backend mounts.
    await seedOPFSSetManifest(page, 'in-context-stub');
    await connectLibrary(page);

    // Select the seeded set so the "Load Selected Set" button enables.
    // SetsSection renders each set as a clickable row whose visible
    // text is the set name; `getByText` resolves it without leaning
    // on testids.
    const setRow = page.getByText('in-context-stub', { exact: true }).first();
    await expect(setRow).toBeVisible({ timeout: 5_000 });
    const rowBox = await setRow.boundingBox();
    expect(rowBox, 'seeded set row must have a bounding box').not.toBeNull();
    if (rowBox === null) {
      throw new Error('setRow boundingBox returned null after expect');
    }
    await clickByPointer(page, rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);

    // Click the "Load Selected Set" button — production trigger.
    const loadButton = page.getByRole('button', { name: /Load Selected Set/i });
    await expect(loadButton).toBeVisible({ timeout: 5_000 });
    await expect(loadButton).toBeEnabled({ timeout: 5_000 });
    const loadBox = await loadButton.boundingBox();
    expect(loadBox, 'Load Selected Set button must have a bounding box').not.toBeNull();
    if (loadBox === null) {
      throw new Error('loadButton boundingBox returned null after expect');
    }
    await clickByPointer(page, loadBox.x + loadBox.width / 2, loadBox.y + loadBox.height / 2);

    await assertDialogHasAccessibleDescription(page, 'LoadSetDialog');
  });

  test('D-LIB-XX1: CreateDirectoryDialog renders an accessible description', async ({ page }) => {
    // The dialog is an orphan component (no production trigger). Open
    // it via the dev-only window hook — the LibraryPage mounts the
    // hook in `useEffect` gated on `import.meta.env.DEV`. Production
    // builds tree-shake the hook entirely; this spec relies on the
    // dev-mode harness picking up the hook for verification.
    //
    // Connect the library backend first so the page is in its fully
    // populated state — same precondition the other in-context specs
    // wait on. This also keeps the credibility gate intact: the
    // backend-connect click is the pre-dialog production interaction
    // that fails under a broken context.
    await connectLibrary(page);

    await page.evaluate(() => {
      const hooks = window.__libraryPageTestHooks;
      if (!hooks || !hooks.openCreateDirectoryDialog) {
        throw new Error(
          '__libraryPageTestHooks.openCreateDirectoryDialog missing — LibraryPage must have mounted in dev mode',
        );
      }
      hooks.openCreateDirectoryDialog('tones', []);
    });

    await assertDialogHasAccessibleDescription(page, 'CreateDirectoryDialog');
  });

  test('D-LIB-XX2: RenameDirectoryDialog renders an accessible description', async ({ page }) => {
    // Same dev-hook approach as CreateDirectoryDialog above (orphan
    // component; no production trigger).
    await connectLibrary(page);

    await page.evaluate(() => {
      const hooks = window.__libraryPageTestHooks;
      if (!hooks || !hooks.openRenameDirectoryDialog) {
        throw new Error(
          '__libraryPageTestHooks.openRenameDirectoryDialog missing — LibraryPage must have mounted in dev mode',
        );
      }
      hooks.openRenameDirectoryDialog('tones', ['my-folder']);
    });

    await assertDialogHasAccessibleDescription(page, 'RenameDirectoryDialog');
  });
});
