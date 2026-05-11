/**
 * Tone-write capability spec — shared helpers.
 *
 * Extracted into a sibling module so the main spec file stays under
 * the 300-500 line cap. The helpers are spec-local (not exported beyond
 * the capability suite); they encode the ToneEditor's mount + tab-routing
 * contract in one place so each of the 39 tests stays focused on the
 * field it's driving rather than on plumbing.
 */
import { expect, type Page, type Locator } from '@playwright/test';
import type { SimulatedAdapterIntrospection } from '@audiocontrol/sampler-devices/recording';

/**
 * Re-declare `window.__simulatedAdapter` for the test tree. The shared
 * `SimulatedAdapterIntrospection` interface comes from
 * `@audiocontrol/sampler-devices/recording` and is the SAME type the
 * transport (`src/transports/simulatedMidiTransport.ts`) uses for the
 * matching slot. TypeScript merges the two `interface Window`
 * declarations because they're structurally identical. Adding an
 * introspection method to `SimulatedAdapter` forces a change to the
 * shared interface, which compile-fails every consumer until updated.
 */
declare global {
  interface Window {
    __simulatedAdapter?: SimulatedAdapterIntrospection;
  }
}

/**
 * Read the simulated MIDI adapter's record cursor from the page. The
 * simulated transport exposes the active adapter on
 * `window.__simulatedAdapter`; the spec reads its cursor to assert the
 * UI driver actually emitted bytes (so a silently-disabled control or
 * a missed click fails the test rather than false-passing).
 *
 * Returns `{ cursor, total }` so callers can also assert "fixture
 * fully consumed" semantics for tests where the fixture's last record
 * SHOULD be the driven outbound.
 */
export async function readSimulatedAdapterState(
  page: Page,
): Promise<{ cursor: number; total: number }> {
  const state = await page.evaluate(() => {
    const adapter = window.__simulatedAdapter;
    if (!adapter) {
      return null;
    }
    return { cursor: adapter.getCursor(), total: adapter.getTotalRecords() };
  });
  if (!state) {
    throw new Error('readSimulatedAdapterState: window.__simulatedAdapter not set; the test scenario URL must use ?midi=simulated&scenario=...');
  }
  return state;
}

/**
 * Assert the simulated adapter consumed the fixture in full (cursor at
 * the end). Used as the canonical positive assertion after a UI action:
 * if the action emitted no bytes (silently disabled control, missed
 * click, dropped event), the cursor stays short of the total and the
 * test fails loudly rather than false-passing.
 *
 * Uses `expect.poll` so the assertion is robust against the async path
 * from React onCommit → Zustand store update → useEffect → adapter.send.
 * Polls every ~100ms until the cursor reaches total or the timeout
 * trips. The failure message names the actual cursor/total to make
 * debugging quick.
 */
export async function expectFixtureFullyConsumed(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const { cursor, total } = await readSimulatedAdapterState(page);
        return cursor === total ? 'consumed' : `cursor=${cursor}/total=${total}`;
      },
      {
        timeout: 5_000,
        message:
          'SimulatedAdapter did not consume the full fixture — the UI driver emitted fewer bytes than the fixture captured. ' +
          'Most likely cause: the target control is disabled or the locator missed.',
      },
    )
    .toBe('consumed');
}

/** Tab IDs used by the CSS-only radio-tab shell in ToneEditorTabs.tsx. */
export type ToneTabId = 'tt-wave' | 'tt-pitch' | 'tt-filter' | 'tt-amp' | 'tt-lfo';

/** Tab display names — used to click the matching label via `role="tab"`. */
export type ToneTabName = 'Wave' | 'Pitch' | 'Filter' | 'Amp' | 'LFO';

/** Build the test URL for a tone-write capability scenario. */
export function tonesUrl(scenario: string): string {
  return `/roland/s550/editor/tones?midi=simulated&scenario=${scenario}`;
}

/**
 * Mount the page, click the first tone slot, and return the tone-editor
 * root locator. The TonesPage's `loadToneBank(0)` populates the cache;
 * the spec then clicks T11 (slot 0) to mount the ToneEditor.
 */
export async function openTone0Editor(page: Page): Promise<Locator> {
  const firstSlot = page.getByTestId('tone-item-0');
  await expect(firstSlot).toBeVisible({ timeout: 5_000 });
  await firstSlot.click();

  const editor = page.locator('[data-capability="C-TONE-04"]');
  await expect(editor).toBeVisible({ timeout: 5_000 });
  return editor;
}

