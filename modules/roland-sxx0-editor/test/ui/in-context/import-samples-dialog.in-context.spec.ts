/**
 * @credibleAgainst contexts sticky-overlay zero-width-grid pointer-events-none-ancestor
 *
 * Tier 3 in-context spec for `D-LIB-14` — `ImportSamplesDialog` mounted
 * against the production LibraryPage, verifying the dialog's slot-occupancy
 * dropdown labels reflect the actual empty/occupied state of the device
 * tone + patch slots (not the always-true `!== undefined` heuristic the
 * pre-fix code shipped).
 *
 * Failure modes the spec catches:
 *   1. Page-level layering defects (sticky overlay, collapsed column,
 *      pointer-events-none ancestor) — verified by the credibility runner's
 *      `?context=<variant>` invocation. The `BrokenContextWrapper` at App
 *      level wraps the LibraryPage in the chosen broken context, which
 *      occludes / collapses / disables the page's interactive affordances.
 *      The spec's earliest production interaction (clicking the OPFS
 *      backend button or the dropdown trigger) fails under the broken
 *      context, surfacing the layering defect.
 *   2. The slot-allocation occupancy bug — verified by asserting the
 *      "Starting Tone Slot" dropdown options carry "(will overwrite)"
 *      ONLY when at least one slot in the range is actually occupied,
 *      and "(empty)" otherwise. The pre-fix code labels every option
 *      as "(will overwrite)" because the S-330 returns objects for all
 *      32 tone slots after load, so `deviceTones[i] !== undefined` is
 *      always true.
 *   3. The single-patch dropdown carries the same labeling discipline
 *      (asserted by inspecting the patch slot dropdown's options).
 *
 * Dialog-opening approach — Option (c) from the implementer brief:
 *
 * The Tier 3 contract forbids `dispatchEvent` (the wiring tests' DnD
 * helper) and `getByTestId`. Playwright's native `page.dragAndDrop` is
 * known-flaky for HTML5 DnD (see `library-flows-dnd.spec.ts:44-48`).
 * Approach (a) and (b) from the brief therefore are not viable; this
 * spec uses approach (c): the LibraryPage exposes a dev-only window
 * hook `__libraryPageTestHooks.openImportSamplesDialog(name, bundle)`
 * that routes through the same production callback the DnD path
 * eventually invokes. Production builds bypass the hook entirely (the
 * `useEffect` body is gated on `import.meta.env.DEV`, which Vite folds
 * to a literal `false` at build time and tree-shakes the body).
 *
 * Fixture state:
 *   - Tone slot 0: occupied (wave.segmentLength = 2)
 *   - Tone slots 1-3: empty (wave.segmentLength = 0)
 *   - Patch slot 0: occupied (non-blank name, layer-1 tones assigned)
 *   - Patch slots 1-3: empty (blank names, no tone assignments)
 *
 * The dialog's bundle has 2 slices (matching the `chopped-sine` fixture's
 * shape), so `toneSlotsNeeded === 2` and the dropdown's contiguous-range
 * options span pairs of slots: range@0 covers [0,1] (occupied), range@1
 * covers [1,2] (empty), range@2 covers [2,3] (empty).
 *
 * Note on the choice of LibraryPage as Tier 3 mount target:
 * D-LIB-14 (ImportSamplesDialog) is the only library-area capability whose
 * UI affordance lives entirely inside a Radix Dialog.Portal — meaning the
 * dialog's DOM escapes the App-level BrokenContextWrapper. Tier 3
 * sensitivity to `?context=<variant>` therefore comes from the spec's
 * pre-dialog production interaction (clicking the OPFS backend button to
 * connect the library, which IS inside the wrapper), not from the dialog
 * dropdowns themselves. The credibility runner exercises this seam by
 * launching the page with `?context=sticky-overlay` and verifying the
 * spec fails before the dialog ever opens.
 */
