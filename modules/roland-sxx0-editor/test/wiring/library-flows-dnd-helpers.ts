/**
 * DnD-specific helpers for the Wave 5 library DnD spec
 * (`library-flows-dnd.spec.ts`).
 *
 * The Wave 4 helpers (library-flows-helpers.ts) own OPFS seeding for
 * library content. This file owns:
 *   - Device-side state injection via `window.__deviceDataStore`
 *     (LibraryPage's `handleLoadDeviceData` byte stream diverges from
 *     the `load-everything` simulated-MIDI fixture — see
 *     `library-flows.spec.ts` D-LIB-05 commentary — so direct
 *     state-store population is the simplest way to surface "loaded"
 *     tone/patch slots for D-LIB-06/07).
 *   - The Playwright-recommended HTML5 DnD round-trip helper.
 *
 * The store is intentionally exposed on `window` by
 * `modules/roland-sxx0-editor/src/stores/deviceDataStore.ts:174-176`
 * "for E2E testing" — using it here is the documented contract.
 */
import { expect, type Page, type Locator } from '@playwright/test';

// =========================================================================
// Device-side state injection
// =========================================================================

/**
 * Minimal `SamplerTone` shape suitable for surfacing a tone-slot row as
 * "loaded" in `DeviceMemoryPanel`. The dialog opened by
 * `handleDropDeviceTone` reads `tone.name`, `tone.sampleRate`,
 * `tone.loopMode`, `tone.originalKey`, and `tone.tvf.enabled` — every
 * other field on `SSeriesBaseTone` is unused at the affordance under
 * test (the export round-trip needs more, but D-LIB-06 stops at mount).
 *
 * The shape is constructed in `page.evaluate` so it doesn't need to be
 * referenced from the production tone factory — that factory imports
 * device-specific encoding helpers we don't want to drag into the test
 * harness.
 */
const DUMMY_TONE_SCRIPT = `
  ({ slot, name }) => {
    const store = window.__deviceDataStore;
    if (!store) {
      throw new Error('__deviceDataStore missing — production exposes it on window for E2E');
    }
    const tone = {
      name,
      outputAssign: 0,
      sourceTone: 0,
      origSubTone: 0,
      sampleRate: '30kHz',
      originalKey: 60,
      wave: {
        bank: 0,
        segmentTop: 0,
        segmentLength: 1,
        startPoint: 0,
        endPoint: 1023,
        loopPoint: 0,
        loopLength: 1023,
      },
      loopMode: 'one-shot',
      lfo: { rate: 0, depth: 0, delay: 0, sync: 'off', waveform: 'triangle' },
      transpose: 0,
      fineTune: 0,
      tvf: { enabled: false, cutoff: 127, resonance: 0, keyFollow: 0,
             envDepth: 0, envVelocity: 0, env: { t1: 0, t2: 0, t3: 0, t4: 0,
             l1: 0, l2: 0, l3: 0, l4: 0 } },
      tva: { env: { t1: 0, t2: 0, t3: 0, t4: 0, l1: 127, l2: 127, l3: 127, l4: 0 },
             envVelocity: 0, level: 127, pan: 0 },
      benderEnabled: false,
      aftertouchEnabled: false,
      pitchFollow: false,
      recThreshold: 0,
      recPreTrigger: 0,
      loopTune: 0,
      envZoom: 0,
      copySource: 0,
    };
    store.getState().setTone(slot, tone, 32);
    store.getState().markToneBankLoaded(Math.floor(slot / 8));
  }
`;

const DUMMY_PATCH_SCRIPT = `
  ({ slot, name }) => {
    const store = window.__deviceDataStore;
    if (!store) {
      throw new Error('__deviceDataStore missing — production exposes it on window for E2E');
    }
    // PatchCommon shape — every field is referenced somewhere in the
    // export path. The export-patch flow reads patch.common.name and
    // iterates tone-layer references; we leave the layers empty so the
    // dependency list is empty (matches the basic-sine fixture choice).
    const patch = {
      common: {
        name,
        benderRange: 2,
        aftertouchSens: 64,
        keyMode: 'normal',
        velocityThreshold: 64,
        toneLayer1: new Array(48).fill(0),
        toneLayer2: new Array(48).fill(0),
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
    store.getState().setPatch(slot, patch, 16);
    store.getState().markPatchBankLoaded(Math.floor(slot / 8));
  }
`;

