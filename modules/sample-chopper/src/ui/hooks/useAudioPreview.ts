/**
 * Audio Preview Hook
 *
 * Provides audio playback functionality for previewing samples and slices
 * using the Web Audio API.
 */

import { useRef, useState, useCallback, useEffect } from 'react';

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
}

/**
 * Hook for audio preview playback using Web Audio API
 */
export function useAudioPreview({ sampleRate }: UseAudioPreviewOptions): UseAudioPreviewReturn {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const startSampleRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize AudioContext lazily (requires user gesture)
  const getAudioContext = useCallback((): AudioContext | null => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new AudioContext();
      } catch (err) {
        setError('Failed to create audio context');
        return null;
      }
    }
    // Resume if suspended (browser autoplay policy)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Convert Int16Array to Float32Array for Web Audio API
  const int16ToFloat32 = useCallback((samples: Int16Array): Float32Array => {
    const float32 = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      // Convert from [-32768, 32767] to [-1.0, 1.0]
      float32[i] = samples[i] / 32768;
    }
    return float32;
  }, []);

  // Update playback position during playback
  const updatePlaybackPosition = useCallback(() => {
    if (!audioContextRef.current || !isPlaying) {
      setPlaybackPosition(null);
      return;
    }

    const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
    const currentSample = startSampleRef.current + Math.floor(elapsed * sampleRate);
    setPlaybackPosition(currentSample);

    animationFrameRef.current = requestAnimationFrame(updatePlaybackPosition);
  }, [isPlaying, sampleRate]);

  // Stop playback
  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch {
        // Ignore errors if already stopped
      }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
    setPlaybackPosition(null);
  }, []);

  // Play audio samples
  const play = useCallback(
    (samples: Int16Array, startSample = 0, endSample?: number) => {
      // Stop any current playback
      stop();

      const ctx = getAudioContext();
      if (!ctx) return;

      setError(null);

      try {
        // Extract the portion to play
        const end = endSample ?? samples.length;
        const portion = samples.slice(startSample, end);

        if (portion.length === 0) {
          setError('No audio to play');
          return;
        }

        // Create AudioBuffer
        const buffer = ctx.createBuffer(1, portion.length, sampleRate);
        const channelData = buffer.getChannelData(0);
        const float32Data = int16ToFloat32(portion);
        channelData.set(float32Data);

        // Create and configure source node
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        // Track playback state
        source.onended = () => {
          setIsPlaying(false);
          setPlaybackPosition(null);
          sourceNodeRef.current = null;
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
        };

        // Start playback
        sourceNodeRef.current = source;
        startTimeRef.current = ctx.currentTime;
        startSampleRef.current = startSample;
        source.start();
        setIsPlaying(true);

        // Start position updates
        animationFrameRef.current = requestAnimationFrame(updatePlaybackPosition);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Playback failed');
        setIsPlaying(false);
      }
    },
    [stop, getAudioContext, sampleRate, int16ToFloat32, updatePlaybackPosition]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stop();
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
    error,
  };
}