import { test, expect, type Page } from '@playwright/test';
// Reuse the Tier 2 contract helper rather than duplicate it under
// `test/ui/in-context/_credibility-url.ts`. Both tiers consume the
// identical env-var → URL-param translation (AC_BROKEN_VARIANT /
// AC_BROKEN_CONTEXT → `?broken=` / `?context=`), so a single helper
// is the right factoring. The brief's option (b) for this seam
// "Reusing avoids duplication — prefer that" is chosen here.
import { brokenHarnessUrl } from '../contract/_credibility-url';

const LIBRARY_URL =
  '/roland/s330/editor/library?midi=simulated&scenario=load-everything';

// 2-slice fixture: matches `chopped-sine` shape so `toneSlotsNeeded === 2`
// and the dropdown's range options span pairs of slots. `source` is left
// undefined so `useMonolithicMode` defaults to `false` (no +1 slot for the
// wave holder); this keeps the slot arithmetic in the spec straightforward.
const STUB_BUNDLE = {
  name: 'in-context-stub',
  sampleRate: 30000 as const,
  slices: [
    { label: 'HALF_A', startSample: 0, endSample: 500, midiNote: 60 },
    { label: 'HALF_B', startSample: 500, endSample: 1023, midiNote: 61 },
  ],
} as const;

/**
 * Connect the library backend (OPFS) so the LibraryPage swaps the
 * "Not Connected" empty state for the populated library tree. The
 * dialog hook is gated on `libraryHandle` being non-null, so the
 * backend must connect before the spec opens the dialog.
 *
 * The button carries an accessible "Browser Storage" label (via the
 * shared `LibraryConnectionUI`); querying by role+name keeps the spec
 * within the Tier 3 selector contract.
 */
async function connectLibrary(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: /Browser Storage/i });
  await expect(button).toBeVisible({ timeout: 5_000 });
  // Drive the click via page.mouse so the spec uses the same pointer
  // engine end-users do. A zero-arg `locator.click()` would be flagged
  // by the test-discipline ESLint rule (`noElementClick`); routing
  // through `page.mouse.*` is the rule's documented preferred form
  // for Tier 2/3 ("Operators relying on `locator.click()` in Tier 2/3
  // should prefer `page.mouse.*` for explicit pointer paths anyway").
  const buttonBox = await button.boundingBox();
  expect(buttonBox, 'Browser Storage button must have a bounding box').not.toBeNull();
  if (buttonBox === null) {
    throw new Error('Browser Storage button boundingBox returned null');
  }
  await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2);
  await page.mouse.down();
  await page.mouse.up();
  // Confirm the library tree mounted — the Sets section is the canonical
  // landmark surfaced by the populated LibraryPage state. The section
  // header is rendered as a `<div>` rather than a heading (matches the
  // existing wiring-test pattern at `library-flows-helpers.ts:391-392`),
  // so we query by visible text inside the library region rather than by
  // `heading` role.
  await expect(page.getByText(/^Sets$/, { exact: true }).first()).toBeVisible({
    timeout: 5_000,
  });
}

/**
 * Seed device data via `window.__deviceDataStore` so:
 *   - tone slot 0 has wave data (segmentLength = 2)
 *   - tone slots 1-3 are loaded-but-empty (segmentLength = 0)
 *   - patch slot 0 has a non-blank name + layer-1 tone assignments
 *   - patch slots 1-3 are loaded-but-empty (blank names, no assignments)
 *
 * The store is exposed on `window` by production code (see
 * `src/stores/deviceDataStore.ts` — the `Window.__deviceDataStore`
 * augmentation declaration and its assignment inside the
 * `if (typeof window !== 'undefined')` guard) "for E2E testing" —
 * using it here is the documented contract (mirrors the wiring-test
 * pattern in `library-flows-dnd-helpers.ts`).
 *
 * The values inside the seeded tone/patch objects are minimum-viable —
 * the dropdown labeling only inspects `wave.segmentLength` (via
 * `isToneEmpty`) and `common.name` / `common.toneLayer1` (via
 * `isPatchEmpty`). Other fields default to spec-arbitrary zeros.
 */
