// Interfaces
export type { SampleOscillator } from '@/types/sample-oscillator';
export type { OscillatorFactory } from '@/types/oscillator-factory';
export type { VoiceAllocator, VoiceAllocatorConfig } from '@/types/voice-allocator';
export type { NoteInput } from '@/types/note-input';

// Implementations
export { createWebAudioOscillatorFactory } from '@/audio/web-audio-oscillator-factory';
export { createVoiceAllocator } from '@/voice/create-voice-allocator';
export { createWebMidiNoteInput } from '@/input/web-midi-note-input';
export { createKeyboardNoteInput } from '@/input/keyboard-note-input';

// Hooks
export { useSamplePlayer } from '@/hooks/use-sample-player';
export type { UseSamplePlayerParams, UseSamplePlayerReturn } from '@/hooks/use-sample-player';
