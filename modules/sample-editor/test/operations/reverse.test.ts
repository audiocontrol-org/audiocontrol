import { describe, it, expect } from 'vitest';
import { reverseSamples } from '@/operations/reverse';

describe('reverseSamples', () => {
  it('reverses order', () => {
    const samples = new Int16Array([100, 200, 300, 400, 500]);
    const result = reverseSamples(samples);
    expect(Array.from(result)).toEqual([500, 400, 300, 200, 100]);
  });

  it('handles single sample', () => {
    const samples = new Int16Array([42]);
    const result = reverseSamples(samples);
    expect(Array.from(result)).toEqual([42]);
  });

  it('does not modify original', () => {
    const samples = new Int16Array([100, 200, 300]);
    const original = new Int16Array(samples);
    reverseSamples(samples);
    expect(Array.from(samples)).toEqual(Array.from(original));
  });

  it('handles empty array', () => {
    const result = reverseSamples(new Int16Array(0));
    expect(result.length).toBe(0);
  });
});
