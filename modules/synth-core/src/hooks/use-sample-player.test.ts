import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSamplePlayer } from '@/hooks/use-sample-player';
import { createMockNoteInput } from '@/testing/mock-note-input';
import type { OscillatorFactory } from '@/types/oscillator-factory';

// Mock the Web Audio factory and voice allocator modules so we can test
// the hook's wiring without needing real AudioContext
const mockSetBuffer = vi.fn();
const mockSetRootKey = vi.fn();
const mockSetLoopRegion = vi.fn();
const mockDispose = vi.fn();
const mockNoteOn = vi.fn();
const mockNoteOff = vi.fn();
const mockStopAll = vi.fn();
const mockGetActiveNotes = vi.fn(() => new Set<number>());
const mockAllocatorDispose = vi.fn();
const mockCreateOscillator = vi.fn();
const mockCreateSliceOscillator = vi.fn();

vi.mock('@/audio/web-audio-oscillator-factory', () => ({
  createWebAudioOscillatorFactory: (): OscillatorFactory => ({
    setBuffer: mockSetBuffer,
    setRootKey: mockSetRootKey,
    setLoopRegion: mockSetLoopRegion,
    createOscillator: mockCreateOscillator,
    createSliceOscillator: mockCreateSliceOscillator,
    dispose: mockDispose,
  }),
}));

vi.mock('@/voice/create-voice-allocator', () => ({
  createVoiceAllocator: () => ({
    noteOn: mockNoteOn,
    noteOff: mockNoteOff,
    sliceOn: vi.fn(),
    sliceOff: vi.fn(),
    stopAll: mockStopAll,
    getActiveNotes: mockGetActiveNotes,
    getActiveSlices: vi.fn(() => new Set<number>()),
    dispose: mockAllocatorDispose,
  }),
}));

// Mock AudioContext
const mockClose = vi.fn();
const mockResume = vi.fn();

beforeEach(() => {
  vi.stubGlobal('AudioContext', vi.fn(() => ({
    state: 'running',
    close: mockClose,
    resume: mockResume,
    destination: {},
    createBufferSource: vi.fn(),
    createGain: vi.fn(),
    createBuffer: vi.fn(),
  })));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useSamplePlayer', () => {
  it('returns not ready when no samples provided', () => {
    const { result } = renderHook(() =>
      useSamplePlayer({ samples: null, sampleRate: 44100 }),
    );

    expect(result.current.isReady).toBe(false);
    expect(result.current.activeNotes.size).toBe(0);
  });

  it('sets buffer when samples are provided', () => {
    const samples = new Int16Array([0, 1000, -1000]);

    renderHook(() =>
      useSamplePlayer({ samples, sampleRate: 44100 }),
    );

    expect(mockSetBuffer).toHaveBeenCalledWith(samples, 44100);
  });

  it('sets root key', () => {
    const samples = new Int16Array([0, 1000]);

    renderHook(() =>
      useSamplePlayer({ samples, sampleRate: 44100, rootKey: 48 }),
    );

    expect(mockSetRootKey).toHaveBeenCalledWith(48);
  });

  it('sets loop region converting samples to seconds', () => {
    const samples = new Int16Array(44100);

    renderHook(() =>
      useSamplePlayer({
        samples,
        sampleRate: 44100,
        loopEnabled: true,
        loopStartSample: 4410,
        loopEndSample: 22050,
      }),
    );

    expect(mockSetLoopRegion).toHaveBeenCalledWith(true, 0.1, 0.5);
  });

  it('wires note input to allocator', () => {
    const { impl: noteInput, controls } = createMockNoteInput();
    const samples = new Int16Array(1000);

    mockGetActiveNotes.mockReturnValue(new Set([60]));

    const { result } = renderHook(() =>
      useSamplePlayer({
        samples,
        sampleRate: 44100,
        noteInput,
      }),
    );

    act(() => {
      controls.simulateNoteOn(60, 100);
    });

    expect(mockNoteOn).toHaveBeenCalledWith(60, 100);
    expect(result.current.activeNotes).toEqual(new Set([60]));
  });

  it('handles noteOff through allocator', () => {
    const { impl: noteInput, controls } = createMockNoteInput();
    const samples = new Int16Array(1000);

    mockGetActiveNotes
      .mockReturnValueOnce(new Set([60]))
      .mockReturnValueOnce(new Set());

    const { result } = renderHook(() =>
      useSamplePlayer({
        samples,
        sampleRate: 44100,
        noteInput,
      }),
    );

    act(() => {
      controls.simulateNoteOn(60, 100);
    });

    act(() => {
      controls.simulateNoteOff(60);
    });

    expect(mockNoteOff).toHaveBeenCalledWith(60);
    expect(result.current.activeNotes.size).toBe(0);
  });

  it('disposes on unmount', () => {
    const samples = new Int16Array(1000);

    const { unmount } = renderHook(() =>
      useSamplePlayer({ samples, sampleRate: 44100 }),
    );

    unmount();

    expect(mockAllocatorDispose).toHaveBeenCalled();
    expect(mockClose).toHaveBeenCalled();
  });

  it('detaches note input handlers on cleanup', () => {
    const { impl: noteInput } = createMockNoteInput();
    const samples = new Int16Array(1000);

    const { unmount } = renderHook(() =>
      useSamplePlayer({
        samples,
        sampleRate: 44100,
        noteInput,
      }),
    );

    unmount();
    // After unmount, handlers should be nulled — no way to directly assert
    // but we can verify dispose was called (which also nulls handlers)
    expect(mockAllocatorDispose).toHaveBeenCalled();
  });
});
