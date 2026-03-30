/**
 * Helpers for querying device memory state during e2e tests.
 *
 * These functions interact with the device data store exposed on
 * `window.__deviceDataStore` to inspect tone/patch occupancy without
 * going through the UI.
 */

import type { Page } from '@playwright/test';

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
  const refreshButton = page.locator('button', { hasText: 'Refresh Device' });
  await refreshButton.click();

  // Wait for loading to start (button becomes disabled)
  await page.waitForFunction(
    () => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Refresh Device'));
      return btn && btn.disabled;
    },
    { timeout: 5_000 }
  );

  // Wait for loading to finish (button re-enabled) -- generous timeout
  // because loading all banks over MIDI to 1987 hardware is slow.
  await page.waitForFunction(
    () => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('Refresh Device'));
      return btn && !btn.disabled;
    },
    { timeout: 60_000 }
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
