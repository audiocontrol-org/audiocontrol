import type { OscillatorFactory } from '@/types/oscillator-factory';
import type { SampleOscillator } from '@/types/sample-oscillator';

export interface MockSampleOscillator extends SampleOscillator {
  readonly stopCalls: Array<{ fadeTimeSec: number | undefined }>;
  readonly loopRegionCalls: Array<{ enabled: boolean; startSec: number; endSec: number }>;
}

export interface MockOscillatorFactoryControls {
  getActiveOscillators(): MockSampleOscillator[];
  getSetBufferCount(): number;
  getRootKey(): number;
  getLoopRegion(): { enabled: boolean; loopStart: number; loopEnd: number };
  getCreatedOscillators(): MockSampleOscillator[];
}

export function createMockOscillatorFactory(): {
  impl: OscillatorFactory;
  controls: MockOscillatorFactoryControls;
} {
  const activeOscillators = new Set<MockSampleOscillator>();
  const createdOscillators: MockSampleOscillator[] = [];
  let setBufferCount = 0;
  let rootKey = 60;
  let loopRegion = { enabled: false, loopStart: 0, loopEnd: 0 };

  function createMockOscillator(note: number, _velocity: number): MockSampleOscillator {
    const stopCalls: Array<{ fadeTimeSec: number | undefined }> = [];
    const loopRegionCalls: Array<{ enabled: boolean; startSec: number; endSec: number }> = [];
    let playing = true;

    const osc: MockSampleOscillator = {
      get note() { return note; },
      get isPlaying() { return playing; },
      get stopCalls() { return stopCalls; },
      get loopRegionCalls() { return loopRegionCalls; },
      setLoopRegion(enabled: boolean, startSec: number, endSec: number) {
        loopRegionCalls.push({ enabled, startSec, endSec });
      },
      stop(fadeTimeSec?: number) {
        stopCalls.push({ fadeTimeSec });
        playing = false;
        activeOscillators.delete(osc);
      },
    };

    activeOscillators.add(osc);
    createdOscillators.push(osc);
    return osc;
  }

  const impl: OscillatorFactory = {
    setBuffer(_samples: Int16Array | Float32Array, _sampleRate: number) {
      setBufferCount++;
    },
    setRootKey(key: number) {
      rootKey = key;
    },
    setLoopRegion(enabled: boolean, loopStart: number, loopEnd: number) {
      loopRegion = { enabled, loopStart, loopEnd };
      for (const osc of activeOscillators) {
        osc.setLoopRegion(enabled, loopStart, loopEnd);
      }
    },
    createOscillator(note: number, velocity: number): SampleOscillator {
      return createMockOscillator(note, velocity);
    },
    dispose() {
      for (const osc of activeOscillators) {
        osc.stop();
      }
    },
  };

  const controls: MockOscillatorFactoryControls = {
    getActiveOscillators: () => [...activeOscillators],
    getSetBufferCount: () => setBufferCount,
    getRootKey: () => rootKey,
    getLoopRegion: () => ({ ...loopRegion }),
    getCreatedOscillators: () => [...createdOscillators],
  };

  return { impl, controls };
}
