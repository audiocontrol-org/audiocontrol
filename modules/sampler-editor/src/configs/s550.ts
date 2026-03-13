/**
 * S-550 device configuration.
 *
 * @packageDocumentation
 */

import type { DeviceConfig, SamplerClientInterface } from './types.js';
import type { SSeriesMidiAdapter } from '@audiocontrol/sampler-devices/roland-s-series';

/**
 * Roland S-550 sampler configuration.
 *
 * The S-550 has:
 * - 32 patches (4 banks of 8)
 * - 64 tones (8 banks of 8)
 * - 4 wave banks (A, B, C, D)
 */
export const s550Config: DeviceConfig = {
  deviceType: 's550',
  deviceName: 'S-550',
  manufacturer: 'Roland',

  // Memory layout
  totalPatches: 32,
  totalTones: 64,
  patchesPerBank: 8,
  tonesPerBank: 8,
  waveBankCount: 4,

  // Value ranges
  maxToneIndex: 63,
  maxPatchIndex: 31,
  maxWaveBankIndex: 3,

  // URL configuration
  basePath: '/roland/s550/editor',

  // Client factory - S-550 client not yet implemented
  createClient: (_adapter: SSeriesMidiAdapter, _options?: { deviceId?: number }): SamplerClientInterface => {
    // TODO: Implement S-550 client using shared S-series base
    // The S-550 uses the same SysEx protocol as S-330 (model ID 0x1E)
    // with different memory layout constants.
    throw new Error(
      'S-550 client not yet implemented. ' +
      'The S-550 client requires implementing s550-client.ts in sampler-devices ' +
      'using the shared S-series protocol base.'
    );
  },
};
