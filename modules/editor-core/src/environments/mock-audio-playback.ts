/**
 * Mock AudioPlayback implementation for testing.
 *
 * Follows the createMockMidiTransport pattern: returns { impl, controls }
 * where impl satisfies the interface and controls allow test assertions.
 */

import type { AudioPlayback, AudioPlaybackState, AudioBuffer } from './types';

export interface MockAudioBuffer extends AudioBuffer {
  readonly _samples: Float32Array;
}

export interface MockAudioPlaybackControls {
  /** Get the last buffer passed to play(). */
  getLastPlayedBuffer(): MockAudioBuffer | null;
  /** Simulate playback ending (fires state change). */
  simulatePlaybackEnd(): void;
  /** Get current state directly. */
  getState(): AudioPlaybackState;
  /** Get the number of times play() was called. */
  getPlayCount(): number;
  /** Get the number of times stop() was called. */
  getStopCount(): number;
}

export function createMockAudioPlayback(): { impl: AudioPlayback; controls: MockAudioPlaybackControls } {
  let state: AudioPlaybackState = { playing: false, currentTime: 0, duration: 0 };
  let stateHandler: ((state: AudioPlaybackState) => void) | null = null;
  let lastPlayedBuffer: MockAudioBuffer | null = null;
  let playCount = 0;
  let stopCount = 0;

  function emitState() {
    stateHandler?.(state);
  }

  const impl: AudioPlayback = {
    play(buffer: AudioBuffer) {
      lastPlayedBuffer = buffer as MockAudioBuffer;
      playCount++;
      state = { playing: true, currentTime: 0, duration: buffer.duration };
      emitState();
    },

    stop() {
      stopCount++;
      state = { ...state, playing: false };
      emitState();
    },

    seek(time: number) {
      state = { ...state, currentTime: Math.max(0, Math.min(time, state.duration)) };
      emitState();
    },

    getState() {
      return state;
    },

    onStateChange(handler) {
      stateHandler = handler;
    },

    createBuffer(
      samples: Float32Array | Int16Array,
      sampleRate: number,
      channels = 1,
    ): AudioBuffer {
      const floatSamples = samples instanceof Float32Array
        ? samples
        : Float32Array.from(samples, (s) => s / 32768);

      const length = Math.floor(floatSamples.length / channels);
      const duration = length / sampleRate;

      return {
        sampleRate,
        duration,
        numberOfChannels: channels,
        length,
        _samples: floatSamples,
      } as MockAudioBuffer;
    },
  };

  const controls: MockAudioPlaybackControls = {
    getLastPlayedBuffer() {
      return lastPlayedBuffer;
    },
    simulatePlaybackEnd() {
      state = { ...state, playing: false, currentTime: state.duration };
      emitState();
    },
    getState() {
      return state;
    },
    getPlayCount() {
      return playCount;
    },
    getStopCount() {
      return stopCount;
    },
  };

  return { impl, controls };
}
