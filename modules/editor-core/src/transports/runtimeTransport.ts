import type { MidiPortInfo } from '@audiocontrol/shared-midi';
import {
  createMockMidiTransport,
  type MockMidiTransportControls,
  type MockMidiTransportOptions,
} from '@/transports/mockMidiTransport';
import { createWebMidiTransport } from '@/transports/webMidiTransport';
import { createHttpMidiTransport } from '@/transports/httpMidiTransport';
import type { MidiTransport } from '@/transports/types';

export interface RuntimeMockMidiConfig extends MockMidiTransportOptions {
  enabled?: boolean;
  autoSelectPorts?: boolean;
}

export interface RuntimeHttpMidiConfig {
  serverUrl: string;
}

export interface RuntimeMidiTransportConfig {
  deviceName: string;
  mock?: RuntimeMockMidiConfig;
  http?: RuntimeHttpMidiConfig;
}

export interface RuntimeMidiTransportResult {
  mode: 'web' | 'mock' | 'http';
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

export function isHttpMidiMode(): boolean {
  return getQueryParam('midi') === 'http';
}

export function getHttpMidiServerUrl(): string | null {
  const port = getQueryParam('midiServerPort');
  if (!port) return null;
  return `http://localhost:${port}`;
}

export function isMockLibraryMode(): boolean {
  return getQueryParam('library') === 'mock';
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
  // HTTP mode takes precedence (for E2E testing)
  if (isHttpMidiMode()) {
    const serverUrl = config.http?.serverUrl ?? getHttpMidiServerUrl();
    if (!serverUrl) {
      throw new Error('HTTP MIDI mode requires midiServerPort URL parameter or http.serverUrl config');
    }
    return {
      mode: 'http',
      transport: createHttpMidiTransport({ serverUrl }),
    };
  }

  // Mock mode
  const useMockMidi = Boolean(config.mock) && (config.mock?.enabled ?? isMockMidiMode());
  if (useMockMidi) {
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

  // Default to web
  return { mode: 'web', transport: createWebMidiTransport() };
}
