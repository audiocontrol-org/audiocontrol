import { useCallback, useEffect, useRef, useState } from 'react';
import type { NoteInput } from '@/types/note-input';
import type { VoiceAllocator } from '@/types/voice-allocator';
import type { OscillatorFactory } from '@/types/oscillator-factory';
import { createWebAudioOscillatorFactory } from '@/audio/web-audio-oscillator-factory';
import { createVoiceAllocator } from '@/voice/create-voice-allocator';

export interface UseSamplePlayerParams {
  samples: Int16Array | null;
  sampleRate: number;
  rootKey?: number;
  loopEnabled?: boolean;
  loopStartSample?: number;
  loopEndSample?: number;
  noteInput?: NoteInput | null;
}

export interface UseSamplePlayerReturn {
  activeNotes: ReadonlySet<number>;
  isReady: boolean;
}

export function useSamplePlayer(params: UseSamplePlayerParams): UseSamplePlayerReturn {
  const {
    samples,
    sampleRate,
    rootKey = 60,
    loopEnabled = false,
    loopStartSample = 0,
    loopEndSample = 0,
    noteInput = null,
  } = params;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const factoryRef = useRef<OscillatorFactory | null>(null);
  const allocatorRef = useRef<VoiceAllocator | null>(null);
  const activeNotesRef = useRef<Set<number>>(new Set());
  const [generation, setGeneration] = useState(0);

  const getOrCreateEngine = useCallback((): { factory: OscillatorFactory; allocator: VoiceAllocator } | null => {
    if (factoryRef.current && allocatorRef.current) {
      return { factory: factoryRef.current, allocator: allocatorRef.current };
    }

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ latencyHint: 'interactive' });
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    const factory = createWebAudioOscillatorFactory(audioCtxRef.current);
    const allocator = createVoiceAllocator(factory);
    factoryRef.current = factory;
    allocatorRef.current = allocator;
    return { factory, allocator };
  }, []);

  // Update buffer when samples change
  useEffect(() => {
    if (!samples || sampleRate <= 0) return;
    const engine = getOrCreateEngine();
    if (!engine) return;
    engine.factory.setBuffer(samples, sampleRate);
    activeNotesRef.current = new Set();
    setGeneration(g => g + 1);
  }, [samples, sampleRate, getOrCreateEngine]);

  // Update root key
  useEffect(() => {
    factoryRef.current?.setRootKey(rootKey);
  }, [rootKey]);

  // Update loop region — propagates to active voices via factory
  useEffect(() => {
    if (!factoryRef.current) return;
    const loopStartSec = sampleRate > 0 ? loopStartSample / sampleRate : 0;
    const loopEndSec = sampleRate > 0 ? loopEndSample / sampleRate : 0;
    factoryRef.current.setLoopRegion(loopEnabled, loopStartSec, loopEndSec);
  }, [loopEnabled, loopStartSample, loopEndSample, sampleRate]);

  // Wire note input to allocator
  useEffect(() => {
    if (!noteInput) return;

    noteInput.onNoteOn((note, velocity) => {
      const engine = getOrCreateEngine();
      if (!engine) return;

      if (audioCtxRef.current?.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      engine.allocator.noteOn(note, velocity);
      activeNotesRef.current = engine.allocator.getActiveNotes();
      setGeneration(g => g + 1);
    });

    noteInput.onNoteOff((note) => {
      allocatorRef.current?.noteOff(note);
      activeNotesRef.current = allocatorRef.current?.getActiveNotes() ?? new Set();
      setGeneration(g => g + 1);
    });

    return () => {
      noteInput.onNoteOn(null);
      noteInput.onNoteOff(null);
    };
  }, [noteInput, getOrCreateEngine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      allocatorRef.current?.dispose();
      allocatorRef.current = null;
      factoryRef.current = null;

      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  return {
    activeNotes: activeNotesRef.current,
    isReady: factoryRef.current !== null && samples !== null,
  };
}
