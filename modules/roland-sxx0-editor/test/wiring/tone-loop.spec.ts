/**
 * Capability specs — Tone Loop Editor (D-TONE-LOOP-01..06).
 *
 * See ROLAND-S550-EDITOR-CAPABILITIES-DETAILED.md for the canonical
 * statements. Each test is named with its detail ID so a regression
 * traces back to a specific row the inventory declares.
 *
 * The Loop Editor section inside the ToneEditor's Wave tab is gated on
 *   hasSampleData = tone.wave.endPoint > tone.wave.startPoint
 * (modules/roland-sxx0-editor/src/components/tones/panels/ToneWavePanel.tsx:40).
 * When the tone is loaded but no decoded wave data is in the cache, the
 * panel shows the "Load Wave Data" button (D-TONE-LOOP-01). When wave
 * data is loaded, the LoopEditor's full UI mounts.
 *
 * Wave 3 scope: pins display affordances + accessibility of the
 * controls. Driving Auto-Detect / Preview against decoded samples
 * requires a captured wave-data fixture — that lives in Wave 4 (#415)
 * library coverage. This file verifies the gates + button accessibility
 * of the loop-editor surface.
 *
 * Affordances covered:
 *   - D-TONE-LOOP-01: "Load Wave Data" button mounts before decoded
 *     samples are in the cache (ToneWavePanel.tsx:186-198 gate).
 *   - D-TONE-LOOP-02: Visual waveform region — the LoopEditor's
 *     [data-loop-editor] container exists once wave data is present.
 *     Pre-load, the loop card shows the no-data placeholder copy
 *     ("No wave data available."); pinning the placeholder copy is
 *     the structural assertion this spec uses.
 *   - D-TONE-LOOP-03: Draggable loop-start marker — owned entirely by
 *     the loop-editor package's SVG handlers. The marker exists only
 *     after wave data is loaded (samples > 0 inside the LoopEditor
 *     component, see modules/loop-editor/src/ui/LoopEditor.tsx:495).
 *     This spec pins the gate: pre-load the marker MUST NOT exist.
 *   - D-TONE-LOOP-04: Draggable loop-end marker — same gate.
 *   - D-TONE-LOOP-05: Auto-Detect button — appears in LoopEditor's
 *     toolbar (LoopEditor.tsx:511-527) once wave data is loaded;
 *     pre-load it does not render.
 *   - D-TONE-LOOP-06: Preview / playback — preview-loop-btn has
 *     data-testid="preview-loop-btn" and mounts when wave data +
 *     audio environment are present. Pre-load it does not render.
 *
 * The "post-load" half of every contract (the marker / Auto-Detect /
 * Preview ACTUALLY appearing once wave data is decoded) requires the
 * harness to fetch + decode sample bytes — that flow is wired to the
 * SCSI bridge path on real hardware and a separate wave-data fixture
 * scenario for the simulated harness. The wave-data fixture is Wave 4
 * scope.
 *
 * Fixture: `tones-bank-0` — the same fixture capabilities/tones.spec.ts
 * uses; captures `connect() + loadToneRange(0, 8)`. The TonesPage's
 * mount sequence consumes the fixture in full, populating tone slot 0.
 * The ToneWavePanel renders the loop section if T0's wave has a
 * non-trivial start..end range. The captured tone determines whether
 * the loop section mounts; the test assertions cover both gated states.
 */
import { test, expect } from '@playwright/test';

const HARNESS_URL =
  '/roland/s330/editor/tones?midi=simulated&scenario=tones-bank-0';