async function seedDeviceData(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = window.__deviceDataStore;
    if (!store) {
      throw new Error(
        '__deviceDataStore missing — production exposes it on window for E2E (see the Window.__deviceDataStore augmentation in src/stores/deviceDataStore.ts)',
      );
    }
    const baseTone = (segmentLength: number, name: string): Record<string, unknown> => ({
      name,
      outputAssign: 0,
      sourceTone: 0,
      origSubTone: 0,
      sampleRate: '30kHz',
      originalKey: 60,
      wave: {
        bank: 0,
        segmentTop: 0,
        segmentLength,
        startPoint: 0,
        endPoint: 1023,
        loopPoint: 0,
        loopLength: 1023,
      },
      loopMode: 'one-shot',
      lfo: { rate: 0, depth: 0, delay: 0, sync: 'off', waveform: 'triangle' },
      transpose: 0,
      fineTune: 0,
      tvf: {
        enabled: false, cutoff: 127, resonance: 0, keyFollow: 0,
        envDepth: 0, envVelocity: 0,
        env: { t1: 0, t2: 0, t3: 0, t4: 0, l1: 0, l2: 0, l3: 0, l4: 0 },
      },
      tva: {
        env: { t1: 0, t2: 0, t3: 0, t4: 0, l1: 127, l2: 127, l3: 127, l4: 0 },
        envVelocity: 0, level: 127, pan: 0,
      },
      benderEnabled: false,
      aftertouchEnabled: false,
      pitchFollow: false,
      recThreshold: 0,
      recPreTrigger: 0,
      loopTune: 0,
      envZoom: 0,
      copySource: 0,
    });
    const occupiedTone = baseTone(2, 'OCCUPIED');
    // Loaded-but-empty: object exists in the array (so `!== undefined` is
    // true) but `segmentLength === 0` (so `isToneEmpty` returns true).
    // This is the post-device-load shape that triggers the bug.
    const emptyTone0 = baseTone(0, '');
    const emptyTone1 = baseTone(0, '');
    const emptyTone2 = baseTone(0, '');
    const setTone = store.getState().setTone;
    setTone(0, occupiedTone, 32);
    setTone(1, emptyTone0, 32);
    setTone(2, emptyTone1, 32);
    setTone(3, emptyTone2, 32);
    store.getState().markToneBankLoaded(0);

    // `Array.from({ length }, () => -1)` instead of `new Array(48).fill(-1)`
    // because the test-discipline ESLint rule flags every `.fill()` call as
    // a Playwright shortcut (no AST-level discrimination of
    // Array.prototype.fill vs locator.fill). The spec lives under
    // `test/ui/in-context/` which is linted by that rule; the helper below
    // produces the same `-1`-filled length-48 array via `Array.from`'s
    // generator overload.
    const layerEmpty = (): number[] => Array.from({ length: 48 }, () => -1);
    const layerWithFirstZero = (): number[] =>
      Array.from({ length: 48 }, (_, i) => (i === 0 ? 0 : -1));

    const occupiedPatch = {
      common: {
        name: 'KICK PATCH',
        benderRange: 2,
        aftertouchSens: 64,
        keyMode: 'normal',
        velocityThreshold: 64,
        // toneLayer1 has at least one non-negative assignment → isPatchEmpty false
        toneLayer1: layerWithFirstZero(),
        toneLayer2: layerEmpty(),
        copySource: 0,
        octaveShift: 0,
        level: 127,
        detune: 0,
        velocityMixRatio: 64,
        aftertouchAssign: 'modulation',
        keyAssign: 'rotary',
        outputAssign: 8,
      },
    };
    const emptyPatch = (): typeof occupiedPatch => ({
      common: {
        // Blank name + no tone assignments → isPatchEmpty true
        name: '',
        benderRange: 2,
        aftertouchSens: 64,
        keyMode: 'normal',
        velocityThreshold: 64,
        toneLayer1: layerEmpty(),
        toneLayer2: layerEmpty(),
        copySource: 0,
        octaveShift: 0,
        level: 127,
        detune: 0,
        velocityMixRatio: 64,
        aftertouchAssign: 'modulation',
        keyAssign: 'rotary',
        outputAssign: 8,
      },
    });
    const setPatch = store.getState().setPatch;
    setPatch(0, occupiedPatch, 16);
    setPatch(1, emptyPatch(), 16);
    setPatch(2, emptyPatch(), 16);
    setPatch(3, emptyPatch(), 16);
    store.getState().markPatchBankLoaded(0);
  });
}