/**
 * Switch the tone editor's tab strip to a named tab. The tab labels
 * carry role="tab"; clicking a label flips the matching hidden radio
 * input which reveals the panel via CSS. Wave is the default; Pitch /
 * Filter / Amp / LFO need an explicit switch.
 */
export async function switchToToneTab(
  page: Page,
  name: ToneTabName,
): Promise<void> {
  await page.getByRole('tab', { name }).click();
  const tabId: ToneTabId = `tt-${name.toLowerCase()}` as ToneTabId;
  await expect(page.locator(`[data-tab="${tabId}"]`)).toBeVisible({ timeout: 2_000 });
}

/**
 * Resolve a panel locator for one of the tone tabs. Each `<section
 * class="tones__panel" data-tab="tt-<id>">` exists in the DOM
 * unconditionally — only the active one is `display: block`. Scoping
 * by panel is required for tests targeting controls whose data-testids
 * collide across tabs (LFO Depth, Key Rate, Vel Rate exist in both
 * TVF and TVA panels).
 */
export function tonePanel(editor: Locator, tab: ToneTabId): Locator {
  return editor.locator(`[data-tab="${tab}"]`);
}

/**
 * Drive a Radix ParameterSlider to a target value with exactly one
 * onValueCommit. Same shape as patch-writes.spec.ts's helper.
 *
 * The clickable root carries `data-orientation="horizontal"`; clicking
 * at an X position within it fires onSlideStart on pointerdown (setting
 * the value linearly from the X position) and onValueCommit on
 * pointerup. The mapping is
 *   `(targetValue - min) / (max - min) = (clickX - rect.left) / rect.width`
 * (see @radix-ui/react-slider getValueFromPointer in dist/index.js).
 *
 * Pre-conditions:
 *   - The slider's wrapper MUST be scoped to the active tab panel (the
 *     spec calls `tonePanel(editor, '<tab>').getByTestId('param-...')`
 *     before passing it in).
 *   - The current slider value MUST differ from `targetValue`; if they
 *     match, Radix's onValueCommit only fires when value changed, and
 *     the test would silently emit nothing.
 */
export async function clickSliderAtValue(
  page: Page,
  wrapper: Locator,
  targetValue: number,
  min: number,
  max: number,
): Promise<void> {
  const sliderRoot = wrapper
    .locator('[data-orientation="horizontal"]')
    .first();
  await expect(sliderRoot).toBeVisible({ timeout: 5_000 });

  const box = await sliderRoot.boundingBox();
  if (!box) {
    throw new Error('clickSliderAtValue: slider root has no bounding box');
  }

  const ratio = (targetValue - min) / (max - min);
  // Inset from the edges by 1px to avoid landing exactly on the boundary
  // where rounding could resolve to the wrong step value.
  const insetX = Math.max(1, Math.min(box.width - 1, ratio * box.width));
  const clickX = box.x + insetX;
  const clickY = box.y + box.height / 2;

  await page.mouse.click(clickX, clickY);
}

/**
 * Drive a `<label hasText> + <input>` number input to a value, then
 * blur to fire onCommit for inputs that use `onChange` (the wave
 * start/loop/end fields commit on change rather than blur; the blur
 * here is defensive — fill() already fires React's change event).
 *
 * The Wave panel's three address inputs (Start / Loop Point / End)
 * carry no data-testid; we locate them by the adjacent <label>'s text.
 */
export async function fillLabeledNumber(
  panel: Locator,
  labelText: string | RegExp,
  value: string,
): Promise<void> {
  const input = panel
    .locator('label', { hasText: labelText })
    .locator('+ input');
  await input.fill(value);
  await input.blur();
}

/**
 * Drive an envelope rate/level input (8-cell row in the TVF/TVA env
 * table). Each row's first <input type="number"> commits on `onBlur`
 * — see EnvelopeEditor.tsx's rate/level <input> handlers. The captured
 * fixtures target rate[0] / level[0]; first() selects the index-0 cell.
 */
export async function fillEnvelopeFirstCell(
  panel: Locator,
  row: 'Rate' | 'Level',
  value: string,
): Promise<void> {
  const rowAnchor = new RegExp(`^${row}`);
  const input = panel
    .locator('table tbody tr')
    .filter({ hasText: rowAnchor })
    .locator('input[type="number"]')
    .first();
  await input.fill(value);
  await input.blur();
}

/**
 * Drive a `<label hasText> + <select>` select control to a value.
 * Used for the envelope's Sustain Point + End Point selects (which
 * commit on `onChange`).
 */
export async function selectLabeled(
  panel: Locator,
  labelText: string,
  value: string,
): Promise<void> {
  await panel
    .locator('label', { hasText: labelText })
    .locator('+ select')
    .selectOption({ value });
}
