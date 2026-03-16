/**
 * S-330 device configuration.
 *
 * @packageDocumentation
 */

import { createS330Client } from '@audiocontrol/sampler-devices/s330';
import type { DeviceConfig } from './types.js';
import type { SSeriesMidiAdapter } from '@audiocontrol/sampler-devices/roland-s-series';
import type { SamplerClientInterface } from '@/core/midi/SamplerClient';

/**
 * Roland S-330 sampler configuration.
 *
 * The S-330 has:
 * - 64 patches (8 banks of 8, but typically 16 loaded at a time)
 * - 32 tones (4 banks of 8)
 * - 2 wave banks (A, B)
 */
export const s330Config: DeviceConfig = {
  deviceType: 's330',
  deviceName: 'S-330',
  manufacturer: 'Roland',

  // Memory layout - S-330 typically has 16 patches loaded at a time
  // but can store 64 total. We expose the common working set.
  totalPatches: 16,
  totalTones: 32,
  patchesPerBank: 8,
  tonesPerBank: 8,
  waveBankCount: 2,

  // Value ranges
  maxToneIndex: 31,
  maxPatchIndex: 15,
  maxWaveBankIndex: 1,

  // URL configuration
  basePath: '/roland/s330/editor',

  // Client factory
  createClient: (adapter: SSeriesMidiAdapter, options?: { deviceId?: number }): SamplerClientInterface => {
    return createS330Client(adapter, options) as unknown as SamplerClientInterface;
  },
};
