import type { S330Patch, S330Tone } from '@/core/midi/S330Client';
import { useDeviceDataStore } from '@/stores/deviceDataStore';
import { useS330Store } from '@/stores/editorStore';

const MOCK_PATCH_NAMES = [
  'MINI',
  'MINI LESLIE',
  'KIT',
  'KICK',
  'SNARE',
  'HHC',
  'HHO',
  'SINE',
];

const MOCK_TONE_NAMES = [
  'MINI',
  'MINI LESLIE',
  'KIT',
  'KICK',
  'SNARE',
  'HHC',
  'HHO',
  'SINE',
];

export const MOCK_PLAY_PARTS = [
  { id: 'A', channel: 0, patchIndex: 3, output: 1, level: 127, active: true },
  { id: 'B', channel: 0, patchIndex: 4, output: 2, level: 127, active: true },
  { id: 'C', channel: 0, patchIndex: 5, output: 1, level: 127, active: true },
  { id: 'D', channel: 0, patchIndex: 6, output: 1, level: 127, active: true },
  { id: 'E', channel: 1, patchIndex: 0, output: 1, level: 127, active: true },
  { id: 'F', channel: 2, patchIndex: 1, output: 2, level: 127, active: true },
  { id: 'G', channel: 3, patchIndex: 7, output: 1, level: 127, active: true },
  { id: 'H', channel: 4, patchIndex: null, output: 1, level: 127, active: true },
] as const;

function createMockPatch(name: string): S330Patch {
  return { common: { name } } as unknown as S330Patch;
}

function createMockTone(name: string): S330Tone {
  return { name } as unknown as S330Tone;
}

export function seedS330MockState(): void {
  const deviceData = useDeviceDataStore.getState();
  const ui = useS330Store.getState();

  // Avoid clobbering after initial seed.
  if (deviceData.patches.length > 0 || deviceData.tones.length > 0) return;

  const patches: (S330Patch | undefined)[] = new Array(16).fill(undefined);
  for (let i = 0; i < MOCK_PATCH_NAMES.length; i += 1) {
    patches[i] = createMockPatch(MOCK_PATCH_NAMES[i]);
  }

  const tones: (S330Tone | undefined)[] = new Array(32).fill(undefined);
  for (let i = 0; i < MOCK_TONE_NAMES.length; i += 1) {
    tones[i] = createMockTone(MOCK_TONE_NAMES[i]);
  }

  deviceData.setPatches(patches);
  deviceData.setTones(tones);
  deviceData.markPatchBankLoaded(0);
  deviceData.markToneBankLoaded(0);

  ui.selectPatch(null);
  ui.selectTone(null);
  ui.setError(null);
  ui.setLoading(false, null);
  ui.clearProgress();
}
