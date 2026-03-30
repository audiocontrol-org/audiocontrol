/**
 * Helpers for querying device memory state during e2e tests.
 *
 * These functions interact with the device data store exposed on
 * `window.__deviceDataStore` to inspect tone/patch occupancy without
 * going through the UI.
 */

import { type Page, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Summary of a single tone slot on the device.
 */
export interface ToneSlotSummary {
  index: number;
  name: string;
  empty: boolean;
  waveBank: number;
  segmentTop: number;
  segmentLength: number;
}

/**
 * Summary of a single patch slot on the device.
 */
export interface PatchSlotSummary {
  index: number;
  name: string;
  empty: boolean;
}

/**
 * Complete summary of device memory occupancy.
 */
export interface DeviceMemoryState {
  tones: ToneSlotSummary[];
  patches: PatchSlotSummary[];
  emptyToneCount: number;
  emptyPatchCount: number;
  occupiedToneCount: number;
  occupiedPatchCount: number;
}

// ---------------------------------------------------------------------------
// Device Data Loading
// ---------------------------------------------------------------------------

/**
 * Click the "Refresh Device" button on the Library page and wait for all
 * tone and patch banks to finish loading via MIDI.
 *
 * After clicking, waits for the button to become disabled (loading starts)
 * then waits for it to become enabled again (loading complete).
 * The button has `disabled={isLoading}` in LibraryPage.tsx.
 */
export async function loadAllDeviceData(page: Page): Promise<void> {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const refreshButton = page.locator('button', { hasText: 'Refresh Device' });
    await expect(refreshButton).toBeVisible({ timeout: 5_000 });
    await refreshButton.click();

    // Poll the store until all slots are loaded.
    // Use periodic page.evaluate calls (not waitForFunction) so that
    // each poll generates a Playwright step event for the heartbeat
    // reporter. waitForFunction blocks without heartbeats and the
    // watchdog kills the test.
    const POLL_INTERVAL = 2_000;
    const MAX_POLLS = 30; // 30 × 2s = 60s max
    for (let poll = 0; poll < MAX_POLLS; poll++) {
      await page.waitForTimeout(POLL_INTERVAL);
      const loaded = await page.evaluate(() => {
        const store = (window as Record<string, unknown>).__deviceDataStore as {
          getState: () => { tones: unknown[]; patches: unknown[] };
        } | undefined;
        if (!store) return false;
        const state = store.getState();
        if (state.tones.length === 0 || state.patches.length === 0) return false;
        const toneGaps = state.tones.filter((t) => t === undefined).length;
        const patchGaps = state.patches.filter((p) => p === undefined).length;
        return toneGaps === 0 && patchGaps === 0;
      });
      if (loaded) break;
    }

    // Check if all slots loaded successfully
    const hasGaps = await page.evaluate(() => {
      const store = (window as Record<string, unknown>).__deviceDataStore as {
        getState: () => { tones: unknown[]; patches: unknown[] };
      } | undefined;
      if (!store) return true;
      const state = store.getState();
      const toneGaps = state.tones.filter((t) => t === undefined).length;
      const patchGaps = state.patches.filter((p) => p === undefined).length;
      return toneGaps > 0 || patchGaps > 0;
    });

    if (!hasGaps) {
      return;
    }

    console.log(
      `[loadAllDeviceData] Attempt ${attempt}/${MAX_ATTEMPTS}: some slots failed to load, retrying...`
    );
  }

  console.warn(
    `[loadAllDeviceData] Some slots still have gaps after ${MAX_ATTEMPTS} attempts`
  );
}

// ---------------------------------------------------------------------------
// Device Memory State Query
// ---------------------------------------------------------------------------

/**
 * Query the device data store and return a summary of occupied/empty slots.
 *
 * Runs entirely in browser context via `page.evaluate`. Uses the same
 * emptiness criteria as the app:
 *   - Tones: `wave.segmentLength === 0` means empty
 *   - Patches: blank name AND no tone assignments means empty
 *   - `undefined` entries (not yet loaded) are treated as NOT empty
 *     to prevent false positives
 */
export async function queryDeviceMemoryState(
  page: Page,
): Promise<DeviceMemoryState> {
  return page.evaluate(() => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const store = (window as any).__deviceDataStore;
    if (!store) throw new Error('Device data store not exposed on window');
    const state = store.getState();

    const tones = state.tones.map((tone: any, index: number) => {
      if (!tone) {
        return {
          index, name: '', empty: false,
          waveBank: -1, segmentTop: -1, segmentLength: 0,
        };
      }
      const empty = tone.wave.segmentLength === 0;
      return {
        index,
        name: (tone.name ?? '').trim(),
        empty,
        waveBank: tone.wave.bank,
        segmentTop: tone.wave.segmentTop,
        segmentLength: tone.wave.segmentLength,
      };
    });

    const patches = state.patches.map((patch: any, index: number) => {
      if (!patch) return { index, name: '', empty: false };
      const name = (patch.common.name ?? '').trim();
      const hasAssignedTone = patch.common.toneLayer1.some(
        (t: number) => t >= 0
      );
      const empty = name === '' && !hasAssignedTone;
      return { index, name, empty };
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */

    return {
      tones,
      patches,
      emptyToneCount: tones.filter(
        (t: { empty: boolean }) => t.empty
      ).length,
      emptyPatchCount: patches.filter(
        (p: { empty: boolean }) => p.empty
      ).length,
      occupiedToneCount: tones.filter(
        (t: { empty: boolean }) => !t.empty
      ).length,
      occupiedPatchCount: patches.filter(
        (p: { empty: boolean }) => !p.empty
      ).length,
    };
  });
}
