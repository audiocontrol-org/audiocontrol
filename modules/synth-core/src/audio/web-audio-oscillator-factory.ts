import type { OscillatorFactory } from '@/types/oscillator-factory';
import type { SampleOscillator } from '@/types/sample-oscillator';

const DEFAULT_FADE_SEC = 0.01;

interface ActiveOscillatorEntry {
  osc: SampleOscillator;
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export function createWebAudioOscillatorFactory(ctx: AudioContext): OscillatorFactory {
  let buffer: AudioBuffer | null = null;
  let rootKey = 60;
  let loopEnabled = false;
  let loopStartSec = 0;
  let loopEndSec = 0;
  const activeEntries = new Set<ActiveOscillatorEntry>();

  function toAudioBuffer(samples: Int16Array | Float32Array, sampleRate: number): AudioBuffer {
    const length = samples.length;
    const audioBuffer = ctx.createBuffer(1, length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    if (samples instanceof Float32Array) {
      channelData.set(samples);
    } else {
      for (let i = 0; i < length; i++) {
        channelData[i] = samples[i]! / 32768;
      }
    }

    return audioBuffer;
  }

  function removeEntry(entry: ActiveOscillatorEntry): void {
    if (!activeEntries.has(entry)) return;
    activeEntries.delete(entry);
    try { entry.source.disconnect(); } catch { /* already disconnected */ }
    try { entry.gain.disconnect(); } catch { /* already disconnected */ }
  }

  function stopAllActive(): void {
    const entries = [...activeEntries];
    for (const entry of entries) {
      entry.osc.stop(0);
    }
  }

  return {
    setBuffer(samples: Int16Array | Float32Array, sampleRate: number): void {
      if (activeEntries.size > 0) {
        stopAllActive();
      }
      buffer = toAudioBuffer(samples, sampleRate);
    },

    setRootKey(key: number): void {
      rootKey = key;
    },

    setLoopRegion(enabled: boolean, loopStart: number, loopEnd: number): void {
      loopEnabled = enabled;
      loopStartSec = loopStart;
      loopEndSec = loopEnd;

      for (const entry of activeEntries) {
        entry.source.loop = enabled;
        if (enabled) {
          entry.source.loopStart = loopStart;
          entry.source.loopEnd = loopEnd;
        }
        entry.osc.setLoopRegion(enabled, loopStart, loopEnd);
      }
    },

    createOscillator(note: number, velocity: number): SampleOscillator {
      if (!buffer) {
        throw new Error('No sample buffer loaded — call setBuffer() before createOscillator()');
      }

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();

      source.buffer = buffer;
      source.playbackRate.value = Math.pow(2, (note - rootKey) / 12);
      gainNode.gain.value = velocity / 127;

      source.loop = loopEnabled;
      if (loopEnabled) {
        source.loopStart = loopStartSec;
        source.loopEnd = loopEndSec;
      }

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      let playing = true;
      let entry: ActiveOscillatorEntry;

      const osc: SampleOscillator = {
        get note() { return note; },
        get isPlaying() { return playing; },

        setLoopRegion(enabled: boolean, startSec: number, endSec: number): void {
          source.loop = enabled;
          if (enabled) {
            source.loopStart = startSec;
            source.loopEnd = endSec;
          }
        },

        stop(fadeTimeSec?: number): void {
          if (!playing) return;
          playing = false;

          const fade = fadeTimeSec ?? DEFAULT_FADE_SEC;
          const now = ctx.currentTime;

          gainNode.gain.setValueAtTime(gainNode.gain.value, now);
          gainNode.gain.linearRampToValueAtTime(0, now + fade);

          try {
            source.stop(now + fade);
          } catch {
            /* already stopped */
          }

          removeEntry(entry);
        },
      };

      entry = { osc, source, gain: gainNode };
      activeEntries.add(entry);

      source.onended = () => {
        playing = false;
        removeEntry(entry);
      };

      source.start();
      return osc;
    },

    dispose(): void {
      stopAllActive();
      buffer = null;
    },
  };
}
