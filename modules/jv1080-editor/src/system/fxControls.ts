import { JV_1080_FX_PARAM_COUNT, JV_1080_FX_TYPES } from '@audiocontrol/sampler-devices/jv1080';

export interface FxState {
  fxType: number;
  fxParams: number[];
}

export interface FxClient {
  setFx(value: number): void;
  setFxParam(index: number, value: number): void;
}

export const FX_PARAM_COUNT = JV_1080_FX_PARAM_COUNT;
export const FX_TYPE_LABELS = JV_1080_FX_TYPES;

export const DEFAULT_FX_STATE: FxState = {
  fxType: 0,
  fxParams: new Array<number>(FX_PARAM_COUNT).fill(0),
};

export function clamp7Bit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(127, Math.floor(value)));
}

export function clampFxType(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const max = FX_TYPE_LABELS.length - 1;
  return Math.max(0, Math.min(max, Math.floor(value)));
}

export function applyFxType(client: FxClient, value: number): number {
  const clamped = clampFxType(value);
  client.setFx(clamped);
  return clamped;
}

export function applyFxParam(client: FxClient, index: number, value: number): number {
  if (index < 0 || index >= FX_PARAM_COUNT) {
    throw new Error(`FX parameter index out of range: ${index}`);
  }
  const clamped = clamp7Bit(value);
  client.setFxParam(index, clamped);
  return clamped;
}
