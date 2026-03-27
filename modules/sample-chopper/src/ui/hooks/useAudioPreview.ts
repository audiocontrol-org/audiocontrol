/**
 * Audio Preview Hook
 *
 * Provides audio playback functionality for previewing samples and slices.
 * Uses synth-core's OscillatorFactory for buffer management and voice creation,
 * and PlaybackPositionTracker for position tracking.
 */

import { useRef, useState, useCallback, useEffect, type MutableRefObject } from 'react';
import {
  createWebAudioOscillatorFactory,
  createPlaybackPositionTracker,
} from '@audiocontrol/synth-core';
import type {
  OscillatorFactory,
  PlaybackPositionTracker,
  SampleOscillator,
} from '@audiocontrol/synth-core';

export interface UseAudioPreviewOptions {
  /** Sample rate of the audio */
  sampleRate: number;
}

export interface UseAudioPreviewReturn {
  /** Play audio samples */
  play: (samples: Int16Array, startSample?: number, endSample?: number) => void;
  /** Stop current playback */
  stop: () => void;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Current playback position in samples (updated during playback) */
  playbackPosition: number | null;
  /** Error message if playback failed */
  error: string | null;
  /** Ref for low-latency playback position reads (updated in rAF, no re-render) */
  playbackPositionRef: MutableRefObject<number | null>;
}

/**
 * Hook for audio preview playback using synth-core primitives
 */
export function useAudioPreview({ sampleRate }: UseAudioPreviewOptions): UseAudioPreviewReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const factoryRef = useRef<OscillatorFactory | null>(null);
  const trackerRef = useRef<PlaybackPositionTracker | null>(null);
  const oscillatorRef = useRef<SampleOscillator | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const playbackPositionRef = useRef<number | null>(null);
  const startSampleRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getOrCreateEngine = useCallback((): {
    ctx: AudioContext;
    factory: OscillatorFactory;
    tracker: PlaybackPositionTracker;
  } | null => {
    if (audioContextRef.current && factoryRef.current && trackerRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      return {
        ctx: audioContextRef.current,
        factory: factoryRef.current,
        tracker: trackerRef.current,
      };
    }

    try {
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      factoryRef.current = createWebAudioOscillatorFactory(ctx);
      trackerRef.current = createPlaybackPositionTracker(ctx);
      return { ctx, factory: factoryRef.current, tracker: trackerRef.current };
    } catch {
      setError('Failed to create audio context');
      return null;
    }
  }, []);

  // Update playback position during playback via rAF loop
  const updatePlaybackPosition = useCallback(() => {
    const tracker = trackerRef.current;
    const osc = oscillatorRef.current;

    if (!tracker || !osc || !osc.isPlaying) {
      setPlaybackPosition(null);
      playbackPositionRef.current = null;
      setIsPlaying(false);
      return;
    }

    const currentSample = startSampleRef.current + tracker.getCurrentSample();
    playbackPositionRef.current = currentSample;
    setPlaybackPosition(currentSample);

    animationFrameRef.current = requestAnimationFrame(updatePlaybackPosition);
  }, []);

  // Stop playback
  const stop = useCallback(() => {
    if (oscillatorRef.current) {
      oscillatorRef.current.stop(0);
      oscillatorRef.current = null;
    }
    if (trackerRef.current) {
      trackerRef.current.stop();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackPosition(null);
    playbackPositionRef.current = null;
  }, []);

  // Play audio samples
  const play = useCallback(
    (samples: Int16Array, startSample = 0, endSample?: number) => {
      // Stop any current playback
      stop();

      const engine = getOrCreateEngine();
      if (!engine) return;

      setError(null);

      try {
        const end = endSample ?? samples.length;
        if (end <= startSample) {
          setError('No audio to play');
          return;
        }

        // Load the full buffer and create a slice oscillator for the region
        engine.factory.setBuffer(samples, sampleRate);
        const osc = engine.factory.createSliceOscillator(startSample, end, 127);

        oscillatorRef.current = osc;
        startSampleRef.current = startSample;

        // Start position tracking
        engine.tracker.start(sampleRate);

        setIsPlaying(true);

        // Start position update loop
        animationFrameRef.current = requestAnimationFrame(updatePlaybackPosition);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Playback failed');
        setIsPlaying(false);
      }
    },
    [stop, getOrCreateEngine, sampleRate, updatePlaybackPosition],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
      trackerRef.current?.dispose();
      trackerRef.current = null;
      factoryRef.current?.dispose();
      factoryRef.current = null;
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stop]);

  return {
    play,
    stop,
    isPlaying,
    playbackPosition,
    playbackPositionRef,
    error,
  };
}