/**
 * Inject a tone into the device data store at the given slot. The slot
 * row in `DeviceMemoryPanel` will surface as "loaded" (the `draggable`
 * predicate is `!!tone`).
 *
 * Uses script-string evaluate so the function body doesn't need to be
 * type-checked against the device-side tone shape from a test seam.
 */
export async function seedDeviceTone(
  page: Page,
  options: { slot: number; name?: string } = { slot: 0 },
): Promise<void> {
  const name = options.name ?? `Tone${options.slot + 1}`;
  await page.evaluate(
    new Function('args', `(${DUMMY_TONE_SCRIPT})(args)`) as (a: unknown) => unknown,
    { slot: options.slot, name },
  );
}

/**
 * Inject a patch into the device data store at the given slot.
 */
export async function seedDevicePatch(
  page: Page,
  options: { slot: number; name?: string } = { slot: 0 },
): Promise<void> {
  const name = options.name ?? `Patch${options.slot + 1}`;
  await page.evaluate(
    new Function('args', `(${DUMMY_PATCH_SCRIPT})(args)`) as (a: unknown) => unknown,
    { slot: options.slot, name },
  );
}

// =========================================================================
// DnD round-trip helper
// =========================================================================

/**
 * Perform a Playwright-recommended HTML5 DnD round-trip from a source
 * Locator to a target Locator. The shared `DataTransfer` handle lets
 * production's `onDragStart` write the MIME payload and `onDrop` read
 * it — the round-trip exercises real production code, not a synthetic
 * harness. Documented pattern:
 * https://playwright.dev/docs/input#drag-and-drop
 */
export async function simulateDragAndDrop(
  page: Page,
  source: Locator,
  target: Locator,
): Promise<void> {
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent('dragstart', { dataTransfer });
  await target.dispatchEvent('dragenter', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });
  await source.dispatchEvent('dragend', { dataTransfer });
}

// =========================================================================
// Device-slot locators
// =========================================================================

/**
 * Locator for the device tone slot row whose label matches `slotLabel`
 * (e.g. "T11"). Scoped to the C-LIB-02 device-memory region so the same
 * label in PreviewPanel / SetsSection / ToneSlotMap doesn't collide.
 */
export function deviceToneSlot(page: Page, slotLabel: string): Locator {
  return page
    .locator('[data-capability="C-LIB-02"]')
    .locator('div[role="button"]', {
      has: page.locator('span', { hasText: new RegExp(`^${slotLabel}$`) }),
    })
    .first();
}

/**
 * Locator for the device patch slot row. Same scope strategy as
 * `deviceToneSlot`. Patch labels are e.g. "P11", "P12".
 */
export function devicePatchSlot(page: Page, slotLabel: string): Locator {
  return page
    .locator('[data-capability="C-LIB-02"]')
    .locator('div[role="button"]', {
      has: page.locator('span', { hasText: new RegExp(`^${slotLabel}$`) }),
    })
    .first();
}

/**
 * Locator for the panel-level sample-drop region on `DeviceMemoryPanel`.
 * The panel surfaces an accessible name via `role="region"` +
 * `aria-label="Device memory panel — drop library samples to import"`.
 */
export function devicePanelDropTarget(page: Page): Locator {
  return page.getByRole('region', {
    name: /Device memory panel — drop library samples to import/,
  });
}

/**
 * Asserts the target is visible — common pre-check before the DnD
 * helper. Kept as its own helper so a missing locator's failure points
 * at the affordance under test, not the DnD round-trip.
 */
export async function expectVisible(locator: Locator, timeoutMs = 5000): Promise<void> {
  await expect(locator).toBeVisible({ timeout: timeoutMs });
}
