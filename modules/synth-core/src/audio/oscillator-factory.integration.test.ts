/**
 * Integration tests for the Web Audio oscillator factory.
 *
 * These run in a real browser (via vitest browser mode) using OfflineAudioContext
 * to render actual audio and verify pitch, gain, loop behavior, and voice mixing.
 */

import { describe, it, expect } from 'vitest';
import { createWebAudioOscillatorFactory } from '@/audio/web-audio-oscillator-factory';
import {
  generateSineInt16,
  generateSineWaveInt16,
  estimateFrequencyZeroCrossing,
  measureRMS,
  renderAndGetSamples,
  measureLoopCorrelation,
} from '@/testing/audio-helpers';

const SAMPLE_RATE = 44100;
const ROOT_KEY = 69; // A4 = 440 Hz

function createOfflineCtx(durationSec: number): OfflineAudioContext {
  return new OfflineAudioContext(1, Math.round(SAMPLE_RATE * durationSec), SAMPLE_RATE);
}

describe('oscillator factory — OfflineAudioContext integration', () => {
  describe('pitch accuracy', () => {
    it('plays at original pitch when note equals root key', async () => {
      const ctx = createOfflineCtx(0.5);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);

      // Single-cycle 440 Hz sine — looping produces a 440 Hz tone
      const sineBuffer = generateSineInt16(440, SAMPLE_RATE);
      factory.setBuffer(sineBuffer, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);
      factory.setLoopRegion(true, 0, sineBuffer.length / SAMPLE_RATE);

      factory.createOscillator(ROOT_KEY, 127); // A4 = root key = playbackRate 1.0

      const samples = await renderAndGetSamples(ctx);
      const freq = estimateFrequencyZeroCrossing(samples, SAMPLE_RATE, 100);

      expect(freq).toBeGreaterThan(420);
      expect(freq).toBeLessThan(460);
    });

    it('plays one octave higher when note is 12 semitones above root', async () => {
      const ctx = createOfflineCtx(0.5);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);

      const sineBuffer = generateSineInt16(440, SAMPLE_RATE);
      factory.setBuffer(sineBuffer, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);
      factory.setLoopRegion(true, 0, sineBuffer.length / SAMPLE_RATE);

      factory.createOscillator(ROOT_KEY + 12, 127); // A5 = 880 Hz

      const samples = await renderAndGetSamples(ctx);
      const freq = estimateFrequencyZeroCrossing(samples, SAMPLE_RATE, 100);

      expect(freq).toBeGreaterThan(840);
      expect(freq).toBeLessThan(920);
    });

    it('plays one octave lower when note is 12 semitones below root', async () => {
      const ctx = createOfflineCtx(1.0);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);

      const sineBuffer = generateSineInt16(440, SAMPLE_RATE);
      factory.setBuffer(sineBuffer, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);
      factory.setLoopRegion(true, 0, sineBuffer.length / SAMPLE_RATE);

      factory.createOscillator(ROOT_KEY - 12, 127); // A3 = 220 Hz

      const samples = await renderAndGetSamples(ctx);
      const freq = estimateFrequencyZeroCrossing(samples, SAMPLE_RATE, 100);

      expect(freq).toBeGreaterThan(200);
      expect(freq).toBeLessThan(240);
    });

    it('plays a perfect fifth (7 semitones) at correct pitch', async () => {
      const ctx = createOfflineCtx(0.5);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);

      const sineBuffer = generateSineInt16(440, SAMPLE_RATE);
      factory.setBuffer(sineBuffer, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);
      factory.setLoopRegion(true, 0, sineBuffer.length / SAMPLE_RATE);

      // E5 = 440 * 2^(7/12) ≈ 659.3 Hz
      factory.createOscillator(ROOT_KEY + 7, 127);

      const samples = await renderAndGetSamples(ctx);
      const freq = estimateFrequencyZeroCrossing(samples, SAMPLE_RATE, 100);
      const expectedFreq = 440 * Math.pow(2, 7 / 12);

      expect(freq).toBeGreaterThan(expectedFreq * 0.95);
      expect(freq).toBeLessThan(expectedFreq * 1.05);
    });
  });

  describe('velocity and gain', () => {
    it('produces louder output at higher velocity', async () => {
      // Render at velocity 127
      const ctxLoud = createOfflineCtx(0.5);
      const factoryLoud = createWebAudioOscillatorFactory(ctxLoud as unknown as AudioContext);
      const sine = generateSineWaveInt16(440, SAMPLE_RATE, 0.5);
      factoryLoud.setBuffer(sine, SAMPLE_RATE);
      factoryLoud.setRootKey(ROOT_KEY);
      factoryLoud.createOscillator(ROOT_KEY, 127);
      const samplesLoud = await renderAndGetSamples(ctxLoud);
      const rmsLoud = measureRMS(samplesLoud, 1000);

      // Render at velocity 32
      const ctxQuiet = createOfflineCtx(0.5);
      const factoryQuiet = createWebAudioOscillatorFactory(ctxQuiet as unknown as AudioContext);
      factoryQuiet.setBuffer(sine, SAMPLE_RATE);
      factoryQuiet.setRootKey(ROOT_KEY);
      factoryQuiet.createOscillator(ROOT_KEY, 32);
      const samplesQuiet = await renderAndGetSamples(ctxQuiet);
      const rmsQuiet = measureRMS(samplesQuiet, 1000);

      // Loud should be about 4x louder (127/32 ≈ 3.97)
      expect(rmsLoud).toBeGreaterThan(rmsQuiet * 2);
      expect(rmsLoud).toBeLessThan(rmsQuiet * 6);
    });

    it('produces near-zero output at velocity 1', async () => {
      const ctx = createOfflineCtx(0.3);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);
      const sine = generateSineWaveInt16(440, SAMPLE_RATE, 0.3);
      factory.setBuffer(sine, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);
      factory.createOscillator(ROOT_KEY, 1);

      const samples = await renderAndGetSamples(ctx);
      const rms = measureRMS(samples, 500);

      // velocity 1 / 127 ≈ 0.008, so RMS should be very small
      expect(rms).toBeLessThan(0.02);
    });
  });

  describe('loop behavior', () => {
    it('produces sustained audio when looping is enabled', async () => {
      const ctx = createOfflineCtx(1.0);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);

      // Short buffer (50ms) but render for 1 second — only works if looping
      const shortSine = generateSineWaveInt16(440, SAMPLE_RATE, 0.05);
      factory.setBuffer(shortSine, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);
      factory.setLoopRegion(true, 0, shortSine.length / SAMPLE_RATE);

      factory.createOscillator(ROOT_KEY, 127);

      const samples = await renderAndGetSamples(ctx);

      // Audio should still be present near the end (at 0.9s)
      const rmsEnd = measureRMS(samples, Math.round(0.9 * SAMPLE_RATE), Math.round(0.95 * SAMPLE_RATE));
      expect(rmsEnd).toBeGreaterThan(0.1);
    });

    it('produces silence after buffer ends when looping is disabled', async () => {
      const ctx = createOfflineCtx(0.5);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);

      // 100ms buffer, no loop, render 500ms
      const shortSine = generateSineWaveInt16(440, SAMPLE_RATE, 0.1);
      factory.setBuffer(shortSine, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);
      // No setLoopRegion call — looping defaults to off

      factory.createOscillator(ROOT_KEY, 127);

      const samples = await renderAndGetSamples(ctx);

      // Should have audio in the first 100ms
      const rmsStart = measureRMS(samples, 100, 4000);
      expect(rmsStart).toBeGreaterThan(0.1);

      // Should be silent after the buffer ends (at 200ms+)
      const rmsTail = measureRMS(samples, Math.round(0.2 * SAMPLE_RATE));
      expect(rmsTail).toBeLessThan(0.01);
    });

    it('looping region produces repeating audio', async () => {
      const ctx = createOfflineCtx(1.0);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);

      // Generate a buffer with a distinctive pattern
      const sine = generateSineWaveInt16(440, SAMPLE_RATE, 0.1);
      factory.setBuffer(sine, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);
      factory.setLoopRegion(true, 0, sine.length / SAMPLE_RATE);

      factory.createOscillator(ROOT_KEY, 127);

      const samples = await renderAndGetSamples(ctx);

      // Compare two adjacent segments well into the looping region
      // They should be highly correlated (repeating)
      const loopLen = sine.length;
      const correlation = measureLoopCorrelation(samples, loopLen * 3, loopLen);

      expect(correlation).toBeGreaterThan(0.9);
    });
  });

  describe('live loop region updates', () => {
    it('propagates setLoopRegion to active oscillators', async () => {
      const ctx = createOfflineCtx(0.5);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);

      // Longer buffer with full loop initially
      const sine = generateSineWaveInt16(440, SAMPLE_RATE, 0.5);
      factory.setBuffer(sine, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);
      factory.setLoopRegion(true, 0, 0.5);

      factory.createOscillator(ROOT_KEY, 127);

      // Change loop region while oscillator is active
      // Narrow the loop to first 50ms
      factory.setLoopRegion(true, 0, 0.05);

      const samples = await renderAndGetSamples(ctx);

      // Audio should still be playing (loop is active)
      const rms = measureRMS(samples, Math.round(0.4 * SAMPLE_RATE));
      expect(rms).toBeGreaterThan(0.05);
    });
  });

  describe('polyphonic mixing', () => {
    it('mixes multiple voices to the same output', async () => {
      const ctx = createOfflineCtx(0.5);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);

      const sine = generateSineInt16(440, SAMPLE_RATE);
      factory.setBuffer(sine, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);
      factory.setLoopRegion(true, 0, sine.length / SAMPLE_RATE);

      // Play a single note first, measure its amplitude
      factory.createOscillator(ROOT_KEY, 127);
      const singleSamples = await renderAndGetSamples(ctx);
      const rmsSingle = measureRMS(singleSamples, 1000);

      // Now render with two notes
      const ctx2 = createOfflineCtx(0.5);
      const factory2 = createWebAudioOscillatorFactory(ctx2 as unknown as AudioContext);
      factory2.setBuffer(sine, SAMPLE_RATE);
      factory2.setRootKey(ROOT_KEY);
      factory2.setLoopRegion(true, 0, sine.length / SAMPLE_RATE);

      factory2.createOscillator(ROOT_KEY, 127);
      factory2.createOscillator(ROOT_KEY + 12, 127); // octave above

      const dualSamples = await renderAndGetSamples(ctx2);
      const rmsDual = measureRMS(dualSamples, 1000);

      // Two voices should be louder than one
      expect(rmsDual).toBeGreaterThan(rmsSingle * 1.2);
    });
  });

  describe('voice lifecycle', () => {
    it('stop produces silence after fade', async () => {
      const ctx = createOfflineCtx(0.5);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);

      const sine = generateSineWaveInt16(440, SAMPLE_RATE, 0.5);
      factory.setBuffer(sine, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);

      const osc = factory.createOscillator(ROOT_KEY, 127);

      // Stop immediately with a very short fade
      osc.stop(0.001);

      const samples = await renderAndGetSamples(ctx);

      // Should be mostly silent after the fade
      const rms = measureRMS(samples, 500);
      expect(rms).toBeLessThan(0.01);
    });

    it('oscillator reports isPlaying correctly', async () => {
      const ctx = createOfflineCtx(0.1);
      const factory = createWebAudioOscillatorFactory(ctx as unknown as AudioContext);

      const sine = generateSineWaveInt16(440, SAMPLE_RATE, 0.1);
      factory.setBuffer(sine, SAMPLE_RATE);
      factory.setRootKey(ROOT_KEY);

      const osc = factory.createOscillator(ROOT_KEY, 127);
      expect(osc.isPlaying).toBe(true);

      osc.stop(0);
      expect(osc.isPlaying).toBe(false);
    });
  });
});
