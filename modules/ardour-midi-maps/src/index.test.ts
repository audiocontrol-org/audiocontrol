import { describe, it, expect } from 'vitest';
import * as ardourMidiMaps from './index.js';

describe('ardour-midi-maps', () => {
  it('exports module members', () => {
    expect(ardourMidiMaps).toBeTypeOf('object');
  });
});
