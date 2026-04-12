// Interfaces
export type { SampleOscillator } from '@/types/sample-oscillator';
export type { OscillatorFactory } from '@/types/oscillator-factory';
export type { VoiceAllocator, VoiceAllocatorConfig } from '@/types/voice-allocator';
export type { NoteInput } from '@/types/note-input';
export type {
  AmpEnvelopeParams,
  FilterType,
  FilterParams,
  PitchParams,
  ZonePlayback,
  ProgramPlayback,
} from '@/types/program-playback';
export { DEFAULT_AMP_ENVELOPE, DEFAULT_PITCH_PARAMS } from '@/types/program-playback';
export type {
  ReverbParams,
  DelayParams,
  ChorusParams,
  EffectsChainParams,
} from '@/types/effects';
export {
  DEFAULT_REVERB,
  DEFAULT_DELAY,
  DEFAULT_CHORUS,
  DEFAULT_EFFECTS,
} from '@/types/effects';

// Implementations
export { createWebAudioOscillatorFactory } from '@/audio/web-audio-oscillator-factory';
export { createVoiceAllocator } from '@/voice/create-voice-allocator';
export { createWebMidiNoteInput } from '@/input/web-midi-note-input';
export { createKeyboardNoteInput } from '@/input/keyboard-note-input';

// Program engine
export type { ProgramEngine } from '@/program/create-program-engine';
export { createProgramEngine } from '@/program/create-program-engine';
export type { ZoneMatch } from '@/program/zone-matcher';
export { findMatchingZones } from '@/program/zone-matcher';
export type { AmpEnvelope } from '@/program/amp-envelope';
export { createAmpEnvelope } from '@/program/amp-envelope';
export type { ZoneFilter } from '@/program/zone-filter';
export { createZoneFilter } from '@/program/zone-filter';
export type { EffectsChain } from '@/program/effects-chain';
export { createEffectsChain } from '@/program/effects-chain';
export type { MultiTimbralEngine, ChannelSlot } from '@/program/multi-timbral-engine';
export { createMultiTimbralEngine } from '@/program/multi-timbral-engine';

// Audio utilities
export type { PlaybackPositionTracker } from '@/audio/playback-position-tracker';
export { createPlaybackPositionTracker } from '@/audio/playback-position-tracker';

// Hooks
export { useSamplePlayer } from '@/hooks/use-sample-player';
export type { UseSamplePlayerParams, UseSamplePlayerReturn } from '@/hooks/use-sample-player';
export { useSlicePlayer } from '@/hooks/use-slice-player';
export type { SliceDefinition, UseSlicePlayerParams, UseSlicePlayerReturn } from '@/hooks/use-slice-player';
export { useProgramPlayer } from '@/hooks/use-program-player';
export type { UseProgramPlayerParams, UseProgramPlayerReturn } from '@/hooks/use-program-player';
