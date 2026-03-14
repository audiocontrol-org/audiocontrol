/**
 * S-550 device configuration.
 *
 * @packageDocumentation
 */

import { createS550Client } from '@audiocontrol/sampler-devices/s550';
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

  // Client factory
  createClient: (adapter: SSeriesMidiAdapter, options?: { deviceId?: number }): SamplerClientInterface => {
    const client = createS550Client(adapter, options);
    return client as unknown as SamplerClientInterface;
  },
};
