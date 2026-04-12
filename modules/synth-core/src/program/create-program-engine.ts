import type { ProgramPlayback } from '@/types/program-playback';
import { findMatchingZones } from '@/program/zone-matcher';
import { createAmpEnvelope } from '@/program/amp-envelope';
import type { AmpEnvelope } from '@/program/amp-envelope';
import { createZoneFilter } from '@/program/zone-filter';
import type { ZoneFilter } from '@/program/zone-filter';

/** A single active voice in the program engine. */
interface ActiveVoice {
  note: number;
  zoneIndex: number;
  source: AudioBufferSourceNode;
  ampEnvelope: AmpEnvelope;
  zoneFilter: ZoneFilter | null;
  muteGroup: number;
  disposed: boolean;
}

/** Program engine — multi-zone voice allocation and playback. */
export interface ProgramEngine {
  noteOn(note: number, velocity: number): void;
  noteOff(note: number): void;
  stopAll(): void;
  getActiveNotes(): Set<number>;
  dispose(): void;
}

const STOP_ALL_FADE_SEC = 0.01;

/**
 * Create a program engine that plays a multi-zone program.
 *
 * Each zone gets its own AudioBuffer. On noteOn, the engine finds
 * matching zones, creates voices with per-zone DSP chains
 * (source -> filter -> ampEnvelope -> destination), and manages
 * polyphony and mute groups.
 */
