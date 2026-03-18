/**
 * Contract tests for AudioPlayback implementations.
 *
 * Any AudioPlayback implementation (mock, browser, Electron) should pass
 * these tests to guarantee consistent behavior across environments.
 */

import { describe, it, expect } from 'vitest';
import { createMockAudioPlayback } from '../mock-audio-playback';
import type { AudioPlayback } from '../types';

/**
 * Shared contract test suite. Call with a factory that creates a fresh
 * AudioPlayback instance for each test.
 */
export function audioPlaybackContractTests(
  name: string,
  factory: () => { impl: AudioPlayback },
) {
  describe(`AudioPlayback contract: ${name}`, () => {
    it('initial state is not playing', () => {
      const { impl } = factory();
      const state = impl.getState();
      expect(state.playing).toBe(false);
      expect(state.currentTime).toBe(0);
      expect(state.duration).toBe(0);
    });

    it('createBuffer from Float32Array returns correct metadata', () => {
      const { impl } = factory();
      const samples = new Float32Array(44100);
      const buffer = impl.createBuffer(samples, 44100);

      expect(buffer.sampleRate).toBe(44100);
      expect(buffer.numberOfChannels).toBe(1);
      expect(buffer.length).toBe(44100);
      expect(buffer.duration).toBeCloseTo(1.0, 2);
    });

    it('createBuffer from Int16Array returns correct metadata', () => {
      const { impl } = factory();
      const samples = new Int16Array(30000);
      const buffer = impl.createBuffer(samples, 30000);

      expect(buffer.sampleRate).toBe(30000);
      expect(buffer.numberOfChannels).toBe(1);
      expect(buffer.length).toBe(30000);
      expect(buffer.duration).toBeCloseTo(1.0, 2);
    });

    it('createBuffer with multiple channels divides length', () => {
      const { impl } = factory();
      const samples = new Float32Array(88200);
      const buffer = impl.createBuffer(samples, 44100, 2);

      expect(buffer.numberOfChannels).toBe(2);
      expect(buffer.length).toBe(44100);
      expect(buffer.duration).toBeCloseTo(1.0, 2);
    });

    it('play sets state to playing', () => {
      const { impl } = factory();
      const buffer = impl.createBuffer(new Float32Array(1000), 1000);
      impl.play(buffer);

      const state = impl.getState();
      expect(state.playing).toBe(true);
      expect(state.duration).toBeCloseTo(1.0, 2);
    });

    it('stop sets state to not playing', () => {
      const { impl } = factory();
      const buffer = impl.createBuffer(new Float32Array(1000), 1000);
      impl.play(buffer);
      impl.stop();

      expect(impl.getState().playing).toBe(false);
    });

    it('seek clamps to valid range', () => {
      const { impl } = factory();
      const buffer = impl.createBuffer(new Float32Array(1000), 1000);
      impl.play(buffer);

      impl.seek(-1);
      expect(impl.getState().currentTime).toBe(0);

      impl.seek(999);
      expect(impl.getState().currentTime).toBeLessThanOrEqual(buffer.duration);
    });

    it('onStateChange fires when play is called', () => {
      const { impl } = factory();
      const states: boolean[] = [];
      impl.onStateChange((s) => states.push(s.playing));

      const buffer = impl.createBuffer(new Float32Array(1000), 1000);
      impl.play(buffer);

      expect(states).toContain(true);
    });

    it('onStateChange(null) removes the handler', () => {
      const { impl } = factory();
      let callCount = 0;
      impl.onStateChange(() => { callCount++; });
      impl.onStateChange(null);

      const buffer = impl.createBuffer(new Float32Array(1000), 1000);
      impl.play(buffer);

      expect(callCount).toBe(0);
    });
  });
}

// Run contract tests against the mock implementation
audioPlaybackContractTests('MockAudioPlayback', () => {
  const { impl } = createMockAudioPlayback();
  return { impl };
});

describe('MockAudioPlayback-specific behavior', () => {
  it('controls.getPlayCount tracks play calls', () => {
    const { impl, controls } = createMockAudioPlayback();
    expect(controls.getPlayCount()).toBe(0);

    const buffer = impl.createBuffer(new Float32Array(100), 100);
    impl.play(buffer);
    impl.play(buffer);

    expect(controls.getPlayCount()).toBe(2);
  });

  it('controls.getStopCount tracks stop calls', () => {
    const { impl, controls } = createMockAudioPlayback();
    impl.stop();
    impl.stop();

    expect(controls.getStopCount()).toBe(2);
  });

  it('controls.getLastPlayedBuffer returns the last buffer', () => {
    const { impl, controls } = createMockAudioPlayback();
    expect(controls.getLastPlayedBuffer()).toBeNull();

    const buffer = impl.createBuffer(new Float32Array(100), 100);
    impl.play(buffer);

    expect(controls.getLastPlayedBuffer()).toBe(buffer);
  });

  it('controls.simulatePlaybackEnd fires state change', () => {
    const { impl, controls } = createMockAudioPlayback();
    const states: boolean[] = [];
    impl.onStateChange((s) => states.push(s.playing));

    const buffer = impl.createBuffer(new Float32Array(1000), 1000);
    impl.play(buffer);
    controls.simulatePlaybackEnd();

    expect(states).toEqual([true, false]);
    expect(controls.getState().currentTime).toBeCloseTo(1.0, 2);
  });
});
