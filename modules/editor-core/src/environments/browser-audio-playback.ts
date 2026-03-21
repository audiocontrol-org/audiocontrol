/**
 * Browser AudioPlayback implementation using the Web Audio API.
 *
 * Browser globals (AudioContext) are ONLY referenced in this file.
 * All other code uses the AudioPlayback interface.
 */

import type { AudioPlayback, AudioPlaybackState, AudioBuffer } from './types';

/**
 * Internal buffer wrapping a native Web Audio AudioBuffer.
 */
interface BrowserAudioBuffer extends AudioBuffer {
  readonly _native: globalThis.AudioBuffer;
}

function isBrowserBuffer(buffer: AudioBuffer): buffer is BrowserAudioBuffer {
  return '_native' in buffer;
}

export function createBrowserAudioPlayback(): AudioPlayback {
  let ctx: AudioContext | null = null;
  let currentSource: AudioBufferSourceNode | null = null;
  let startTime = 0;
  let pauseOffset = 0;
  let currentBuffer: BrowserAudioBuffer | null = null;
  let stateHandler: ((state: AudioPlaybackState) => void) | null = null;

  function getContext(): AudioContext {
    if (!ctx) {
      ctx = new AudioContext();
    }
    return ctx;
  }

  function emitState() {
    stateHandler?.(getState());
  }

  function getState(): AudioPlaybackState {
    if (!currentSource || !currentBuffer) {
      return { playing: false, currentTime: pauseOffset, duration: currentBuffer?.duration ?? 0 };
    }
    const elapsed = getContext().currentTime - startTime;
    return {
      playing: true,
      currentTime: Math.min(elapsed, currentBuffer.duration),
      duration: currentBuffer.duration,
    };
  }

  return {
    play(buffer: AudioBuffer, options?: import('./types').PlayOptions) {
      if (!isBrowserBuffer(buffer)) {
        throw new Error('Expected a browser audio buffer');
      }

      // Stop any current playback
      if (currentSource) {
        currentSource.onended = null;
        currentSource.stop();
        currentSource.disconnect();
      }

      const audioCtx = getContext();
      const source = audioCtx.createBufferSource();
      source.buffer = buffer._native;

      if (options?.loop) {
        source.loop = true;
        if (options.loopStart !== undefined) source.loopStart = options.loopStart;
        if (options.loopEnd !== undefined) source.loopEnd = options.loopEnd;
      }

      source.connect(audioCtx.destination);

      source.onended = () => {
        if (currentSource === source) {
          currentSource = null;
          pauseOffset = 0;
          emitState();
        }
      };

      currentSource = source;
      currentBuffer = buffer;
      startTime = audioCtx.currentTime - pauseOffset;
      source.start(0, pauseOffset);
      pauseOffset = 0;
      emitState();
    },

    setLoopRegion(loopStart: number, loopEnd: number) {
      if (currentSource && currentSource.loop) {
        currentSource.loopStart = loopStart;
        currentSource.loopEnd = loopEnd;
      }
    },

    stop() {
      if (currentSource) {
        currentSource.onended = null;
        currentSource.stop();
        currentSource.disconnect();
        currentSource = null;
      }
      pauseOffset = 0;
      emitState();
    },

    seek(time: number) {
      const duration = currentBuffer?.duration ?? 0;
      pauseOffset = Math.max(0, Math.min(time, duration));

      if (currentSource && currentBuffer) {
        // Restart from new position
        currentSource.onended = null;
        currentSource.stop();
        currentSource.disconnect();

        const audioCtx = getContext();
        const source = audioCtx.createBufferSource();
        source.buffer = currentBuffer._native;
        source.connect(audioCtx.destination);

        source.onended = () => {
          if (currentSource === source) {
            currentSource = null;
            pauseOffset = 0;
            emitState();
          }
        };

        currentSource = source;
        startTime = audioCtx.currentTime - pauseOffset;
        source.start(0, pauseOffset);
        pauseOffset = 0;
      }

      emitState();
    },

    getState,

    onStateChange(handler) {
      stateHandler = handler;
    },

    createBuffer(
      samples: Float32Array | Int16Array,
      sampleRate: number,
      channels = 1,
    ): AudioBuffer {
      const audioCtx = getContext();

      const floatSamples = samples instanceof Float32Array
        ? samples
        : Float32Array.from(samples, (s) => s / 32768);

      const length = Math.floor(floatSamples.length / channels);
      const native = audioCtx.createBuffer(channels, length, sampleRate);

      for (let ch = 0; ch < channels; ch++) {
        const channelData = native.getChannelData(ch);
        for (let i = 0; i < length; i++) {
          channelData[i] = floatSamples[i * channels + ch];
        }
      }

      return {
        sampleRate: native.sampleRate,
        duration: native.duration,
        numberOfChannels: native.numberOfChannels,
        length: native.length,
        _native: native,
      } as BrowserAudioBuffer;
    },
  };
}
