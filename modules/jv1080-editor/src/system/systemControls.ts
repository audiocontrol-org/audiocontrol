export type PanelMode = 'performance' | 'patch' | 'gm';
export type PatchGroup = 'user' | 'pcm';
export type ClockSource = 'internal' | 'midi';

export interface Jv1080SystemState {
  panelMode: PanelMode;
  performanceNumber: number;
  patchGroup: PatchGroup;
  patchGroupId: number;
  patchNumber: number;
  insertFx: boolean;
  chorusFx: boolean;
  reverbFx: boolean;
  patchRemain: boolean;
  clockSource: ClockSource;
}

export interface Jv1080SystemClient {
  panelModePerformance(): void;
  panelModePatch(): void;
  panelModeGm(): void;
  setPerformanceNumber(value: number): void;
  patchGroupUser(): void;
  patchGroupPcm(): void;
  setPatchGroupId(value: number): void;
  setPatchNumber(value: number): void;
  setInsertFx(enabled: boolean): void;
  setChorusFx(enabled: boolean): void;
  setReverbFx(enabled: boolean): void;
  setPatchRemain(enabled: boolean): void;
  setClockInternal(): void;
  setClockMidi(): void;
}

export const DEFAULT_SYSTEM_STATE: Jv1080SystemState = {
  panelMode: 'performance',
  performanceNumber: 0,
  patchGroup: 'user',
  patchGroupId: 0,
  patchNumber: 0,
  insertFx: true,
  chorusFx: true,
  reverbFx: true,
  patchRemain: false,
  clockSource: 'internal',
};

export function clamp7Bit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(127, Math.floor(value)));
}

export function applyPanelMode(client: Jv1080SystemClient, value: PanelMode): void {
  if (value === 'performance') {
    client.panelModePerformance();
    return;
  }
  if (value === 'patch') {
    client.panelModePatch();
    return;
  }
  client.panelModeGm();
}

export function applyPatchGroup(client: Jv1080SystemClient, value: PatchGroup): void {
  if (value === 'user') {
    client.patchGroupUser();
    return;
  }
  client.patchGroupPcm();
}

export function applyClockSource(client: Jv1080SystemClient, value: ClockSource): void {
  if (value === 'internal') {
    client.setClockInternal();
    return;
  }
  client.setClockMidi();
}

export function applyPerformanceNumber(client: Jv1080SystemClient, value: number): void {
  client.setPerformanceNumber(clamp7Bit(value));
}

export function applyPatchGroupId(client: Jv1080SystemClient, value: number): void {
  client.setPatchGroupId(clamp7Bit(value));
}

export function applyPatchNumber(client: Jv1080SystemClient, value: number): void {
  client.setPatchNumber(clamp7Bit(value));
}
