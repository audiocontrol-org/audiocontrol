/**
 * Types consumed by the program playback engine.
 *
 * These are engine-internal types — they carry loaded audio buffers and
 * DSP parameters, not serialization concerns. The app layer converts
 * ProgramYaml (from sampler-library) into these types before handing
 * them to the engine.
 */

/** ADSR amplitude envelope parameters (all in seconds, sustain is 0–1 level). */
export interface AmpEnvelopeParams {
  attack: number;
  decay: number;
  sustain: number;   // 0–1 level
  release: number;
}

/** Filter types supported by the engine (maps to BiquadFilterNode types). */
export type FilterType = 'lowpass' | 'highpass' | 'bandpass';

/** Per-zone filter parameters. */
export interface FilterParams {
  type: FilterType;
  cutoff: number;       // Hz (20–20000)
  resonance: number;    // Q factor (0.0001–30)
  envelopeAmount: number; // How much the amp envelope modulates cutoff (in octaves, can be negative)
}

/** Per-zone pitch parameters. */
export interface PitchParams {
  rootKey: number;      // MIDI note that plays at original pitch
  transpose: number;    // semitones
  fineTune: number;     // cents (-64 to +63)
}

/** A zone ready for playback — sample data loaded, parameters resolved. */
export interface ZonePlayback {
  /** Loaded sample data. */
  samples: Int16Array | Float32Array;
  sampleRate: number;
  /** Key range [low, high] inclusive. Defaults to [0, 127] if omitted. */
  keyRange: [number, number];
  /** Velocity range [low, high] inclusive. Defaults to [1, 127] if omitted. */
  velocityRange: [number, number];
  /** Pitch parameters. */
  pitch: PitchParams;
  /** Amplitude envelope. */
  ampEnvelope: AmpEnvelopeParams;
  /** Filter (undefined = no filter in the signal chain). */
  filter?: FilterParams;
  /** Mute group: 0 = none, same non-zero value chokes other voices in the group. */
  muteGroup: number;
  /** Human-readable label for UI display. */
  label?: string;
}

/** A program ready for playback — all zones loaded with resolved parameters. */
export interface ProgramPlayback {
  name: string;
  zones: ZonePlayback[];
  polyphony: 'mono' | 'poly';
  playbackMode: 'one-shot' | 'gate';
  maxVoices: number;
}

/** Default amp envelope — immediate attack, no decay, full sustain, short release. */
export const DEFAULT_AMP_ENVELOPE: AmpEnvelopeParams = {
  attack: 0.005,
  decay: 0,
  sustain: 1,
  release: 0.02,
};

/** Default pitch params — middle C root, no transposition. */
export const DEFAULT_PITCH_PARAMS: PitchParams = {
  rootKey: 60,
  transpose: 0,
  fineTune: 0,
};
