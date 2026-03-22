export interface VoiceAllocatorConfig {
  maxPolyphony: number;
  retrigger: boolean;
  muteGroups?: number[];              // per-slot mute group (0 = none, same non-zero group chokes)
  playbackMode?: 'one-shot' | 'gate'; // one-shot ignores noteOff/sliceOff
}

/** Polyphonic voice allocator. */
export interface VoiceAllocator {
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  /** Play a slice by index. Uses factory.createSliceOscillator. */
  sliceOn(sliceIndex: number, startSample: number, endSample: number, velocity: number): void;
  /** Stop a playing slice. Ignored in one-shot mode. */
  sliceOff(sliceIndex: number): void;
  stopAll(): void;
  getActiveNotes(): Set<number>;
  /** Get active slice indices. */
  getActiveSlices(): Set<number>;
  dispose(): void;
}
