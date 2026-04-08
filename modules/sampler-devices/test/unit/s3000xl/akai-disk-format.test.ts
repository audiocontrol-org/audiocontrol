import { describe, it, expect } from 'vitest';
import { akaiToAscii, asciiToAkai } from '@/devices/s3000xl/akai-disk-format';

describe('akaiToAscii', () => {
  it('decodes numeric characters', () => {
    const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10]);
    expect(akaiToAscii(bytes)).toBe('0123456789');
  });

  it('decodes alphabetic characters', () => {
    const bytes = new Uint8Array([11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
    expect(akaiToAscii(bytes)).toBe('ABCDEFGHIJKL');
  });

  it('decodes space as 10', () => {
    const bytes = new Uint8Array([11, 10, 12, 10, 10, 10, 10, 10, 10, 10, 10, 10]);
    expect(akaiToAscii(bytes)).toBe('A B');
  });

  it('trims trailing spaces', () => {
    const bytes = new Uint8Array([23, 25, 25, 17, 10, 10, 10, 10, 10, 10, 10, 10]);
    expect(akaiToAscii(bytes)).toBe('MOOG');
  });

  it('decodes special characters', () => {
    const bytes = new Uint8Array([37, 38, 39, 40, 10, 10, 10, 10, 10, 10, 10, 10]);
    expect(akaiToAscii(bytes)).toBe('#+-.');
  });
});

describe('asciiToAkai', () => {
  it('encodes alphabetic string', () => {
    const result = asciiToAkai('MOOG');
    expect(result[0]).toBe(23); // M
    expect(result[1]).toBe(25); // O
    expect(result[2]).toBe(25); // O
    expect(result[3]).toBe(17); // G
    expect(result[4]).toBe(10); // space padding
  });

  it('converts lowercase to uppercase', () => {
    const result = asciiToAkai('moog');
    expect(result[0]).toBe(23); // M
  });

  it('pads to 12 characters', () => {
    const result = asciiToAkai('A');
    expect(result.length).toBe(12);
    expect(result[0]).toBe(11); // A
    for (let i = 1; i < 12; i++) {
      expect(result[i]).toBe(10); // space
    }
  });

  it('round-trips correctly', () => {
    const original = 'MOOGB3600 -L';
    const encoded = asciiToAkai(original);
    const decoded = akaiToAscii(encoded);
    expect(decoded).toBe(original);
  });
});
