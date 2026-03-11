/**
 * S-330 tone converter for bidirectional YAML conversion.
 *
 * @packageDocumentation
 */

import type {
  S330Tone,
  S330LoopMode,
  S330SampleRate,
  S330Envelope,
  S330LfoParams,
  S330TvfParams,
  S330TvaParams,
} from '@audiocontrol/sampler-devices/s330';
import type { ToneConverter } from '@/converters/converter-registry.js';
import type { ToneYaml, S330ToneExtension } from '@/schemas/index.js';
import type { LoopMode } from '@/types/index.js';

/**
 * Map S-330 loop mode to YAML loop mode.
 */
function mapLoopModeToYaml(mode: S330LoopMode): LoopMode {
  switch (mode) {
    case 'forward':
      return 'forward';
    case 'alternating':
      return 'alternating';
    case 'one-shot':
      return 'oneShot';
    case 'reverse':
      return 'reverse';
  }
}

/**
 * Map YAML loop mode to S-330 loop mode.
 */
function mapLoopModeFromYaml(mode: LoopMode): S330LoopMode {
  switch (mode) {
    case 'forward':
      return 'forward';
    case 'alternating':
      return 'alternating';
    case 'oneShot':
      return 'one-shot';
    case 'reverse':
      return 'reverse';
  }
}

/**
 * Map S-330 sample rate to Hz.
 */
function mapSampleRateToHz(rate: S330SampleRate): number {
  return rate === '30kHz' ? 30000 : 15000;
}

/**
 * Map Hz to S-330 sample rate.
 */
function mapSampleRateFromHz(hz: number): S330SampleRate {
  return hz >= 30000 ? '30kHz' : '15kHz';
}

/**
 * Convert S-330 8-point envelope to YAML format.
 */
function envelopeToYaml(env: S330Envelope): {
  levels: [number, number, number, number, number, number, number, number];
  rates: [number, number, number, number, number, number, number, number];
  sustainPoint: number;
  endPoint: number;
} {
  return {
    levels: env.levels,
    rates: env.rates,
    sustainPoint: env.sustainPoint,
    endPoint: env.endPoint,
  };
}

/**
 * Convert YAML envelope to S-330 format.
 */
function envelopeFromYaml(yaml: {
  levels: [number, number, number, number, number, number, number, number];
  rates: [number, number, number, number, number, number, number, number];
  sustainPoint: number;
  endPoint: number;
}): S330Envelope {
  return {
    levels: yaml.levels,
    rates: yaml.rates,
    sustainPoint: yaml.sustainPoint,
    endPoint: yaml.endPoint,
  };
}

/**
 * Convert S-330 LFO params to YAML format.
 */
function lfoToYaml(lfo: S330LfoParams): NonNullable<S330ToneExtension['lfo']> {
  return {
    rate: lfo.rate,
    sync: lfo.sync,
    delay: lfo.delay,
    mode: lfo.mode === 'one-shot' ? 'one-shot' : 'normal',
    polarity: lfo.polarity,
    offset: lfo.offset,
  };
}

/**
 * Convert YAML LFO params to S-330 format.
 */
function lfoFromYaml(yaml: NonNullable<S330ToneExtension['lfo']>): S330LfoParams {
  return {
    rate: yaml.rate,
    sync: yaml.sync,
    delay: yaml.delay,
    mode: yaml.mode,
    polarity: yaml.polarity ?? false,
    offset: yaml.offset ?? 0,
  };
}

/**
 * Convert S-330 TVF params to YAML format.
 */
function tvfToYaml(tvf: S330TvfParams): NonNullable<S330ToneExtension['tvf']> {
  return {
    cutoff: tvf.cutoff,
    resonance: tvf.resonance,
    keyFollow: tvf.keyFollow,
    lfoDepth: tvf.lfoDepth,
    egDepth: tvf.egDepth,
    egPolarity: tvf.egPolarity,
    levelCurve: tvf.levelCurve,
    keyRateFollow: tvf.keyRateFollow,
    velRateFollow: tvf.velRateFollow,
    enabled: tvf.enabled,
    envelope: envelopeToYaml(tvf.envelope),
  };
}

/**
 * Convert YAML TVF params to S-330 format.
 */
function tvfFromYaml(yaml: NonNullable<S330ToneExtension['tvf']>): S330TvfParams {
  // Create default envelope if not provided
  const defaultEnvelope: S330Envelope = {
    levels: [127, 127, 127, 127, 127, 127, 127, 0],
    rates: [127, 127, 127, 127, 127, 127, 127, 127],
    sustainPoint: 6,
    endPoint: 8,
  };

  return {
    cutoff: yaml.cutoff,
    resonance: yaml.resonance,
    keyFollow: yaml.keyFollow,
    lfoDepth: yaml.lfoDepth ?? 0,
    egDepth: yaml.egDepth,
    egPolarity: yaml.egPolarity,
    levelCurve: (yaml.levelCurve ?? 0) as 0 | 1 | 2 | 3 | 4 | 5,
    keyRateFollow: yaml.keyRateFollow ?? 0,
    velRateFollow: yaml.velRateFollow ?? 0,
    enabled: yaml.enabled,
    envelope: yaml.envelope ? envelopeFromYaml(yaml.envelope) : defaultEnvelope,
  };
}

