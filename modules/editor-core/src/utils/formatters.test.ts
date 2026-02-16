import { describe, expect, it } from 'vitest';
import { formatKeyfollow, formatPan, formatPercent, formatPitch, formatSigned } from './formatters';

describe('formatters', () => {
  it('formats percentages', () => {
    expect(formatPercent(64, 127)).toBe('50%');
  });

  it('formats signed values', () => {
    expect(formatSigned(50, 50)).toBe('0');
    expect(formatSigned(60, 50)).toBe('+10');
    expect(formatSigned(40, 50)).toBe('-10');
  });

  it('formats pitch names', () => {
    expect(formatPitch(60)).toBe('C4');
    expect(formatPitch(61)).toBe('C#4');
  });

  it('formats keyfollow labels', () => {
    expect(formatKeyfollow(0)).toBe('-1');
    expect(formatKeyfollow(11)).toBe('1');
    expect(formatKeyfollow(99)).toBe('99');
  });

  it('formats pan values', () => {
    expect(formatPan(64)).toBe('C');
    expect(formatPan(60)).toBe('L4');
    expect(formatPan(70)).toBe('R6');
  });
});