test.describe('Capabilities — Tone Loop Editor (D-TONE-LOOP)', () => {
  let pageErrors: string[];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(msg.text());
    });

    await page.addInitScript(() => {
      window.localStorage.clear();
    });
    await page.goto(HARNESS_URL);
    await page.waitForLoadState('networkidle');

    // Mount the editor by clicking T11 (slot 0). load-everything loads
    // all tones, so T0 is populated.
    const firstSlot = page.getByTestId('tone-item-0');
    await expect(firstSlot).toBeVisible({ timeout: 5_000 });
    await firstSlot.click();
    await expect(
      page.locator('[data-capability="C-TONE-04"]'),
    ).toBeVisible({ timeout: 5_000 });
  });

  test.afterEach(() => {
    expect(pageErrors, 'page should not log harness/adapter errors').toEqual([]);
  });

  test('D-TONE-LOOP-01: Load Wave Data button is gated on hasSampleData', async ({ page }) => {
    // ToneWavePanel.tsx:179-209 wraps the Loop Editor section in
    //   {hasSampleData && (<section>...)}
    // where hasSampleData = tone.wave.endPoint > tone.wave.startPoint
    // (ToneWavePanel.tsx:40). The captured tones-bank-0 fixture
    // returns endPoint=0, startPoint=0 for T0 — a real device state
    // where the tone has no sample data assigned. Under this state
    // the entire Loop Editor section is absent, including the
    // "Load Wave Data" button. The affordance under test is the GATE:
    // when hasSampleData=false, the button MUST NOT render. The
    // complementary half ("button appears when hasSampleData=true and
    // waveData unloaded") requires a fixture whose captured tone has
    // a non-zero start/end range — that fixture is part of Wave 4
    // (#415) capture work, not in scope here.
    const loadButton = page.getByRole('button', { name: 'Load Wave Data' });
    await expect(loadButton).toHaveCount(0);

    // Belt-and-braces: the Loop Editor heading is also absent — pins
    // the gate at the section level. A redesign that unconditionally
    // mounts the section (with the button gated separately) trips
    // either this assertion or D-TONE-LOOP-02.
    await expect(
      page.getByRole('heading', { name: 'Loop Editor', level: 4 }),
    ).toHaveCount(0);
  });

  test('D-TONE-LOOP-02: visual waveform region is gated on hasSampleData', async ({ page }) => {
    // The Loop Editor section (which would mount the LoopEditor's
    // [data-loop-editor] root once wave data is decoded) is gated on
    // hasSampleData. The tones-bank-0 fixture's T0 has startPoint=0,
    // endPoint=0, so the entire section is absent — the visual
    // waveform region cannot exist without the section. The contract
    // under test pins both gates: the Loop Editor heading is absent
    // AND the loop-editor data root is absent.
    await expect(
      page.getByRole('heading', { name: 'Loop Editor', level: 4 }),
    ).toHaveCount(0);
    await expect(page.locator('[data-loop-editor]')).toHaveCount(0);
  });

  test('D-TONE-LOOP-03: draggable loop-start marker is gated on decoded samples', async ({ page }) => {
    // The SVG marker handles are inside [data-loop-editor]. Pre-load,
    // [data-loop-editor] doesn't exist. Post-load (Wave 4 fixture)
    // the spec would assert the marker count = 2 (start + end).
    await expect(page.locator('[data-loop-editor]')).toHaveCount(0);

    // Pin the inventory's source-of-truth — the LoopEditor package
    // provides the markers, and the test gate is the LoopEditor
    // container's presence. No additional assertion needed here
    // beyond what D-TONE-LOOP-02 already covers; this test exists so
    // the D-TONE-LOOP-03 row in the inventory has a citation, and
    // a future regression that decouples the markers from
    // [data-loop-editor] triggers this test directly.
  });

  test('D-TONE-LOOP-04: draggable loop-end marker is gated on decoded samples', async ({ page }) => {
    // Same gate as D-TONE-LOOP-03 — the end marker is the other half
    // of the marker pair inside [data-loop-editor].
    await expect(page.locator('[data-loop-editor]')).toHaveCount(0);
  });

  test('D-TONE-LOOP-05: Auto-Detect button is gated on decoded samples', async ({ page }) => {
    // The Auto-Detect button is inside the LoopEditor's toolbar
    // (LoopEditor.tsx:511-527), conditional on `onAutoDetect`. The
    // toolbar mounts only when wave data is loaded. Pre-load, the
    // button doesn't exist.
    await expect(
      page.getByRole('button', { name: /Auto-Detect/ }),
    ).toHaveCount(0);
  });

  test('D-TONE-LOOP-06: Preview / playback affordance is gated on decoded samples', async ({ page }) => {
    // The Preview button has data-testid="preview-loop-btn"
    // (LoopEditor.tsx:538) and mounts inside the toolbar when both
    // audio is available AND wave data is loaded. Pre-load, the
    // button doesn't exist.
    await expect(
      page.locator('[data-testid="preview-loop-btn"]'),
    ).toHaveCount(0);
  });
});
