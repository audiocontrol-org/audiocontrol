/**
 * Basic smoke tests for loop-editor exports.
 */

import { describe, it, expect } from 'vitest';
import type { LoopDetectionProgress } from './types';

describe('LoopDetectionProgress type', () => {
  it('can construct a valid progress object', () => {
    const progress: LoopDetectionProgress = {
      percent: 50,
      stage: 'NCC scoring',
    };
    expect(progress.percent).toBe(50);
    expect(progress.stage).toBe('NCC scoring');
  });
});
