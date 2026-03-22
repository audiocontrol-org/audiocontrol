/**
 * Integration tests for the voice allocator + oscillator factory pipeline.
 *
 * Verifies end-to-end behavior: MIDI note events -> voice allocation ->
 * actual audio output via OfflineAudioContext.
 */

import { describe, it, expect } from 'vitest';
import { createWebAudioOscillatorFactory } from '@/audio/web-audio-oscillator-factory';
import { createVoiceAllocator } from '@/voice/create-voice-allocator';
import {
  generateSineInt16,
  estimateFrequencyZeroCrossing,
  measureRMS,
  renderAndGetSamples,
} from '@/testing/audio-helpers';

const SAMPLE_RATE = 44100;
const ROOT_KEY = 69; // A4

function setupPipeline(durationSec: number, config?: { maxPolyphony?: number }) {
  const ctx = new OfflineAudioContext(1, Math.round(SAMPLE_RATE * durationSec), SAMPLE_RATE);
  const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);
  const allocator = createVoiceAllocator(factory, config);

  const sine = generateSineInt16(440, SAMPLE_RATE);
  factory.setBuffer(sine, SAMPLE_RATE);
  factory.setRootKey(ROOT_KEY);
  factory.setLoopRegion(true, 0, sine.length / SAMPLE_RATE);

  return { ctx, factory, allocator };
}

describe('voice allocator + factory pipeline', () => {
  it('noteOn produces pitched audio output', async () => {
    const { ctx, allocator } = setupPipeline(0.5);

    allocator.noteOn(ROOT_KEY, 100);

    const samples = await renderAndGetSamples(ctx);
    const freq = estimateFrequencyZeroCrossing(samples, SAMPLE_RATE, 100);

    expect(freq).toBeGreaterThan(420);
    expect(freq).toBeLessThan(460);
  });

  it('noteOff silences the voice', async () => {
    const { ctx, allocator } = setupPipeline(0.5);

    allocator.noteOn(ROOT_KEY, 127);
    // noteOff with 20ms release fade
    allocator.noteOff(ROOT_KEY);

    const samples = await renderAndGetSamples(ctx);

    // Should be mostly silent (voice was stopped almost immediately)
    const rms = measureRMS(samples, 2000);
    expect(rms).toBeLessThan(0.01);
  });

  it('polyphonic: two notes produce combined output', async () => {
    const { ctx, allocator } = setupPipeline(0.5);

    allocator.noteOn(ROOT_KEY, 100); // 440 Hz
    allocator.noteOn(ROOT_KEY + 12, 100); // 880 Hz

    expect(allocator.getActiveNotes()).toEqual(new Set([ROOT_KEY, ROOT_KEY + 12]));

    const samples = await renderAndGetSamples(ctx);
    const rms = measureRMS(samples, 1000);

    // Should have significant audio from two voices
    expect(rms).toBeGreaterThan(0.2);
  });

  it('retrigger: same note stops old voice and creates new one', async () => {
    const { ctx, allocator } = setupPipeline(0.5);

    allocator.noteOn(ROOT_KEY, 127);
    allocator.noteOn(ROOT_KEY, 64); // retrigger at lower velocity

    // Should have exactly one active note
    expect(allocator.getActiveNotes()).toEqual(new Set([ROOT_KEY]));

    const samples = await renderAndGetSamples(ctx);
    const rms = measureRMS(samples, 2000);

    // Should have audio (the retriggered voice is playing)
    expect(rms).toBeGreaterThan(0.1);
    // But quieter than max velocity
    expect(rms).toBeLessThan(0.6);
  });

  it('voice stealing: exceeding polyphony limit removes oldest voice', async () => {
    const { ctx, allocator } = setupPipeline(0.5, { maxPolyphony: 2 });

    allocator.noteOn(60, 100); // C4
    allocator.noteOn(64, 100); // E4
    allocator.noteOn(67, 100); // G4 — should steal C4

    expect(allocator.getActiveNotes()).toEqual(new Set([64, 67]));
    expect(allocator.getActiveNotes().has(60)).toBe(false);

    const samples = await renderAndGetSamples(ctx);
    const rms = measureRMS(samples, 2000);

    // Should have audio from the two remaining voices
    expect(rms).toBeGreaterThan(0.1);
  });

  it('stopAll silences everything', async () => {
    const { ctx, allocator } = setupPipeline(0.5);

    allocator.noteOn(ROOT_KEY, 127);
    allocator.noteOn(ROOT_KEY + 7, 127);
    allocator.noteOn(ROOT_KEY + 12, 127);

    allocator.stopAll();

    expect(allocator.getActiveNotes().size).toBe(0);

    const samples = await renderAndGetSamples(ctx);
    const rms = measureRMS(samples, 2000);

    expect(rms).toBeLessThan(0.01);
  });

  it('loop region changes propagate through the pipeline', async () => {
    const { ctx, factory, allocator } = setupPipeline(1.0);

    allocator.noteOn(ROOT_KEY, 127);

    // Change loop region while voice is active
    const sine = generateSineInt16(440, SAMPLE_RATE);
    factory.setLoopRegion(true, 0, (sine.length / 2) / SAMPLE_RATE);

    const samples = await renderAndGetSamples(ctx);

    // Audio should still be present throughout (loop keeps it alive)
    const rmsEnd = measureRMS(
      samples,
      Math.round(0.8 * SAMPLE_RATE),
      Math.round(0.9 * SAMPLE_RATE),
    );
    expect(rmsEnd).toBeGreaterThan(0.05);
  });

  it('dispose cleans up all voices', async () => {
    const { ctx, allocator } = setupPipeline(0.5);

    allocator.noteOn(ROOT_KEY, 127);
    allocator.noteOn(ROOT_KEY + 7, 127);

    allocator.dispose();

    expect(allocator.getActiveNotes().size).toBe(0);

    const samples = await renderAndGetSamples(ctx);
    const rms = measureRMS(samples, 2000);

    expect(rms).toBeLessThan(0.01);
  });
});
