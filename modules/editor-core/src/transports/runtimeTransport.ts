import type { MidiPortInfo } from '@audiocontrol/shared-midi';
import {
  createMockMidiTransport,
  type MockMidiTransportControls,
  type MockMidiTransportOptions,
} from './mockMidiTransport';
import { createWebMidiTransport } from './webMidiTransport';
import type { MidiTransport } from './types';

export interface RuntimeMockMidiConfig extends MockMidiTransportOptions {
  enabled?: boolean;
  autoSelectPorts?: boolean;
}

export interface RuntimeMidiTransportConfig {
  deviceName: string;
  mock?: RuntimeMockMidiConfig;
}

export interface RuntimeMidiTransportResult {
  mode: 'web' | 'mock';
  transport: MidiTransport;
  controls?: MockMidiTransportControls;
}

function getQueryParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

export function isMockMidiMode(): boolean {
  return getQueryParam('midi') === 'mock';
}

function getFirstPortId(ports?: MidiPortInfo[]): string | null {
  if (!ports || ports.length === 0) return null;
  return ports[0]?.id ?? null;
}

function seedMockPortSelection(deviceName: string, inputs?: MidiPortInfo[], outputs?: MidiPortInfo[]): void {
  if (typeof window === 'undefined') return;
  try {
    const inputId = getFirstPortId(inputs);
    const outputId = getFirstPortId(outputs);
    if (inputId) localStorage.setItem(`${deviceName}-midi-input`, inputId);
    if (outputId) localStorage.setItem(`${deviceName}-midi-output`, outputId);
  } catch {
    // localStorage can be unavailable in strict browser contexts.
  }
}

export function createRuntimeMidiTransport(
  config: RuntimeMidiTransportConfig
): RuntimeMidiTransportResult {
  const useMockMidi = Boolean(config.mock) && (config.mock?.enabled ?? isMockMidiMode());
  if (!useMockMidi) {
    return { mode: 'web', transport: createWebMidiTransport() };
  }

  const runtime = createMockMidiTransport(config.mock);
  if (config.mock?.autoSelectPorts ?? true) {
    seedMockPortSelection(config.deviceName, config.mock?.inputs, config.mock?.outputs);
  }

  return {
    mode: 'mock',
    transport: runtime.transport,
    controls: runtime.controls,
  };
}
