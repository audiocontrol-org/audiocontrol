export interface PlaybackPositionTracker {
  /** Start tracking from position 0 at the given sample rate. */
  start(sampleRate: number): void;
  /** Stop tracking. */
  stop(): void;
  /** Get current playback position in samples. Returns -1 if not playing. */
  getCurrentSample(): number;
  /** Whether tracking is active. */
  readonly isPlaying: boolean;
  dispose(): void;
}

export function createPlaybackPositionTracker(ctx: AudioContext): PlaybackPositionTracker {
  let playing = false;
  let startTime = 0;
  let trackingSampleRate = 0;

  return {
    start(sampleRate: number): void {
      startTime = ctx.currentTime;
      trackingSampleRate = sampleRate;
      playing = true;
    },

    stop(): void {
      playing = false;
    },

    getCurrentSample(): number {
      if (!playing) return -1;
      return Math.floor((ctx.currentTime - startTime) * trackingSampleRate);
    },

    get isPlaying(): boolean {
      return playing;
    },

    dispose(): void {
      playing = false;
    },
  };
}
