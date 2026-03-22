/**
 * Test signal generators for sample chopper algorithm testing.
 *
 * Each generator produces an Int16Array with characteristics tailored
 * to exercise the transient detector, silence detector, and fixed slicer.
 *
 * All signals use a 440 Hz tone with harmonics, shaped by percussive
 * envelopes (fast attack, short decay) to create realistic drum-like hits.
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

/** Write a percussive hit into a buffer at a given position. */
function writeHit(
  buffer: Int16Array,
  startSample: number,
  sampleRate: number,
  amplitude: number,
  attackMs: number,
  decayMs: number,
): void {
  const attackSamples = Math.round(sampleRate * attackMs / 1000);
  const decaySamples = Math.round(sampleRate * decayMs / 1000);
  const totalSamples = attackSamples + decaySamples;

  for (let i = 0; i < totalSamples && startSample + i < buffer.length; i++) {
    let envelope: number;
    if (i < attackSamples) {
      envelope = i / attackSamples; // linear attack
    } else {
      envelope = 1 - (i - attackSamples) / decaySamples; // linear decay
    }
    const sample = toneAtSample(startSample + i, sampleRate, amplitude * envelope);
    buffer[startSample + i] = Math.round(sample * 32767);
  }
}

/**
 * Drum pattern — 4 evenly-spaced hits with clear silence between.
 *
 * Shape: [hit 0ms] [silence] [hit 200ms] [silence] [hit 400ms] [silence] [hit 600ms] [decay] [silence]
 * Each hit: 1ms attack, 50ms decay, 0.8 amplitude
 *
 * Tests: transient detection with clear, well-separated onsets.
 * Expected: 4 transients detected at default threshold.
 */
export function generateDrumPattern(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const duration = Math.round(sampleRate * 1.0); // 1 second
  const buffer = new Int16Array(duration);

  const hitPositions = [0, 200, 400, 600]; // milliseconds
  for (const posMs of hitPositions) {
    const startSample = Math.round(sampleRate * posMs / 1000);
    writeHit(buffer, startSample, sampleRate, 0.8, 1, 50);
  }

  return buffer;
}

/**
 * Silence gaps — 3 sound regions separated by clear silence.
 *
 * Shape: [tone 100ms] [silence 80ms] [tone 100ms] [silence 80ms] [tone 100ms]
 * Tone amplitude: 0.8
 *
 * Tests: strip-silence detection with gaps above minimum threshold.
 * Expected: 3 sound regions detected, 2 silence gaps identified.
 */
export function generateSilenceGaps(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const toneSamples = Math.round(sampleRate * 0.1);
  const silenceSamples = Math.round(sampleRate * 0.08);
  const total = toneSamples * 3 + silenceSamples * 2;
  const buffer = new Int16Array(total);

  let offset = 0;
  for (let region = 0; region < 3; region++) {
    for (let i = 0; i < toneSamples; i++) {
      buffer[offset + i] = Math.round(toneAtSample(offset + i, sampleRate, 0.8) * 32767);
    }
    offset += toneSamples;
    if (region < 2) {
      offset += silenceSamples; // silence gap (already zeroed)
    }
  }

  return buffer;
}

/**
 * Soft-loud — alternating quiet and loud hits.
 *
 * Shape: [soft hit 0.2] [silence] [loud hit 0.8] [silence] [soft hit 0.2] [silence] [loud hit 0.8]
 * Spacing: 150ms between hits, 1ms attack, 40ms decay
 *
 * Tests: threshold sensitivity — at a moderate threshold, only loud hits detected.
 * Expected at threshold 0.5: 2 loud hits. At threshold 0.1: all 4 hits.
 */
export function generateSoftLoud(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const duration = Math.round(sampleRate * 0.8);
  const buffer = new Int16Array(duration);

  const hits = [
    { posMs: 0, amplitude: 0.2 },
    { posMs: 150, amplitude: 0.8 },
    { posMs: 300, amplitude: 0.2 },
    { posMs: 450, amplitude: 0.8 },
  ];

  for (const hit of hits) {
    writeHit(buffer, Math.round(sampleRate * hit.posMs / 1000), sampleRate, hit.amplitude, 1, 40);
  }

  return buffer;
}

/**
 * Rapid fire — 8 very closely-spaced hits.
 *
 * Shape: 8 hits at 30ms intervals, each with 1ms attack and 20ms decay
 * Amplitude: 0.7
 *
 * Tests: minGap suppression — with 50ms default minGap, adjacent hits
 * should be suppressed since they're only 30ms apart.
 * Expected at 50ms minGap: ~4 hits (every other one suppressed).
 */
export function generateRapidFire(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const duration = Math.round(sampleRate * 0.5);
  const buffer = new Int16Array(duration);

  for (let i = 0; i < 8; i++) {
    const startSample = Math.round(sampleRate * i * 0.03); // 30ms spacing
    writeHit(buffer, startSample, sampleRate, 0.7, 1, 20);
  }

  return buffer;
}

/**
 * Fade-in hits — 4 hits with gradually increasing amplitude.
 *
 * Shape: [hit 0.1] [silence] [hit 0.3] [silence] [hit 0.6] [silence] [hit 0.9]
 * Spacing: 200ms, 1ms attack, 60ms decay
 *
 * Tests: varying detection threshold sensitivity.
 * Expected at threshold 0.5: 2 hits (0.6 and 0.9). At threshold 0.05: all 4.
 */
export function generateFadeInHits(sampleRate = DEFAULT_SAMPLE_RATE): Int16Array {
  const duration = Math.round(sampleRate * 1.0);
  const buffer = new Int16Array(duration);

  const amplitudes = [0.1, 0.3, 0.6, 0.9];
  for (let i = 0; i < amplitudes.length; i++) {
    writeHit(buffer, Math.round(sampleRate * i * 0.2), sampleRate, amplitudes[i]!, 1, 60);
  }

  return buffer;
}
