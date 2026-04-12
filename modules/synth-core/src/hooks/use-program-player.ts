import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProgramPlayback } from '@/types/program-playback';
import type { ProgramEngine } from '@/program/create-program-engine';
import { createProgramEngine } from '@/program/create-program-engine';

export interface UseProgramPlayerParams {
  program: ProgramPlayback | null;
}

export interface UseProgramPlayerReturn {
  noteOn(note: number, velocity?: number): void;
  noteOff(note: number): void;
  stopAll(): void;
  activeNotes: Set<number>;
  latencyMs: number;
}

const ACTIVE_POLL_INTERVAL_MS = 50;

/**
 * React hook for program-based playback.
 *
 * Accepts a ProgramPlayback (zones with loaded audio buffers and DSP params),
 * creates a ProgramEngine internally, and exposes noteOn/noteOff/stopAll.
 */
export function useProgramPlayer(params: UseProgramPlayerParams): UseProgramPlayerReturn {
  const { program } = params;

  const audioCtxRef = useRef<AudioContext | null>(null);
  const engineRef = useRef<ProgramEngine | null>(null);
  const [activeNotes, setActiveNotes] = useState<Set<number>>(new Set());

  function getOrCreateAudioContext(): AudioContext {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext({ latencyHint: 'interactive' });
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }

  // Rebuild engine when program changes
  useEffect(() => {
    engineRef.current?.dispose();
    engineRef.current = null;

    if (!program || program.zones.length === 0) return;

    const ctx = getOrCreateAudioContext();
    engineRef.current = createProgramEngine(ctx, program);
  }, [program]);

  // Poll active notes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!engineRef.current) return;
      const current = engineRef.current.getActiveNotes();
      setActiveNotes((prev) => {
        if (prev.size === current.size && [...prev].every((v) => current.has(v))) {
          return prev;
        }
        return current;
      });
    }, ACTIVE_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;

      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
    };
  }, []);

  const noteOn = useCallback((note: number, velocity = 127): void => {
    if (!engineRef.current) return;

    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    engineRef.current.noteOn(note, velocity);
    setActiveNotes(engineRef.current.getActiveNotes());
  }, []);

  const noteOff = useCallback((note: number): void => {
    if (!engineRef.current) return;
    engineRef.current.noteOff(note);
    setActiveNotes(engineRef.current.getActiveNotes());
  }, []);

  const stopAll = useCallback((): void => {
    engineRef.current?.stopAll();
    setActiveNotes(new Set());
  }, []);

  const latencyMs = audioCtxRef.current
    ? (audioCtxRef.current.baseLatency ?? 0) * 1000
    : 0;

  return {
    noteOn,
    noteOff,
    stopAll,
    activeNotes,
    latencyMs,
  };
}
