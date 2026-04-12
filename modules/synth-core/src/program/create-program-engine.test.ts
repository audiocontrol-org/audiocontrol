import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProgramEngine } from '@/program/create-program-engine';
import type { ProgramPlayback, ZonePlayback } from '@/types/program-playback';
import { DEFAULT_AMP_ENVELOPE, DEFAULT_PITCH_PARAMS } from '@/types/program-playback';

// --- Mock Web Audio nodes ---

function createMockSourceNode() {
  return {
    buffer: null as AudioBuffer | null,
    playbackRate: { value: 1 },
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    onended: null as (() => void) | null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
}

function createMockGainNode() {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockBiquadFilterNode() {
  return {
    type: 'lowpass' as BiquadFilterType,
    frequency: {
      value: 1000,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    Q: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

// Guideline deviation: `as unknown as AudioContext` casts are required for Web Audio
// mocks in unit tests — jsdom has no AudioContext. Do not copy this pattern outside tests.
function createMockAudioContext() {
  const sources: ReturnType<typeof createMockSourceNode>[] = [];
  const gains: ReturnType<typeof createMockGainNode>[] = [];
  const filters: ReturnType<typeof createMockBiquadFilterNode>[] = [];

  return {
    ctx: {
      currentTime: 0,
      destination: {} as AudioDestinationNode,
      createBufferSource() {
        const s = createMockSourceNode();
        sources.push(s);
        return s as unknown as AudioBufferSourceNode;
      },
      createGain() {
        const g = createMockGainNode();
        gains.push(g);
        return g as unknown as GainNode;
      },
      createBiquadFilter() {
        const f = createMockBiquadFilterNode();
        filters.push(f);
        return f as unknown as BiquadFilterNode;
      },
      createBuffer(channels: number, length: number, sampleRate: number) {
        const data = new Float32Array(length);
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          duration: length / sampleRate,
          getChannelData: () => data,
        } as unknown as AudioBuffer;
      },
    } as unknown as AudioContext,
    get sources() { return sources; },
    get gains() { return gains; },
    get filters() { return filters; },
  };
}

// --- Helpers ---

function makeZone(overrides: Partial<ZonePlayback> = {}): ZonePlayback {
  return {
    samples: new Int16Array(100),
    sampleRate: 44100,
    keyRange: [0, 127],
    velocityRange: [1, 127],
    pitch: { ...DEFAULT_PITCH_PARAMS },
    ampEnvelope: { ...DEFAULT_AMP_ENVELOPE },
    muteGroup: 0,
    ...overrides,
  };
}

function makeProgram(zones: ZonePlayback[], overrides: Partial<ProgramPlayback> = {}): ProgramPlayback {
  return {
    name: 'test-program',
    zones,
    polyphony: 'poly',
    playbackMode: 'gate',
    maxVoices: 16,
    ...overrides,
  };
}

let mockCtx: ReturnType<typeof createMockAudioContext>;

beforeEach(() => {
  mockCtx = createMockAudioContext();
});

describe('createProgramEngine', () => {
  it('creates a voice on noteOn for a matching zone', () => {
    const program = makeProgram([makeZone()]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 100);

    expect(mockCtx.sources).toHaveLength(1);
    expect(mockCtx.sources[0]!.start).toHaveBeenCalled();
    expect(engine.getActiveNotes()).toEqual(new Set([60]));
  });

  it('creates no voice when note is outside key range', () => {
    const zone = makeZone({ keyRange: [48, 72] });
    const program = makeProgram([zone]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(36, 100);

    expect(mockCtx.sources).toHaveLength(0);
    expect(engine.getActiveNotes()).toEqual(new Set());
  });

  it('creates voices in multiple matching zones', () => {
    const zone1 = makeZone({ keyRange: [0, 127], velocityRange: [1, 63] });
    const zone2 = makeZone({ keyRange: [0, 127], velocityRange: [1, 63] });
    const program = makeProgram([zone1, zone2]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 50);

    expect(mockCtx.sources).toHaveLength(2);
    expect(engine.getActiveNotes()).toEqual(new Set([60]));
  });

  it('applies pitch transposition to playback rate', () => {
    // rootKey=60, note=72 -> 12 semitones up -> playbackRate = 2.0
    const zone = makeZone({ pitch: { rootKey: 60, transpose: 0, fineTune: 0 } });
    const program = makeProgram([zone]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(72, 100);

    expect(mockCtx.sources[0]!.playbackRate.value).toBeCloseTo(2.0, 5);
  });

  it('applies transpose to playback rate', () => {
    // rootKey=60, note=60, transpose=12 -> 12 semitones up -> playbackRate = 2.0
    const zone = makeZone({ pitch: { rootKey: 60, transpose: 12, fineTune: 0 } });
    const program = makeProgram([zone]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 100);

    expect(mockCtx.sources[0]!.playbackRate.value).toBeCloseTo(2.0, 5);
  });

  it('applies fine tune (cents) to playback rate', () => {
    // rootKey=60, note=60, fineTune=100 cents = 1 semitone
    const zone = makeZone({ pitch: { rootKey: 60, transpose: 0, fineTune: 100 } });
    const program = makeProgram([zone]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 100);

    const expectedRate = Math.pow(2, 1 / 12); // 1 semitone up
    expect(mockCtx.sources[0]!.playbackRate.value).toBeCloseTo(expectedRate, 5);
  });

  it('releases voices on noteOff in gate mode', () => {
    const program = makeProgram([makeZone()], { playbackMode: 'gate' });
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 100);
    expect(engine.getActiveNotes()).toEqual(new Set([60]));

    engine.noteOff(60);
    expect(engine.getActiveNotes()).toEqual(new Set());
  });

  it('ignores noteOff in one-shot mode', () => {
    const program = makeProgram([makeZone()], { playbackMode: 'one-shot' });
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 100);
    engine.noteOff(60);

    // Still active — one-shot ignores noteOff
    expect(engine.getActiveNotes()).toEqual(new Set([60]));
  });

  it('steals oldest voice when max polyphony is reached', () => {
    const program = makeProgram([makeZone()], { maxVoices: 2 });
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 100);
    engine.noteOn(64, 100);
    engine.noteOn(67, 100);

    // Oldest (60) was stolen
    expect(engine.getActiveNotes()).toEqual(new Set([64, 67]));
    expect(mockCtx.sources).toHaveLength(3);
  });

  it('stops all voices on stopAll', () => {
    const program = makeProgram([makeZone()]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 100);
    engine.noteOn(64, 100);
    engine.noteOn(67, 100);
    engine.stopAll();

    expect(engine.getActiveNotes()).toEqual(new Set());
  });

  it('creates filter node when zone has filter params', () => {
    const zone = makeZone({
      filter: { type: 'lowpass', cutoff: 2000, resonance: 5, envelopeAmount: 2 },
    });
    const program = makeProgram([zone]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 100);

    expect(mockCtx.filters).toHaveLength(1);
    expect(mockCtx.filters[0]!.type).toBe('lowpass');
    expect(mockCtx.filters[0]!.frequency.value).toBe(2000);
    expect(mockCtx.filters[0]!.Q.value).toBe(5);
  });

  it('does not create filter node when zone has no filter', () => {
    const zone = makeZone(); // no filter
    const program = makeProgram([zone]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 100);

    expect(mockCtx.filters).toHaveLength(0);
  });

  it('triggers amp envelope attack on noteOn', () => {
    const zone = makeZone({
      ampEnvelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.3 },
    });
    const program = makeProgram([zone]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 100);

    // Amp envelope gain node should have scheduled values
    // gains[0] is the amp envelope's gain node
    const gainParam = mockCtx.gains[0]!.gain;
    expect(gainParam.cancelScheduledValues).toHaveBeenCalled();
    expect(gainParam.setValueAtTime).toHaveBeenCalled();
    expect(gainParam.linearRampToValueAtTime).toHaveBeenCalled();
  });

  it('handles mute groups — new voice in same group stops existing', () => {
    const zone1 = makeZone({ keyRange: [36, 36], muteGroup: 1, label: 'hi-hat closed' });
    const zone2 = makeZone({ keyRange: [38, 38], muteGroup: 1, label: 'hi-hat open' });
    const program = makeProgram([zone1, zone2]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(36, 100); // hi-hat closed
    expect(engine.getActiveNotes()).toEqual(new Set([36]));

    engine.noteOn(38, 100); // hi-hat open, same mute group
    // Note 36 should have been choked
    expect(engine.getActiveNotes()).toEqual(new Set([38]));
  });

  it('velocity layers select correct zone', () => {
    const soft = makeZone({ velocityRange: [1, 63], label: 'soft' });
    const loud = makeZone({ velocityRange: [64, 127], label: 'loud' });
    const program = makeProgram([soft, loud]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 50); // soft layer
    expect(mockCtx.sources).toHaveLength(1);

    engine.noteOn(64, 100); // loud layer
    expect(mockCtx.sources).toHaveLength(2);
  });

  it('dispose stops all voices', () => {
    const program = makeProgram([makeZone()]);
    const engine = createProgramEngine(mockCtx.ctx, program);

    engine.noteOn(60, 100);
    engine.noteOn(64, 100);
    engine.dispose();

    expect(engine.getActiveNotes()).toEqual(new Set());
  });
});
