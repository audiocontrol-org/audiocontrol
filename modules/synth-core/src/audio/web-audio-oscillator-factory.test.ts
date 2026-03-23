import { describe, it, expect, vi } from 'vitest';
import { createWebAudioOscillatorFactory } from '@/audio/web-audio-oscillator-factory';

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
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function createMockAudioContext() {
  const sources: ReturnType<typeof createMockSourceNode>[] = [];
  const gains: ReturnType<typeof createMockGainNode>[] = [];

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
  };
}

describe('createWebAudioOscillatorFactory', () => {
  it('throws if createOscillator is called before setBuffer', () => {
    const { ctx } = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(ctx);

    expect(() => factory.createOscillator(60, 100)).toThrow('No sample buffer loaded');
  });

  it('creates an oscillator with correct pitch', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Int16Array([0, 1000, -1000]), 44100);
    factory.setRootKey(60);

    const osc = factory.createOscillator(72, 100);

    expect(osc.note).toBe(72);
    expect(osc.isPlaying).toBe(true);
    // 72 - 60 = 12 semitones = 1 octave = playbackRate 2.0
    expect(mock.sources[0]?.playbackRate.value).toBeCloseTo(2.0);
  });

  it('sets velocity-based gain', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Float32Array([0, 0.5, -0.5]), 44100);

    factory.createOscillator(60, 64);
    expect(mock.gains[0]?.gain.value).toBeCloseTo(64 / 127);
  });

  it('applies loop region on creation', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Int16Array(1000), 44100);
    factory.setLoopRegion(true, 0.1, 0.5);

    factory.createOscillator(60, 100);

    expect(mock.sources[0]?.loop).toBe(true);
    expect(mock.sources[0]?.loopStart).toBe(0.1);
    expect(mock.sources[0]?.loopEnd).toBe(0.5);
  });

  it('propagates setLoopRegion to active oscillators', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Int16Array(1000), 44100);

    factory.createOscillator(60, 100);
    factory.createOscillator(64, 100);

    factory.setLoopRegion(true, 0.2, 0.8);

    expect(mock.sources[0]?.loop).toBe(true);
    expect(mock.sources[0]?.loopStart).toBe(0.2);
    expect(mock.sources[0]?.loopEnd).toBe(0.8);
    expect(mock.sources[1]?.loop).toBe(true);
    expect(mock.sources[1]?.loopStart).toBe(0.2);
    expect(mock.sources[1]?.loopEnd).toBe(0.8);
  });

  it('stops oscillator with gain ramp', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Int16Array(1000), 44100);
    const osc = factory.createOscillator(60, 100);

    osc.stop(0.05);

    expect(osc.isPlaying).toBe(false);
    expect(mock.gains[0]?.gain.setValueAtTime).toHaveBeenCalled();
    expect(mock.gains[0]?.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.05);
    expect(mock.sources[0]?.stop).toHaveBeenCalledWith(0.05);
  });

  it('handles onended callback', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Int16Array(1000), 44100);
    const osc = factory.createOscillator(60, 100);

    // Simulate the source ending naturally
    mock.sources[0]?.onended?.();

    expect(osc.isPlaying).toBe(false);
  });

  it('setBuffer stops all active oscillators', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Int16Array(1000), 44100);
    const osc1 = factory.createOscillator(60, 100);
    const osc2 = factory.createOscillator(64, 100);

    factory.setBuffer(new Int16Array(2000), 44100);

    expect(mock.sources[0]?.stop).toHaveBeenCalled();
    expect(mock.sources[1]?.stop).toHaveBeenCalled();
    // After re-setting buffer, new oscillators use new buffer
    expect(osc1.isPlaying).toBe(false);
    expect(osc2.isPlaying).toBe(false);
  });

  it('converts Int16Array samples to float', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Int16Array([16384, -16384]), 44100);
    factory.createOscillator(60, 100);

    // Buffer was created and assigned — verifies no error on Int16 path
    expect(mock.sources[0]?.buffer).not.toBeNull();
  });

  it('handles Float32Array samples directly', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Float32Array([0.5, -0.5]), 44100);
    factory.createOscillator(60, 100);

    expect(mock.sources[0]?.buffer).not.toBeNull();
  });

  it('dispose stops all and clears buffer', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Int16Array(1000), 44100);
    factory.createOscillator(60, 100);

    factory.dispose();

    expect(mock.sources[0]?.stop).toHaveBeenCalled();
    expect(() => factory.createOscillator(60, 100)).toThrow('No sample buffer loaded');
  });

  it('stop is idempotent', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Int16Array(1000), 44100);
    const osc = factory.createOscillator(60, 100);

    osc.stop();
    osc.stop(); // should not throw

    expect(mock.sources[0]?.stop).toHaveBeenCalledTimes(1);
  });

  it('pitch calculation is correct for various intervals', () => {
    const mock = createMockAudioContext();
    const factory = createWebAudioOscillatorFactory(mock.ctx);

    factory.setBuffer(new Int16Array(1000), 44100);
    factory.setRootKey(60);

    // Unison
    factory.createOscillator(60, 100);
    expect(mock.sources[0]?.playbackRate.value).toBeCloseTo(1.0);

    // Octave up
    factory.createOscillator(72, 100);
    expect(mock.sources[1]?.playbackRate.value).toBeCloseTo(2.0);

    // Octave down
    factory.createOscillator(48, 100);
    expect(mock.sources[2]?.playbackRate.value).toBeCloseTo(0.5);

    // Perfect fifth (7 semitones)
    factory.createOscillator(67, 100);
    expect(mock.sources[3]?.playbackRate.value).toBeCloseTo(Math.pow(2, 7 / 12));
  });
});
