/**
 * Promotion/demotion converters between device-agnostic samples
 * and device-bound tones.
 *
 * Promotion: SampleYaml -> ToneYaml (adds device-specific extension)
 * Demotion:  ToneYaml -> SampleYaml (strips device specifics, leaves breadcrumb)
 *
 * @packageDocumentation
 */

import type { SampleYaml } from '@/schemas/sample-schema.js';
import type { ToneYaml } from '@/schemas/tone-schema.js';
import type { DeviceType, LoopMode } from '@/types/common.js';

/**
 * Converts between device-agnostic SampleYaml and device-bound ToneYaml.
 *
 * @typeParam TDefaults - Device-specific defaults required for promotion
 */
export interface SamplePromotionConverter<TDefaults> {
  readonly deviceType: DeviceType;
  promote(sample: SampleYaml, defaults: TDefaults): ToneYaml;
  demote(tone: ToneYaml): SampleYaml;
}

/**
 * Defaults required when promoting a sample to an S-330 tone.
 * originalKey is mandatory because there is no sensible default.
 */
export interface S330PromotionDefaults {
  /** MIDI note number for original key (11-108) */
  originalKey: number;
  /** Output assignment (0-7), defaults to 0 */
  outputAssign?: number;
  /** Transpose in semitones (-64 to 63), defaults to 0 */
  transpose?: number;
  /** Fine tune (-64 to 63), defaults to 0 */
  fineTune?: number;
}

/**
 * Defaults required when promoting a sample to an S-550 tone.
 * Same shape as S-330 but the device supports extended sourceTone range.
 */
export interface S550PromotionDefaults {
  /** MIDI note number for original key (11-108) */
  originalKey: number;
  /** Output assignment (0-7), defaults to 0 */
  outputAssign?: number;
  /** Transpose in semitones (-64 to 63), defaults to 0 */
  transpose?: number;
  /** Fine tune (-64 to 63), defaults to 0 */
  fineTune?: number;
}

/** Maximum tone name length for S-series devices */
const TONE_NAME_MAX_LENGTH = 12;

/**
 * Creates a promotion converter for S-series devices (S-330, S-550).
 *
 * Factored out because S-330 and S-550 share the same promotion logic,
 * differing only in the device type and extension key.
 */
function createSeriesPromotionConverter<
  TDefaults extends S330PromotionDefaults,
>(
  deviceType: 's330' | 's550',
): SamplePromotionConverter<TDefaults> {
  return {
    deviceType,

    promote(sample: SampleYaml, defaults: TDefaults): ToneYaml {
      // A defined loopStart implies looping — default to forward if no explicit mode
      const loopMode: LoopMode = sample.loopMode
        ?? (sample.loopStart !== undefined ? 'forward' : 'oneShot');

      const tone: Record<string, unknown> = {
        format: 'sampler-tone' as const,
        device: deviceType,
        version: 1,
        name: sample.name.slice(0, TONE_NAME_MAX_LENGTH),
        wave: {
          file: sample.file,
          sampleRate: sample.sampleRate,
          loopMode,
          loopPoint: sample.loopStart,
          endPoint: sample.loopEnd,
        },
        [deviceType]: {
          originalKey: defaults.originalKey,
          outputAssign: defaults.outputAssign ?? 0,
          transpose: defaults.transpose ?? 0,
          fineTune: defaults.fineTune ?? 0,
        },
      };

      return tone as ToneYaml;
    },

    demote(tone: ToneYaml): SampleYaml {
      const extension = tone.s330 ?? tone.s550;
      const rootKey = extension?.originalKey;

      const sample: SampleYaml = {
        format: 'sample',
        version: 1,
        name: tone.name,
        file: tone.wave.file,
        sampleRate: tone.wave.sampleRate,
        loopMode: tone.wave.loopMode,
        loopStart: tone.wave.loopPoint,
        loopEnd: tone.wave.endPoint,
        rootKey,
        sourceDevice: tone.device,
      };

      return sample;
    },
  };
}

/**
 * Promotion converter for the Roland S-330.
 */
export const s330SamplePromotion: SamplePromotionConverter<S330PromotionDefaults> =
  createSeriesPromotionConverter<S330PromotionDefaults>('s330');

/**
 * Promotion converter for the Roland S-550.
 */
export const s550SamplePromotion: SamplePromotionConverter<S550PromotionDefaults> =
  createSeriesPromotionConverter<S550PromotionDefaults>('s550');
