/**
 * Tone-write capability spec — shared helpers.
 *
 * Extracted into a sibling module so the main spec file stays under
 * the 300-500 line cap. The helpers are spec-local (not exported beyond
 * the capability suite); they encode the ToneEditor's mount + tab-routing
 * contract in one place so each of the 39 tests stays focused on the
 * field it's driving rather than on plumbing.
 *
 * Phase 9 Task 4 TonesPage amend rewrote the per-control helpers to
 * drive the v3 atomic primitives:
 *   - `clickSliderAtValue` (Radix-track-click) → `fillSliderInput`
 *     (page.fill on the AcNumberInput's editable `<input type="number">`).
 *   - Envelope rate/level row → driven via `[data-edit-row]` attribute
 *     on the new ToneEnvelopeEditor's inline edit grid.
 *   - Envelope sustain/end selects → pip clicks on the AcEnvelopeMeta
 *     radiogroup rows (`role="radiogroup"` + `[role="radio"]`).
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
export type ToneTabId = 'tt-wave' | 'tt-pitch-lfo' | 'tt-filter' | 'tt-amp';

/** Tab display names — used to click the matching label via `role="tab"`. */
export type ToneTabName = 'Wave' | 'Pitch & LFO' | 'Filter' | 'Amp';

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
 * input which reveals the panel via CSS. Wave is the default; the
 * other three tabs ("Pitch & LFO" / Filter / Amp) need an explicit
 * switch.
 */
const TAB_ID_BY_NAME: Record<ToneTabName, ToneTabId> = {
  'Wave': 'tt-wave',
  'Pitch & LFO': 'tt-pitch-lfo',
  'Filter': 'tt-filter',
  'Amp': 'tt-amp',
};

export async function switchToToneTab(
  page: Page,
  name: ToneTabName,
): Promise<void> {
  await page.getByRole('tab', { name }).click();
  const tabId = TAB_ID_BY_NAME[name];
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
 * Drive a v3 AcSlider row (rendered via ParamSliderRow) to a target
 * value with exactly one outbound write. The wrapper is the
 * `<div data-testid="param-...">` that encloses the row; inside is the
 * `<AcNumberInput editable>` `<input type="number">` (the focusable
 * affordance — `AcSlider`'s bar is display-only per DESIGN-SYSTEM.md).
 *
 * Same shape as patch-writes.spec.ts's `fillSliderInput`. `page.fill`
 * clears the existing value and types the new one in one atomic step —
 * Playwright dispatches a single `input` event with the final value
 * (verified in `Locator.fill` source). The onChange handler on
 * `AcNumberInput` parses + clamps the value and the row's onChange
 * streams it to the device.
 *
 * Pre-conditions:
 *   - The input must not be `disabled` (caller must enable conditional
 *     sliders by toggling the matching enable-flag first).
 *   - The current value should differ from `targetValue`; React's
 *     controlled-input no-op skips an onChange dispatch if the new
 *     value matches the prop. The tone-write fixtures all set values
 *     that differ from the loaded tone's defaults, so this is
 *     satisfied in practice.
 */
export async function fillSliderInput(
  wrapper: Locator,
  targetValue: number,
): Promise<void> {
  const input = wrapper.locator('input[type="number"]').first();
  await expect(input).toBeVisible({ timeout: 5_000 });
  await input.fill(String(targetValue));
  // Blur to ensure React's controlled-input change cycle completes and
  // any downstream effect handlers settle before the spec's
  // expectFixtureFullyConsumed assertion runs.
  await input.blur();
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
 * Drive an envelope rate/level input in the inline edit grid below the
 * v3 AcEnvelope visualization. Each `<div data-edit-row="rate|level">`
 * carries 8 `<input type="number">` children; the captured fixtures
 * target index 0 (`.first()`). Commits on `onBlur`.
 */
export async function fillEnvelopeFirstCell(
  panel: Locator,
  row: 'Rate' | 'Level',
  value: string,
): Promise<void> {
  const editRow = row === 'Rate' ? 'rate' : 'level';
  const input = panel
    .locator(`[data-edit-row="${editRow}"] input[type="number"]`)
    .first();
  await input.fill(value);
  await input.blur();
}

/**
 * Drive the envelope's Sustain / End pip-radio group to a target
 * 1-based segment index by clicking the `i`-th pip. AcEnvelopeMeta
 * renders the rows as `<div role="radiogroup" aria-label="Sustain
 * segment">` / `<aria-label="Envelope length">`; pips are
 * `<span role="radio">` with the displayed number `i` as text content
 * and a roving tabindex. Clicking the pip fires
 * `onSustainChange(i)` / `onEndChange(i)`, which ToneEnvelopeEditor
 * routes back to the SamplerEnvelope's 0-based `sustainPoint` (i-1)
 * or 1-based `endPoint` (i).
 *
 * The radiogroup is scoped by its `aria-label` because the two rows
 * coexist in the same envelope and use the same role for both.
 */
export async function selectEnvelopePip(
  panel: Locator,
  kind: 'sustain' | 'end',
  uiIndex: number,
): Promise<void> {
  const groupLabel = kind === 'sustain' ? 'Sustain segment' : 'Envelope length';
  const group = panel.locator(`[aria-label="${groupLabel}"]`).first();
  await expect(group).toBeVisible({ timeout: 5_000 });
  const pip = group.locator(`[role="radio"]`).nth(uiIndex - 1);
  await pip.click();
}
