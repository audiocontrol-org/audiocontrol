import { describe, expect, it, vi } from 'vitest';
import {
  applyFxParam,
  applyFxType,
  clamp7Bit,
  clampFxType,
  DEFAULT_FX_STATE,
  FX_PARAM_COUNT,
  FX_TYPE_LABELS,
  type FxClient,
} from '@/system/fxControls';

function mockClient(): FxClient {
  return {
    setFx: vi.fn(),
    setFxParam: vi.fn(),
  };
}

describe('fxControls helpers', () => {
  it('exposes stable defaults', () => {
    expect(DEFAULT_FX_STATE.fxType).toBe(0);
    expect(DEFAULT_FX_STATE.fxParams).toHaveLength(FX_PARAM_COUNT);
    expect(DEFAULT_FX_STATE.fxParams.every((n) => n === 0)).toBe(true);
  });

  it('clamps fx type and parameter values', () => {
    expect(clampFxType(-1)).toBe(0);
    expect(clampFxType(999)).toBe(FX_TYPE_LABELS.length - 1);
    expect(clamp7Bit(-10)).toBe(0);
    expect(clamp7Bit(200)).toBe(127);
    expect(clamp7Bit(12.8)).toBe(12);
  });

  it('maps fx type writes to client', () => {
    const client = mockClient();

    const value = applyFxType(client, 5);
    expect(value).toBe(5);
    expect(client.setFx).toHaveBeenCalledWith(5);
  });

  it('maps fx parameter writes to client', () => {
    const client = mockClient();

    const value = applyFxParam(client, 2, 300);
    expect(value).toBe(127);
    expect(client.setFxParam).toHaveBeenCalledWith(2, 127);
  });

  it('throws when fx parameter index is invalid', () => {
    const client = mockClient();

    expect(() => applyFxParam(client, -1, 20)).toThrow('FX parameter index out of range: -1');
    expect(() => applyFxParam(client, FX_PARAM_COUNT, 20)).toThrow(`FX parameter index out of range: ${FX_PARAM_COUNT}`);
  });
});