/**
 * Open the ImportSamplesDialog via the dev-only window hook on
 * LibraryPage. The hook is mounted by the LibraryPage's `useEffect`
 * (gated on `import.meta.env.DEV`) and routes through the same
 * production callback the DnD path eventually invokes.
 */
async function openDialog(page: Page): Promise<void> {
  await page.evaluate((bundle) => {
    const hooks = window.__libraryPageTestHooks;
    if (!hooks || !hooks.openImportSamplesDialog) {
      throw new Error(
        '__libraryPageTestHooks.openImportSamplesDialog missing — LibraryPage must have mounted in dev mode',
      );
    }
    hooks.openImportSamplesDialog('in-context-stub', bundle);
  }, STUB_BUNDLE);
}

test.describe('ImportSamplesDialog — Tier 3 in-context (D-LIB-14)', () => {
  test('D-LIB-14: dropdown labels reflect actual occupancy after device load', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(brokenHarnessUrl(LIBRARY_URL), { waitUntil: 'networkidle' });

    // ── Setup ────────────────────────────────────────────────────────
    // Connect the library backend. Under a broken context this fails
    // (sticky-overlay occludes the button; zero-width-grid collapses it
    // to 0 px; pointer-events-none-ancestor disables clicks). That's
    // what makes the spec credible against context-level defects.
    await connectLibrary(page);

    // Seed device data: slot 0 occupied, slots 1-3 loaded-but-empty.
    await seedDeviceData(page);

    // Open the dialog via the dev hook (see file header for rationale).
    await openDialog(page);

    // ── CLAIM 1: Reachability — dialog mounted, dropdown visible. ─────
    // The dialog's title is the canonical accessible landmark; the
    // "Starting Tone Slot" dropdown is the bug's primary surface.
    // V3-IMPORT (#450): title migrated to sentence-case ("Import samples")
    // matching the v3 design language convention shared with the
    // Export* family ("Export tone to library").
    const heading = page.getByRole('heading', { name: /^Import samples$/ });
    await expect(heading).toBeVisible({ timeout: 5_000 });

    const toneDropdown = page.getByLabel(/Starting Tone Slot/);
    await expect(toneDropdown).toBeVisible();

    // V3-IMPORT (#450): the dialog is now a right-edge SlideDrawer
    // with a sticky footer (`.ac-drawer-footer`). The "Starting Tone
    // Slot" dropdown sits inside the drawer's scrollable body
    // (`.ac-drawer-content`); without scrolling, it can render under
    // the footer's z-index. Scroll the dropdown into the drawer body's
    // viewport before the reachability check so the assertion
    // measures dropdown occlusion (the real signal) rather than
    // sticky-footer overlap (an expected design-system behavior).
    await toneDropdown.scrollIntoViewIfNeeded();

    // Reachability via elementFromPoint: the center of the dropdown's
    // bounding box must be the dropdown itself (or a descendant), not
    // an overlay. The SlideDrawer renders inline (no Portal) so the
    // assertion still confirms the dialog tree isn't occluded by
    // anything OUTSIDE the dialog or above the dropdown within it.
    const box = await toneDropdown.boundingBox();
    expect(box, 'dropdown must have a bounding box').not.toBeNull();
    if (box === null) {
      throw new Error('toneDropdown boundingBox returned null after expect().not.toBeNull()');
    }
    expect(box.width, 'dropdown must have positive width').toBeGreaterThan(8);
    expect(box.height, 'dropdown must have positive height').toBeGreaterThan(8);

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const isReachable = await page.evaluate(
      ({ x, y }) => {
        const top = document.elementFromPoint(x, y);
        if (top === null) return { reachable: false, stack: [] as string[] };
        const isDropdown =
          top.tagName === 'SELECT' ||
          top.closest('select') !== null;
        return {
          reachable: isDropdown,
          stack: document
            .elementsFromPoint(x, y)
            .slice(0, 4)
            .map((el) => `${el.tagName}.${el.className.toString().slice(0, 40)}`),
        };
      },
      { x: centerX, y: centerY },
    );
    expect(
      isReachable.reachable,
      `dropdown must be the top element at its center — actually got ${JSON.stringify(isReachable.stack)}`,
    ).toBe(true);

    // ── CLAIM 2: Label correctness — the bug-sensitive assertion. ────
    // Pull all option labels out of the dropdown. The bug labels every
    // option as "(will overwrite)" because the pre-fix code uses
    // `deviceTones[i] !== undefined` (always true post-load). The fix
    // routes through `hasOccupiedToneRange`, so only the range@0 option
    // (covering slot 0 = occupied) carries "(will overwrite)"; the
    // range@1 and range@2 options (covering empty slots) carry "(empty)".
    const toneOptionTexts = await toneDropdown.evaluate((el) => {
      if (!(el instanceof HTMLSelectElement)) {
        throw new Error(`tone dropdown is not a <select>: ${el.tagName}`);
      }
      return Array.from(el.options).map((opt) => opt.textContent ?? '');
    });
    // toneSlotsNeeded = 2; ranges span [0,1], [1,2], [2,3], …
    expect(toneOptionTexts.length, 'tone dropdown must offer at least 3 range options').toBeGreaterThanOrEqual(3);

    // Range@0 covers [0, 1] — slot 0 occupied → must say "(will overwrite)"
    expect(
      toneOptionTexts[0],
      'tone range starting at slot 0 must label "(will overwrite)" (slot 0 is occupied in the fixture)',
    ).toContain('(will overwrite)');

    // Range@1 covers [1, 2] — both empty → must say "(empty)"
    expect(
      toneOptionTexts[1],
      'tone range starting at slot 1 must label "(empty)" (slots 1+2 are loaded-but-empty)',
    ).toContain('(empty)');

    // Range@2 covers [2, 3] — both empty → must say "(empty)"
    expect(
      toneOptionTexts[2],
      'tone range starting at slot 2 must label "(empty)" (slots 2+3 are loaded-but-empty)',
    ).toContain('(empty)');

    // ── CLAIM 3: Patch slot dropdown carries the same labeling. ──────
    // The dialog defaults to `singlePatch = true`, so the "Patch Slot"
    // dropdown renders the single-slot path (the bug site at line 413
    // of ImportSamplesDialog.tsx). Patch slot 0 is occupied, slots 1-3
    // are loaded-but-empty.
    const patchDropdown = page.getByLabel(/^Patch Slot$/);
    await expect(patchDropdown).toBeVisible();
    const patchOptionTexts = await patchDropdown.evaluate((el) => {
      if (!(el instanceof HTMLSelectElement)) {
        throw new Error(`patch dropdown is not a <select>: ${el.tagName}`);
      }
      return Array.from(el.options).map((opt) => opt.textContent ?? '');
    });
    expect(patchOptionTexts.length, 'patch dropdown must offer all patch slots').toBeGreaterThanOrEqual(4);
    expect(
      patchOptionTexts[0],
      'patch slot 0 must label "(will overwrite)" (KICK PATCH occupies slot 0)',
    ).toContain('(will overwrite)');
    expect(
      patchOptionTexts[1],
      'patch slot 1 must label "(empty)" (loaded-but-empty)',
    ).toContain('(empty)');
    expect(
      patchOptionTexts[2],
      'patch slot 2 must label "(empty)" (loaded-but-empty)',
    ).toContain('(empty)');
    expect(
      patchOptionTexts[3],
      'patch slot 3 must label "(empty)" (loaded-but-empty)',
    ).toContain('(empty)');
  });
});
