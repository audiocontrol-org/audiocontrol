/**
 * akai-filter-adapter — unit tests for the AcFrequencyResponse →
 * S3000XL FILFRQ + FILQ wire-format adapter.
 *
 * Regression coverage for AUDIT-20260524-14. The canonical
 * `AcFrequencyResponse` primitive intentionally works in continuous
 * numeric space (drag emits floats); the S3000XL device fields are
 * integer-only. The adapter at the keygroup-editor boundary is the
 * last trusted point where the integer contract must be enforced.
 *
 * Validator-paired-changes discipline: every assertion below is
 * adversarial — when re-run against the pre-fix code path (which
 * forwarded `changes.resonance` straight through with no round + no
 * clamp), the fractional + boundary cases fail with the exact
 * "expected X to be Y" messages quoted in the dispatch report.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AKAI_FILQ_MAX,
  AKAI_FILQ_MIN,
  AKAI_FILTER_FREQ_RANGE_MAX,
  clampToFilq,
  dispatchAkaiFilterChange,
  filfrqToHz,
  hzToFilfrq,
} from '@/components/keygroups/akai-filter-adapter';

describe('clampToFilq — pure helper', () => {
  it('rounds a fractional resonance value to the nearest integer (down)', () => {
    expect(clampToFilq(7.3)).toBe(7);
  });

  it('rounds a fractional resonance value to the nearest integer (up)', () => {
    expect(clampToFilq(11.8)).toBe(12);
  });

  it('clamps a resonance value above FILQ_MAX (15) to 15', () => {
    expect(clampToFilq(20)).toBe(AKAI_FILQ_MAX);
  });

  it('clamps a resonance value above FILQ_MAX (15) with fractional part to 15', () => {
    expect(clampToFilq(15.7)).toBe(AKAI_FILQ_MAX);
  });

  it('clamps a negative resonance value to FILQ_MIN (0)', () => {
    expect(clampToFilq(-5)).toBe(AKAI_FILQ_MIN);
  });

  it('clamps a negative fractional resonance value to FILQ_MIN (0)', () => {
    expect(clampToFilq(-0.4)).toBe(AKAI_FILQ_MIN);
  });

  it('preserves an integer in range as-is', () => {
    expect(clampToFilq(8)).toBe(8);
  });

  it('handles the exact integer boundaries', () => {
    expect(clampToFilq(AKAI_FILQ_MIN)).toBe(AKAI_FILQ_MIN);
    expect(clampToFilq(AKAI_FILQ_MAX)).toBe(AKAI_FILQ_MAX);
  });
});

describe('hzToFilfrq + filfrqToHz — round-trip and bounds', () => {
  it('hzToFilfrq always returns an integer in 0..99 range', () => {
    expect(Number.isInteger(hzToFilfrq(20))).toBe(true);
    expect(Number.isInteger(hzToFilfrq(1000))).toBe(true);
    expect(Number.isInteger(hzToFilfrq(20_000))).toBe(true);
  });

  it('hzToFilfrq clamps below the min frequency to 0', () => {
    expect(hzToFilfrq(20)).toBe(0);
    expect(hzToFilfrq(5)).toBe(0);
  });

  it('hzToFilfrq clamps above the max frequency to FILTER_FREQ_RANGE_MAX', () => {
    expect(hzToFilfrq(20_000)).toBe(AKAI_FILTER_FREQ_RANGE_MAX);
    expect(hzToFilfrq(40_000)).toBe(AKAI_FILTER_FREQ_RANGE_MAX);
  });

  it('round-trips through filfrqToHz → hzToFilfrq at the boundaries', () => {
    expect(hzToFilfrq(filfrqToHz(0))).toBe(0);
    expect(hzToFilfrq(filfrqToHz(AKAI_FILTER_FREQ_RANGE_MAX))).toBe(
      AKAI_FILTER_FREQ_RANGE_MAX,
    );
  });
});

describe('dispatchAkaiFilterChange — wire-format dispatch (AUDIT-20260524-14)', () => {
  // The hard tests this audit asks for: fractional resonance values
  // must round to integer FILQ writes; boundary-out resonance values
  // must clamp.

  it('a fractional resonance of 7.3 is rounded to a FILQ write of 7', () => {
    const dispatch = vi.fn();
    dispatchAkaiFilterChange({ resonance: 7.3 }, dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('FILQ', 7);
  });

  it('a fractional resonance of 11.8 is rounded to a FILQ write of 12', () => {
    const dispatch = vi.fn();
    dispatchAkaiFilterChange({ resonance: 11.8 }, dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('FILQ', 12);
  });

  it('a resonance above 15 is clamped to the FILQ_MAX of 15', () => {
    const dispatch = vi.fn();
    dispatchAkaiFilterChange({ resonance: 20 }, dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('FILQ', 15);
  });

  it('a negative resonance is clamped to the FILQ_MIN of 0', () => {
    const dispatch = vi.fn();
    dispatchAkaiFilterChange({ resonance: -5 }, dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith('FILQ', 0);
  });

  it('a fractional out-of-range resonance is BOTH rounded and clamped (15.7 → 15)', () => {
    const dispatch = vi.fn();
    dispatchAkaiFilterChange({ resonance: 15.7 }, dispatch);
    expect(dispatch).toHaveBeenCalledWith('FILQ', 15);
  });

  it('a frequency change rounds + clamps the Hz value to the integer FILFRQ range', () => {
    const dispatch = vi.fn();
    // 1000 Hz is mid-log-range; hzToFilfrq returns an integer 0..99.
    dispatchAkaiFilterChange({ frequency: 1000 }, dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    const [field, value] = dispatch.mock.calls[0]!;
    expect(field).toBe('FILFRQ');
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThanOrEqual(AKAI_FILTER_FREQ_RANGE_MAX);
  });

  it('a frequency above the max range clamps to FILTER_FREQ_RANGE_MAX', () => {
    const dispatch = vi.fn();
    dispatchAkaiFilterChange({ frequency: 50_000 }, dispatch);
    expect(dispatch).toHaveBeenCalledWith('FILFRQ', AKAI_FILTER_FREQ_RANGE_MAX);
  });

  it('a frequency below the min range clamps to 0', () => {
    const dispatch = vi.fn();
    dispatchAkaiFilterChange({ frequency: 5 }, dispatch);
    expect(dispatch).toHaveBeenCalledWith('FILFRQ', 0);
  });

  it('both frequency and resonance in one call dispatch BOTH field writes (integer)', () => {
    const dispatch = vi.fn();
    dispatchAkaiFilterChange({ frequency: 800, resonance: 4.6 }, dispatch);
    expect(dispatch).toHaveBeenCalledTimes(2);
    // Order: frequency, resonance.
    const [field0, value0] = dispatch.mock.calls[0]!;
    const [field1, value1] = dispatch.mock.calls[1]!;
    expect(field0).toBe('FILFRQ');
    expect(Number.isInteger(value0)).toBe(true);
    expect(field1).toBe('FILQ');
    expect(value1).toBe(5);
  });

  it('an empty changes object does not dispatch any field write', () => {
    const dispatch = vi.fn();
    dispatchAkaiFilterChange({}, dispatch);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('a changes object with only a frequency does not dispatch a resonance write', () => {
    const dispatch = vi.fn();
    dispatchAkaiFilterChange({ frequency: 800 }, dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toBe('FILFRQ');
  });

  it('a changes object with only a resonance does not dispatch a frequency write', () => {
    const dispatch = vi.fn();
    dispatchAkaiFilterChange({ resonance: 3.2 }, dispatch);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0]![0]).toBe('FILQ');
  });
});
