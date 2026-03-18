import type { S550Tone, S550Patch } from '@audiocontrol/sampler-devices/s550';
import type { SetYaml } from '@/schemas/index.js';
import type {
  SeriesDeviceStateInput,
  SeriesDeviceStateToSetResult,
  SeriesSetToDeviceInput,
  SeriesSetToDeviceResult,
} from '@/converters/s-series/set-converter.js';
import { createSeriesSetConverter } from '@/converters/s-series/set-converter.js';
import { s550ToneConverter } from './tone-converter.js';
import { s550PatchConverter } from './patch-converter.js';

export type DeviceStateInput = SeriesDeviceStateInput<S550Tone, S550Patch>;
export type DeviceStateToSetResult = SeriesDeviceStateToSetResult;
export type SetToDeviceInput = SeriesSetToDeviceInput;
export type SetToDeviceResult = SeriesSetToDeviceResult<S550Tone, S550Patch>;

const converter = createSeriesSetConverter<S550Tone, S550Patch>({
  deviceType: 's550',
  toneConverter: s550ToneConverter,
  patchConverter: s550PatchConverter,
  bankCount: 4,
});

export const { deviceStateToSet, setToDeviceState, validateSetAllocations } = converter;

export function calculateSetSegmentUsage(manifest: SetYaml): {
  bank0: number;
  bank1: number;
  bank2: number;
  bank3: number;
} {
  return converter.calculateSetSegmentUsage(manifest) as {
    bank0: number;
    bank1: number;
    bank2: number;
    bank3: number;
  };
}
