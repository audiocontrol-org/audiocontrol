/** Single voice — sample playback with pitch and gain control. */
export interface SampleOscillator {
  readonly note: number;
  readonly isPlaying: boolean;
  setLoopRegion(enabled: boolean, startSec: number, endSec: number): void;
  stop(fadeTimeSec?: number): void;
}
