/** Reverb effect parameters. */
export interface ReverbParams {
  enabled: boolean;
  /** Wet/dry mix 0–1. */
  mix: number;
  /** Decay time in seconds (controls impulse response length). */
  decay: number;
}

/** Delay effect parameters. */
export interface DelayParams {
  enabled: boolean;
  /** Wet/dry mix 0–1. */
  mix: number;
  /** Delay time in seconds. */
  time: number;
  /** Feedback amount 0–1 (0 = single echo, approaching 1 = infinite). */
  feedback: number;
}

/** Chorus effect parameters. */
export interface ChorusParams {
  enabled: boolean;
  /** Wet/dry mix 0–1. */
  mix: number;
  /** LFO rate in Hz. */
  rate: number;
  /** Modulation depth in seconds. */
  depth: number;
}

/** Complete effects chain configuration. */
export interface EffectsChainParams {
  reverb: ReverbParams;
  delay: DelayParams;
  chorus: ChorusParams;
}

export const DEFAULT_REVERB: ReverbParams = {
  enabled: false,
  mix: 0.3,
  decay: 2.0,
};

export const DEFAULT_DELAY: DelayParams = {
  enabled: false,
  mix: 0.25,
  time: 0.375,
  feedback: 0.4,
};

export const DEFAULT_CHORUS: ChorusParams = {
  enabled: false,
  mix: 0.3,
  rate: 1.5,
  depth: 0.003,
};

export const DEFAULT_EFFECTS: EffectsChainParams = {
  reverb: DEFAULT_REVERB,
  delay: DEFAULT_DELAY,
  chorus: DEFAULT_CHORUS,
};
