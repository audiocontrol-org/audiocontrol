/**
 * Test signal generators for loop detection boundary condition testing.
 *
 * Each generator produces an Int16Array with specific amplitude envelope
 * characteristics that exercise different aspects of the loop detection
 * algorithm: transient exclusion, silence detection, decay analysis,
 * and sustain region identification.
 *
 * All signals use a 440 Hz fundamental with harmonics for realistic
 * spectral content that the FFT-based scorer can work with.
 */

const DEFAULT_SAMPLE_RATE = 30000;

/** Generate a pitched tone with harmonics at a given amplitude. */
function toneAtSample(i: number, sampleRate: number, amplitude: number): number {
  const t = i / sampleRate;
  const fundamental = Math.sin(2 * Math.PI * 440 * t);
  const harmonic2 = 0.5 * Math.sin(2 * Math.PI * 880 * t);
  const harmonic3 = 0.25 * Math.sin(2 * Math.PI * 1320 * t);
  return (fundamental + harmonic2 + harmonic3) * amplitude * 0.6;
}

/**
 * Leading silence → sustained tone.
 *
 * Tests that the transient excluder skips the silent region and
 * candidates are found in the tone region, not in silence.
 *
 * Shape: [silence 300ms] [tone 1700ms]
 */
export function generateLeadingSilence(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const silenceSamples = Math.round(sampleRate * 0.3);
  const toneSamples = Math.round(sampleRate * 1.7);
  const total = silenceSamples + toneSamples;
  const buffer = new Int16Array(total);

  for (let i = silenceSamples; i < total; i++) {
    // Short 5ms fade-in to avoid a click at the transition
    const fadeIn = Math.min(1, (i - silenceSamples) / (sampleRate * 0.005));
    buffer[i] = Math.round(toneAtSample(i, sampleRate, fadeIn) * 32767);
  }

  return buffer;
}

/**
 * Sustained tone → trailing silence.
 *
 * Tests that trailing silence is detected and trimmed, and
 * candidates are found before the silence begins.
 *
 * Shape: [tone 1500ms] [silence 500ms]
 */
export function generateTrailingSilence(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const toneSamples = Math.round(sampleRate * 1.5);
  const silenceSamples = Math.round(sampleRate * 0.5);
  const total = toneSamples + silenceSamples;
  const buffer = new Int16Array(total);

  for (let i = 0; i < toneSamples; i++) {
    // Short 5ms fade-out at the end of the tone
    const fadeOut = Math.min(1, (toneSamples - i) / (sampleRate * 0.005));
    buffer[i] = Math.round(toneAtSample(i, sampleRate, fadeOut) * 32767);
  }

  return buffer;
}

/**
 * Constant exponential decay — no sustain region.
 *
 * Tests that the algorithm correctly identifies this as a
 * decaying sample with no usable loop region (should throw
 * LoopDetectionError with code 'decaying_sample').
 *
 * Shape: [exponential decay over 2s from full amplitude to ~-60dB]
 */
export function generateConstantDecay(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const total = Math.round(sampleRate * 2);
  const buffer = new Int16Array(total);

  // Time constant chosen so amplitude drops to ~0.001 (-60dB) by end
  const tau = total / Math.log(1000);

  for (let i = 0; i < total; i++) {
    const envelope = Math.exp(-i / tau);
    buffer[i] = Math.round(toneAtSample(i, sampleRate, envelope) * 32767);
  }

  return buffer;
}

/**
 * Attack/decay into sustained tone.
 *
 * The classic sampled instrument shape. Tests that the transient
 * excluder identifies the sustain start after the initial decay,
 * and candidates are found in the sustain region.
 *
 * Shape: [attack 10ms] [decay 190ms to 0.6] [sustain 1800ms at 0.6]
 */
export function generateDecayIntoSustain(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const attackMs = 10;
  const decayMs = 190;
  const sustainLevel = 0.6;
  const totalMs = 2000;

  const attackSamples = Math.round(sampleRate * attackMs / 1000);
  const decaySamples = Math.round(sampleRate * decayMs / 1000);
  const total = Math.round(sampleRate * totalMs / 1000);
  const buffer = new Int16Array(total);

  for (let i = 0; i < total; i++) {
    let envelope: number;

    if (i < attackSamples) {
      // Linear attack
      envelope = i / attackSamples;
    } else if (i < attackSamples + decaySamples) {
      // Exponential decay from 1.0 to sustainLevel
      const decayProgress = (i - attackSamples) / decaySamples;
      envelope = sustainLevel + (1 - sustainLevel) * Math.exp(-decayProgress * 5);
    } else {
      // Sustain
      envelope = sustainLevel;
    }

    buffer[i] = Math.round(toneAtSample(i, sampleRate, envelope) * 32767);
  }

  return buffer;
}

/**
 * Sustained tone with trailing decay.
 *
 * Tests that candidates are found in the sustain region before
 * the decay begins, not in the decaying tail.
 *
 * Shape: [sustain 1500ms at 0.8] [decay 500ms from 0.8 to ~0]
 */
export function generateSustainWithTrailingDecay(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const sustainMs = 1500;
  const decayMs = 500;
  const sustainLevel = 0.8;

  const sustainSamples = Math.round(sampleRate * sustainMs / 1000);
  const decaySamples = Math.round(sampleRate * decayMs / 1000);
  const total = sustainSamples + decaySamples;
  const buffer = new Int16Array(total);

  for (let i = 0; i < total; i++) {
    let envelope: number;

    if (i < sustainSamples) {
      envelope = sustainLevel;
    } else {
      // Exponential decay
      const decayProgress = (i - sustainSamples) / decaySamples;
      envelope = sustainLevel * Math.exp(-decayProgress * 5);
    }

    buffer[i] = Math.round(toneAtSample(i, sampleRate, envelope) * 32767);
  }

  return buffer;
}

/**
 * Pure sustained tone — ideal loopable signal.
 *
 * Control case: constant-amplitude tone for the full duration.
 * The algorithm should find excellent candidates with high scores.
 *
 * Shape: [sustain 2000ms at 0.8]
 */
export function generatePureSustain(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const total = Math.round(sampleRate * 2);
  const buffer = new Int16Array(total);

  for (let i = 0; i < total; i++) {
    buffer[i] = Math.round(toneAtSample(i, sampleRate, 0.8) * 32767);
  }

  return buffer;
}

/**
 * Sustained tone with a deliberate phase discontinuity at the splice point.
 *
 * Tests that the smoothing algorithm detects and fixes the discontinuity.
 * The waveform inverts phase 200 samples before loopEnd, creating a
 * click when looping that crossfade smoothing should eliminate.
 *
 * Shape: [440 Hz sine at 0.8, phase inverts at loopEnd - 200]
 * Loop region: samples 9000..45000
 */
export function generateDiscontinuity(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const total = Math.round(sampleRate * 2);
  const buffer = new Int16Array(total);
  const loopEnd = 45000;

  for (let i = 0; i < total; i++) {
    const t = i / sampleRate;
    const phaseOffset = (i >= loopEnd - 200) ? Math.PI : 0;
    buffer[i] = Math.round(Math.sin(2 * Math.PI * 440 * t + phaseOffset) * 0.8 * 32767);
  }

  return buffer;
}
