export interface VoiceAllocatorConfig {
  maxPolyphony: number;
  retrigger: boolean;
}

/** Polyphonic voice allocator. */
export interface VoiceAllocator {
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  stopAll(): void;
  getActiveNotes(): Set<number>;
  dispose(): void;
}