export function createProgramEngine(
  ctx: AudioContext,
  program: ProgramPlayback,
  destination?: AudioNode,
): ProgramEngine {
  const dest = destination ?? ctx.destination;

  // Pre-convert each zone's samples to an AudioBuffer
  const zoneBuffers: AudioBuffer[] = program.zones.map((zone) =>
    toAudioBuffer(ctx, zone.samples, zone.sampleRate),
  );

  // Active voices keyed by note — each note can have multiple voices (one per matched zone)
  const voicesByNote = new Map<number, ActiveVoice[]>();

  function totalActiveVoices(): number {
    let count = 0;
    for (const voices of voicesByNote.values()) {
      count += voices.length;
    }
    return count;
  }

  function stealOldestVoice(): void {
    // Find the note with the oldest voices (first entry in map iteration order)
    const firstEntry = voicesByNote.entries().next().value;
    if (!firstEntry) return;

    const [note, voices] = firstEntry;
    const oldest = voices[0];
    if (oldest) {
      releaseVoice(oldest, STOP_ALL_FADE_SEC);
      voices.shift();
      if (voices.length === 0) {
        voicesByNote.delete(note);
      }
    }
  }

  function stopVoicesInMuteGroup(group: number): void {
    if (group === 0) return;

    for (const [note, voices] of voicesByNote) {
      const remaining = voices.filter((v) => {
        if (v.muteGroup === group) {
          releaseVoice(v, 0.005);
          return false;
        }
        return true;
      });

      if (remaining.length === 0) {
        voicesByNote.delete(note);
      } else {
        voicesByNote.set(note, remaining);
      }
    }
  }

  function disposeVoiceNodes(voice: ActiveVoice): void {
    if (voice.disposed) return;
    voice.disposed = true;
    voice.ampEnvelope.dispose();
    voice.zoneFilter?.dispose();
    try { voice.source.disconnect(); } catch { /* ok */ }
  }

  function removeVoiceFromMap(voice: ActiveVoice): void {
    const voices = voicesByNote.get(voice.note);
    if (voices) {
      const idx = voices.findIndex((v) => v.source === voice.source);
      if (idx !== -1) {
        voices.splice(idx, 1);
        if (voices.length === 0) {
          voicesByNote.delete(voice.note);
        }
      }
    }
  }

  function releaseVoice(voice: ActiveVoice, fadeSec?: number): void {
    const release = fadeSec ?? voice.ampEnvelope.triggerRelease();
    if (fadeSec !== undefined) {
      // Force a specific fade time instead of using the envelope
      const now = ctx.currentTime;
      voice.ampEnvelope.gainNode.gain.cancelScheduledValues(now);
      voice.ampEnvelope.gainNode.gain.setValueAtTime(
        voice.ampEnvelope.gainNode.gain.value,
        now,
      );
      voice.ampEnvelope.gainNode.gain.linearRampToValueAtTime(0, now + release);
    }

    voice.zoneFilter?.triggerRelease();

    // Schedule source stop after release
    try {
      voice.source.stop(ctx.currentTime + release + 0.01);
    } catch {
      /* already stopped */
    }

    // Schedule cleanup — guarded by disposed flag to prevent double-dispose
    setTimeout(() => {
      disposeVoiceNodes(voice);
    }, (release + 0.05) * 1000);
  }

  function createVoice(
    note: number,
    velocity: number,
    zone: ProgramPlayback['zones'][number],
    zoneIndex: number,
  ): ActiveVoice {
    const buf = zoneBuffers[zoneIndex]!;

    // Create source
    const source = ctx.createBufferSource();
    source.buffer = buf;

    // Calculate playback rate from pitch params
    const totalSemitones =
      (note - zone.pitch.rootKey) + zone.pitch.transpose + zone.pitch.fineTune / 100;
    source.playbackRate.value = Math.pow(2, totalSemitones / 12);

    // Create amp envelope
    const ampEnv = createAmpEnvelope(ctx, zone.ampEnvelope);

    // Create filter (optional)
    let zoneFilter: ZoneFilter | null = null;

    if (zone.filter) {
      zoneFilter = createZoneFilter(ctx, zone.filter, zone.ampEnvelope);
      // Chain: source -> filter -> ampEnvelope -> destination
      source.connect(zoneFilter.filterNode);
      zoneFilter.filterNode.connect(ampEnv.gainNode);
    } else {
      // Chain: source -> ampEnvelope -> destination
      source.connect(ampEnv.gainNode);
    }

    ampEnv.gainNode.connect(dest);

    // Trigger envelopes
    ampEnv.triggerAttack(velocity);
    zoneFilter?.triggerAttack(velocity);

    // Start playback
    source.start();

    const voice: ActiveVoice = {
      note,
      zoneIndex,
      source,
      ampEnvelope: ampEnv,
      zoneFilter,
      muteGroup: zone.muteGroup,
      disposed: false,
    };

    // Clean up when source naturally ends (one-shot samples)
    // Guarded by disposed flag to prevent double-dispose with releaseVoice
    source.onended = () => {
      disposeVoiceNodes(voice);
      removeVoiceFromMap(voice);
    };

    return voice;
  }

  return {
    noteOn(note: number, velocity: number): void {
      const matches = findMatchingZones(program.zones, note, velocity);
      if (matches.length === 0) return;

      // Mono mode: stop any existing voices for this note
      if (program.polyphony === 'mono') {
        const existing = voicesByNote.get(note);
        if (existing) {
          for (const v of existing) {
            releaseVoice(v, 0.005);
          }
          voicesByNote.delete(note);
        }
      }

      const newVoices: ActiveVoice[] = [];

      for (const { zone, index: zoneIndex } of matches) {
        // Enforce mute groups
        if (zone.muteGroup !== 0) {
          stopVoicesInMuteGroup(zone.muteGroup);
        }

        // Enforce polyphony limit
        while (totalActiveVoices() + newVoices.length >= program.maxVoices) {
          stealOldestVoice();
        }

        newVoices.push(createVoice(note, velocity, zone, zoneIndex));
      }

      // Append to existing voices for this note (multiple noteOns at different velocities)
      const existing = voicesByNote.get(note) ?? [];
      voicesByNote.set(note, [...existing, ...newVoices]);
    },

    noteOff(note: number): void {
      if (program.playbackMode === 'one-shot') return;

      const voices = voicesByNote.get(note);
      if (!voices) return;

      for (const voice of voices) {
        releaseVoice(voice);
      }
      voicesByNote.delete(note);
    },

    stopAll(): void {
      for (const voices of voicesByNote.values()) {
        for (const voice of voices) {
          releaseVoice(voice, STOP_ALL_FADE_SEC);
        }
      }
      voicesByNote.clear();
    },

    getActiveNotes(): Set<number> {
      return new Set(voicesByNote.keys());
    },

    dispose(): void {
      this.stopAll();
    },
  };
}

function toAudioBuffer(
  ctx: AudioContext,
  samples: Int16Array | Float32Array,
  sampleRate: number,
): AudioBuffer {
  const length = samples.length;
  const audioBuffer = ctx.createBuffer(1, length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  if (samples instanceof Float32Array) {
    channelData.set(samples);
  } else {
    for (let i = 0; i < length; i++) {
      channelData[i] = samples[i]! / 32768;
    }
  }

  return audioBuffer;
}