/**
 * Convert S-330 TVA params to YAML format.
 */
function tvaToYaml(tva: S330TvaParams): NonNullable<S330ToneExtension['tva']> {
  return {
    level: tva.level,
    lfoDepth: tva.lfoDepth,
    keyRate: tva.keyRate,
    velRate: tva.velRate,
    levelCurve: tva.levelCurve,
    envelope: envelopeToYaml(tva.envelope),
  };
}

/**
 * Convert YAML TVA params to S-330 format.
 */
function tvaFromYaml(yaml: NonNullable<S330ToneExtension['tva']>): S330TvaParams {
  return {
    level: yaml.level,
    lfoDepth: yaml.lfoDepth ?? 0,
    keyRate: yaml.keyRate ?? 0,
    velRate: yaml.velRate ?? 0,
    levelCurve: (yaml.levelCurve ?? 0) as 0 | 1 | 2 | 3 | 4 | 5,
    envelope: envelopeFromYaml(yaml.envelope),
  };
}

/**
 * S-330 tone converter implementation.
 */
export const s330ToneConverter: ToneConverter<S330Tone, ToneYaml> = {
  deviceType: 's330',

  toYaml(tone: S330Tone, wavFilename: string): ToneYaml {
    const s330Extension: S330ToneExtension = {
      originalKey: tone.originalKey,
      outputAssign: tone.outputAssign,
      sourceTone: tone.sourceTone,
      transpose: tone.transpose,
      fineTune: tone.fineTune,
      lfo: lfoToYaml(tone.lfo),
      tvf: tvfToYaml(tone.tvf),
      tva: tvaToYaml(tone.tva),
      benderEnabled: tone.benderEnabled,
      aftertouchEnabled: tone.aftertouchEnabled,
      pitchFollow: tone.pitchFollow,
    };

    return {
      format: 'sampler-tone',
      device: 's330',
      version: 1,
      name: tone.name,
      wave: {
        file: wavFilename,
        sampleRate: mapSampleRateToHz(tone.sampleRate),
        loopMode: mapLoopModeToYaml(tone.loopMode),
        loopPoint: tone.wave.loopPoint,
      },
      s330: s330Extension,
    };
  },

  fromYaml(yaml: ToneYaml): S330Tone {
    if (yaml.device !== 's330' || !yaml.s330) {
      throw new Error('Invalid YAML: expected s330 device with s330 extension');
    }

    const ext = yaml.s330;

    // Create default structures for optional fields
    const defaultLfo: S330LfoParams = {
      rate: 0,
      sync: false,
      delay: 0,
      mode: 'normal',
      polarity: false,
      offset: 0,
    };

    const defaultTvf: S330TvfParams = {
      cutoff: 127,
      resonance: 0,
      keyFollow: 0,
      lfoDepth: 0,
      egDepth: 0,
      egPolarity: 'normal',
      levelCurve: 0,
      keyRateFollow: 0,
      velRateFollow: 0,
      enabled: true,
      envelope: {
        levels: [127, 127, 127, 127, 127, 127, 127, 0],
        rates: [127, 127, 127, 127, 127, 127, 127, 127],
        sustainPoint: 6,
        endPoint: 8,
      },
    };

    const defaultTva: S330TvaParams = {
      level: 127,
      lfoDepth: 0,
      keyRate: 0,
      velRate: 0,
      levelCurve: 0,
      envelope: {
        levels: [127, 127, 127, 127, 127, 127, 127, 0],
        rates: [127, 127, 127, 127, 127, 127, 127, 127],
        sustainPoint: 6,
        endPoint: 8,
      },
    };

    return {
      name: yaml.name,
      outputAssign: ext.outputAssign,
      sourceTone: ext.sourceTone ?? 0,
      origSubTone: 0,
      sampleRate: mapSampleRateFromHz(yaml.wave.sampleRate),
      originalKey: ext.originalKey,
      wave: {
        bank: 0,
        segmentTop: 0,
        segmentLength: 0,
        startPoint: 0,
        endPoint: 0,
        loopPoint: yaml.wave.loopPoint ?? 0,
        loopLength: 0,
      },
      loopMode: mapLoopModeFromYaml(yaml.wave.loopMode),
      lfo: ext.lfo ? lfoFromYaml(ext.lfo) : defaultLfo,
      tvaLfoDepth: ext.tva?.lfoDepth ?? 0,
      transpose: ext.transpose ?? 0,
      fineTune: ext.fineTune ?? 0,
      tvf: ext.tvf ? tvfFromYaml(ext.tvf) : defaultTvf,
      tva: ext.tva ? tvaFromYaml(ext.tva) : defaultTva,
      benderEnabled: ext.benderEnabled ?? true,
      aftertouchEnabled: ext.aftertouchEnabled ?? true,
      pitchFollow: ext.pitchFollow ?? true,
      recThreshold: 0,
      recPreTrigger: 0,
      loopTune: 0,
      envZoom: 0,
      copySource: 0,
    };
  },
};
