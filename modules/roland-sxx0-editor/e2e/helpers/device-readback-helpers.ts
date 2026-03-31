/**
 * Helpers for reading data back from the device after UI changes.
 *
 * These helpers force a full device re-read (via "Refresh Device" on the
 * Library page) to verify that changes made through the editor UI were
 * actually written to the hardware. This is stronger than navigate-away-
 * and-back, which may serve cached data from the client or store.
 *
 * Pattern:
 *   1. Invalidate the device data store cache
 *   2. Navigate to the Library page
 *   3. Click "Refresh Device" (passes forceReload=true to the client)
 *   4. Wait for all banks to finish loading via MIDI
 *   5. Read the fresh data from __deviceDataStore
 */

import { type Page, expect } from '@playwright/test';

// Deviation: Using relative imports because e2e/ is outside src/ and the @/
// path alias only applies to src/. This should not be copied to app code.
import { loadAllDeviceData } from './device-state-helpers';

// ---------------------------------------------------------------------------
// Timeouts
// ---------------------------------------------------------------------------

const UI_TIMEOUT_MS = 2_000;

// ---------------------------------------------------------------------------
// Store Cache Invalidation
// ---------------------------------------------------------------------------

/**
 * Invalidate tone cache in the device data store so the next load
 * is guaranteed to re-read from hardware.
 */
async function invalidateToneCacheInStore(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as Record<string, unknown>).__deviceDataStore as {
      getState: () => {
        invalidateToneCache: () => void;
      };
    } | undefined;
    if (!store) throw new Error('Device data store not exposed on window');
    store.getState().invalidateToneCache();
  });
}

/**
 * Invalidate patch cache in the device data store so the next load
 * is guaranteed to re-read from hardware.
 */
async function invalidatePatchCacheInStore(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as Record<string, unknown>).__deviceDataStore as {
      getState: () => {
        invalidatePatchCache: () => void;
      };
    } | undefined;
    if (!store) throw new Error('Device data store not exposed on window');
    store.getState().invalidatePatchCache();
  });
}

/**
 * Invalidate all caches in the device data store.
 */
async function invalidateAllCacheInStore(page: Page): Promise<void> {
  await page.evaluate(() => {
    const store = (window as Record<string, unknown>).__deviceDataStore as {
      getState: () => {
        invalidateAllCache: () => void;
      };
    } | undefined;
    if (!store) throw new Error('Device data store not exposed on window');
    store.getState().invalidateAllCache();
  });
}

// ---------------------------------------------------------------------------
// Navigate to Library & Refresh
// ---------------------------------------------------------------------------

/**
 * Navigate to the Library page and force a full reload of all device data.
 *
 * This invalidates both store and client caches, then triggers a fresh
 * SysEx read of every tone and patch bank from the hardware.
 */
async function navigateToLibraryAndRefresh(page: Page): Promise<void> {
  // Invalidate store cache before navigating
  await invalidateAllCacheInStore(page);

  // Navigate to Library
  const libraryLink = page.locator('a[href$="/library"]');
  await expect(libraryLink).toBeVisible({ timeout: UI_TIMEOUT_MS });
  await libraryLink.click();
  await page.waitForURL('**/library**');

  // Click Refresh Device and wait for all banks to load
  await loadAllDeviceData(page);
}

// ---------------------------------------------------------------------------
// Tone Readback
// ---------------------------------------------------------------------------

/**
 * Shape of tone data returned by readToneFromDevice.
 * Contains the subset of tone parameters tested by e2e controls tests.
 */
export interface ToneReadback {
  name: string;
  loopMode: string;
  originalKey: number;
  outputAssign: number;
  fineTune: number;
  wave: {
    bank: number;
    segmentTop: number;
    segmentLength: number;
    startPoint: number;
    loopPoint: number;
    endPoint: number;
  };
  tvf: {
    cutoff: number;
    enabled: boolean;
  };
  tva: {
    level: number;
  };
  lfo: {
    rate: number;
  };
}

/**
 * Force a fresh read of all device data from hardware and return the
 * tone at the given index.
 *
 * This navigates to the Library page, clicks Refresh Device, waits for
 * all banks to finish loading, then reads the tone from the store.
 *
 * @returns The tone data read fresh from the device, or null if the slot is empty.
 */
export async function readToneFromDevice(
  page: Page,
  toneIndex: number,
): Promise<ToneReadback | null> {
  await navigateToLibraryAndRefresh(page);

  return page.evaluate((idx: number) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const store = (window as any).__deviceDataStore;
    if (!store) throw new Error('Device data store not exposed on window');
    const state = store.getState();
    const tone = state.tones[idx];
    if (!tone) return null;
    return {
      name: (tone.name ?? '').trim(),
      loopMode: tone.loopMode,
      originalKey: tone.originalKey,
      outputAssign: tone.outputAssign,
      fineTune: tone.fineTune,
      wave: {
        bank: tone.wave.bank,
        segmentTop: tone.wave.segmentTop,
        segmentLength: tone.wave.segmentLength,
        startPoint: tone.wave.startPoint,
        loopPoint: tone.wave.loopPoint,
        endPoint: tone.wave.endPoint,
      },
      tvf: {
        cutoff: tone.tvf.cutoff,
        enabled: tone.tvf.enabled,
      },
      tva: {
        level: tone.tva.level,
      },
      lfo: {
        rate: tone.lfo.rate,
      },
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, toneIndex);
}

// ---------------------------------------------------------------------------
// Patch Readback
// ---------------------------------------------------------------------------

/**
 * Shape of patch data returned by readPatchFromDevice.
 * Contains the subset of patch parameters tested by e2e controls tests.
 */
export interface PatchReadback {
  name: string;
  keyMode: string;
  keyAssign: string;
  benderRange: number;
  level: number;
  outputAssign: number;
  aftertouchSens: number;
  aftertouchAssign: string;
  velocityThreshold: number;
}

/**
 * Force a fresh read of all device data from hardware and return the
 * patch at the given index.
 *
 * @returns The patch data read fresh from the device, or null if the slot is empty.
 */
export async function readPatchFromDevice(
  page: Page,
  patchIndex: number,
): Promise<PatchReadback | null> {
  await navigateToLibraryAndRefresh(page);

  return page.evaluate((idx: number) => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const store = (window as any).__deviceDataStore;
    if (!store) throw new Error('Device data store not exposed on window');
    const state = store.getState();
    const patch = state.patches[idx];
    if (!patch) return null;
    return {
      name: (patch.common.name ?? '').trim(),
      keyMode: patch.common.keyMode,
      keyAssign: patch.common.keyAssign,
      benderRange: patch.common.benderRange,
      level: patch.common.level,
      outputAssign: patch.common.outputAssign,
      aftertouchSens: patch.common.aftertouchSens,
      aftertouchAssign: patch.common.aftertouchAssign,
      velocityThreshold: patch.common.velocityThreshold,
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, patchIndex);
}
