/**
 * Akai S3000XL filter-response adapter helpers.
 *
 * Bridges the canonical cross-editor `AcFrequencyResponse` primitive
 * (continuous Hz + dB + 0..15 resonance in floating-point space) onto
 * the S3000XL's integer device fields:
 *
 *   - `FILFRQ`  integer 0..99   (log-mapped to 20 Hz .. 20 kHz)
 *   - `FILQ`    integer 0..15   (1:1 with AcFrequencyResponse's default
 *                                resonance range)
 *
 * The primitive intentionally works in continuous numeric space — drag
 * moves emit floats inside the configured ranges. This module is the
 * last trusted boundary where the wire-format integer contract is
 * enforced. Float values that leak past here become floating-point
 * writes into integer S3000XL header fields, which is the
 * `AUDIT-20260524-14` regression class.
 *
 * Extracted as a separate module so the round + clamp behavior can be
 * unit-tested without standing up the full keygroup editor DOM.
 */

/** S3000XL FILFRQ wire-format range (integer 0..99). */
export const AKAI_FILTER_FREQ_RANGE_MAX = 99;

/** S3000XL FILQ wire-format range (integer 0..15). */
export const AKAI_FILQ_MIN = 0;
export const AKAI_FILQ_MAX = 15;

/** Display range AcFrequencyResponse sees for the FILFRQ axis (Hz). */
export const AKAI_FILTER_FREQ_MIN_HZ = 20;
export const AKAI_FILTER_FREQ_MAX_HZ = 20_000;

/** Canonical Hz range object passed to `AcFrequencyResponse.freqRange`. */
export const AKAI_FILTER_FREQ_HZ_RANGE = {
  min: AKAI_FILTER_FREQ_MIN_HZ,
  max: AKAI_FILTER_FREQ_MAX_HZ,
};

/** Canonical resonance range object passed to `AcFrequencyResponse.resonanceRange`. */
export const AKAI_FILTER_RESONANCE_RANGE = {
  min: AKAI_FILQ_MIN,
  max: AKAI_FILQ_MAX,
};

/**
 * Convert a 0..99 FILFRQ wire value to its display frequency in Hz,
 * using a log mapping (20 Hz .. ~20 kHz). Inverse of `hzToFilfrq`.
 *
 * Same curve the legacy `FilterDisplay` used before the
 * AcFrequencyResponse migration.
 */
export function filfrqToHz(filfrq: number): number {
  return (
    AKAI_FILTER_FREQ_MIN_HZ *
    Math.pow(
      AKAI_FILTER_FREQ_MAX_HZ / AKAI_FILTER_FREQ_MIN_HZ,
      filfrq / AKAI_FILTER_FREQ_RANGE_MAX,
    )
  );
}

/**
 * Convert a continuous-Hz drag value back to its integer FILFRQ wire
 * value, with explicit round + clamp to the 0..99 range. Inverse of
 * `filfrqToHz`.
 */
export function hzToFilfrq(hz: number): number {
  const ratio =
    Math.log(hz / AKAI_FILTER_FREQ_MIN_HZ) /
    Math.log(AKAI_FILTER_FREQ_MAX_HZ / AKAI_FILTER_FREQ_MIN_HZ);
  return Math.max(
    0,
    Math.min(AKAI_FILTER_FREQ_RANGE_MAX, Math.round(ratio * AKAI_FILTER_FREQ_RANGE_MAX)),
  );
}

/**
 * Round + clamp a continuous resonance value to the integer FILQ wire
 * range (0..15).
 *
 * AcFrequencyResponse emits floats during drag; FILQ is integer-only;
 * the legacy `FilterDisplay` clamped explicitly. Without this round,
 * drag moves can push `7.3` / `11.8` into the device header. See
 * `AUDIT-20260524-14` for the regression context.
 */
export function clampToFilq(value: number): number {
  return Math.max(AKAI_FILQ_MIN, Math.min(AKAI_FILQ_MAX, Math.round(value)));
}

/**
 * Dispatcher used by the keygroup editor's AcFrequencyResponse
 * `onChange` callback. Accepts the primitive's float payload and emits
 * integer field-writes through the supplied `dispatch` function.
 *
 * Pure function — no DOM, no React. Unit-testable in isolation.
 */
export function dispatchAkaiFilterChange(
  changes: { frequency?: number; resonance?: number },
  dispatch: (field: 'FILFRQ' | 'FILQ', value: number) => void,
): void {
  if (changes.frequency !== undefined) {
    dispatch('FILFRQ', hzToFilfrq(changes.frequency));
  }
  if (changes.resonance !== undefined) {
    dispatch('FILQ', clampToFilq(changes.resonance));
  }
}
