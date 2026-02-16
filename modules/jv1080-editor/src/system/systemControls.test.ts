import { describe, expect, it, vi } from 'vitest';
import {
  applyClockSource,
  applyPanelMode,
  applyPatchGroup,
  applyPatchGroupId,
  applyPatchNumber,
  applyPerformanceNumber,
  clamp7Bit,
  DEFAULT_SYSTEM_STATE,
  type Jv1080SystemClient,
} from '@/system/systemControls';

function mockClient(): Jv1080SystemClient {
  return {
    panelModePerformance: vi.fn(),
    panelModePatch: vi.fn(),
    panelModeGm: vi.fn(),
    setPerformanceNumber: vi.fn(),
    patchGroupUser: vi.fn(),
    patchGroupPcm: vi.fn(),
    setPatchGroupId: vi.fn(),
    setPatchNumber: vi.fn(),
    setInsertFx: vi.fn(),
    setChorusFx: vi.fn(),
    setReverbFx: vi.fn(),
    setPatchRemain: vi.fn(),
    setClockInternal: vi.fn(),
    setClockMidi: vi.fn(),
  };
}

describe('systemControls helpers', () => {
  it('provides defaults for phase 4 UI state', () => {
    expect(DEFAULT_SYSTEM_STATE.panelMode).toBe('performance');
    expect(DEFAULT_SYSTEM_STATE.clockSource).toBe('internal');
  });

  it('clamps 7-bit values', () => {
    expect(clamp7Bit(-4)).toBe(0);
    expect(clamp7Bit(5.9)).toBe(5);
    expect(clamp7Bit(200)).toBe(127);
  });

  it('maps panel mode selections to client calls', () => {
    const client = mockClient();

    applyPanelMode(client, 'performance');
    applyPanelMode(client, 'patch');
    applyPanelMode(client, 'gm');

    expect(client.panelModePerformance).toHaveBeenCalledOnce();
    expect(client.panelModePatch).toHaveBeenCalledOnce();
    expect(client.panelModeGm).toHaveBeenCalledOnce();
  });

  it('maps patch group and clock source selections to client calls', () => {
    const client = mockClient();

    applyPatchGroup(client, 'user');
    applyPatchGroup(client, 'pcm');
    applyClockSource(client, 'internal');
    applyClockSource(client, 'midi');

    expect(client.patchGroupUser).toHaveBeenCalledOnce();
    expect(client.patchGroupPcm).toHaveBeenCalledOnce();
    expect(client.setClockInternal).toHaveBeenCalledOnce();
    expect(client.setClockMidi).toHaveBeenCalledOnce();
  });

  it('clamps numeric controls before sending values', () => {
    const client = mockClient();

    applyPerformanceNumber(client, 300);
    applyPatchGroupId(client, -5);
    applyPatchNumber(client, 11.7);

    expect(client.setPerformanceNumber).toHaveBeenCalledWith(127);
    expect(client.setPatchGroupId).toHaveBeenCalledWith(0);
    expect(client.setPatchNumber).toHaveBeenCalledWith(11);
  });
});
