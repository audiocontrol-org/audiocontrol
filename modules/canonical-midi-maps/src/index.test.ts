import { describe, it, expect } from 'vitest';
import * as canonicalMidiMaps from './index.js';

describe('canonical-midi-maps', () => {
  it('exports module members', () => {
    expect(canonicalMidiMaps).toBeTypeOf('object');
  });
});
