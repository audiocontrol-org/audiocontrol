/**
 * Hook to access device constants from the current config.
 *
 * Provides backward-compatible constants for components that
 * previously imported them from deviceDataStore.
 *
 * @packageDocumentation
 */

import { useDeviceConfig } from '@/context/DeviceConfigContext';

/**
 * Returns device-specific constants from the current config.
 *
 * Usage:
 * ```tsx
 * const { TOTAL_PATCHES, PATCHES_PER_BANK } = useDeviceConstants();
 * ```
 */
export function useDeviceConstants() {
  const config = useDeviceConfig();

  return {
    TOTAL_PATCHES: config.totalPatches,
    TOTAL_TONES: config.totalTones,
    PATCHES_PER_BANK: config.patchesPerBank,
    TONES_PER_BANK: config.tonesPerBank,
    WAVE_BANK_COUNT: config.waveBankCount,
    MAX_TONE_INDEX: config.maxToneIndex,
    MAX_PATCH_INDEX: config.maxPatchIndex,
  };
}
