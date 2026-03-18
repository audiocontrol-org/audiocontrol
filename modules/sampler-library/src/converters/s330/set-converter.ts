import type { S330Tone, S330Patch } from '@audiocontrol/sampler-devices/s330';
import type { SetYaml } from '@/schemas/index.js';
import type {
  SeriesDeviceStateInput,
  SeriesDeviceStateToSetResult,
  SeriesSetToDeviceInput,
  SeriesSetToDeviceResult,
} from '@/converters/s-series/set-converter.js';
import { createSeriesSetConverter } from '@/converters/s-series/set-converter.js';
import { s330ToneConverter } from './tone-converter.js';
import { s330PatchConverter } from './patch-converter.js';

export type DeviceStateInput = SeriesDeviceStateInput<S330Tone, S330Patch>;
export type DeviceStateToSetResult = SeriesDeviceStateToSetResult;
export type SetToDeviceInput = SeriesSetToDeviceInput;
export type SetToDeviceResult = SeriesSetToDeviceResult<S330Tone, S330Patch>;

const converter = createSeriesSetConverter<S330Tone, S330Patch>({
  deviceType: 's330',
  toneConverter: s330ToneConverter,
  patchConverter: s330PatchConverter,
  bankCount: 2,
});

export const { deviceStateToSet, setToDeviceState, validateSetAllocations } = converter;

export function calculateSetSegmentUsage(manifest: SetYaml): { bank0: number; bank1: number } {
  return converter.calculateSetSegmentUsage(manifest) as { bank0: number; bank1: number };
}
