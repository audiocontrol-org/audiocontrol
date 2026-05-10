import type { MidiPortInfo } from '@audiocontrol/midi-core';
import {
  createMockMidiTransport,
  type MockMidiTransportControls,
  type MockMidiTransportOptions,
} from '@/transports/mockMidiTransport';
import { createWebMidiTransport } from '@/transports/webMidiTransport';
import { createHttpMidiTransport } from '@/transports/httpMidiTransport';
import { createScsiMidiTransport } from '@/transports/scsiMidiTransport';
import type { MidiTransport } from '@/transports/types';

export type TransportMode = 'web' | 'mock' | 'http' | 'scsi' | 'simulated';

export interface RuntimeMockMidiConfig extends MockMidiTransportOptions {
  enabled?: boolean;
  autoSelectPorts?: boolean;
}

export interface RuntimeHttpMidiConfig {
  serverUrl: string;
}

export interface RuntimeScsiMidiConfig {
  bridgeUrl: string;
}

export interface RuntimeMidiTransportConfig {
  deviceName: string;
  mock?: RuntimeMockMidiConfig;
  http?: RuntimeHttpMidiConfig;
  scsi?: RuntimeScsiMidiConfig;
}

export interface RuntimeMidiTransportResult {
  mode: TransportMode;
  transport: MidiTransport;
  controls?: MockMidiTransportControls;
}

export interface TransportConfig {
  mode: TransportMode;
  httpServerUrl?: string;
  scsiBridgeUrl?: string;
}

const TRANSPORT_STORAGE_KEY = 'midi-transport-config';

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

export function isScsiMidiMode(): boolean {
  return getQueryParam('midi') === 'scsi';
}

export function isSimulatedMidiMode(): boolean {
  return getQueryParam('midi') === 'simulated';
}

export function getSimulatedScenario(): string | null {
  return getQueryParam('scenario');
}

export function getHttpMidiServerUrl(): string | null {
  const port = getQueryParam('midiServerPort');
  if (!port) return null;
  return `http://localhost:${port}`;
}

export function getScsiBridgeUrl(): string | null {
  return getQueryParam('scsiBridgeUrl');
}

export function isMockLibraryMode(): boolean {
  return getQueryParam('library') === 'mock';
}

/**
 * Get saved transport configuration from localStorage.
 */
export function getSavedTransportConfig(): TransportConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = localStorage.getItem(TRANSPORT_STORAGE_KEY);
    if (!saved) return null;
    return JSON.parse(saved) as TransportConfig;
  } catch {
    return null;
  }
}

/**
 * Save transport configuration to localStorage.
 */
export function saveTransportConfig(config: TransportConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TRANSPORT_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // localStorage can be unavailable in strict browser contexts.
  }
}

/**
 * Clear saved transport configuration.
 */
export function clearTransportConfig(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TRANSPORT_STORAGE_KEY);
  } catch {
    // localStorage can be unavailable in strict browser contexts.
  }
}

/**
 * Get the currently active transport mode.
 * Priority: URL params > localStorage > default (web)
 */
export function getActiveTransportMode(): TransportMode {
  // URL params take precedence (for E2E testing).
  // Check simulated FIRST so the harness URL wins over any conflicting state.
  if (isSimulatedMidiMode()) return 'simulated';
  if (isHttpMidiMode()) return 'http';
  if (isScsiMidiMode()) return 'scsi';
  if (isMockMidiMode()) return 'mock';

  // Check localStorage
  const saved = getSavedTransportConfig();
  if (saved) return saved.mode;

  // Default to web
  return 'web';
}

/**
 * Get the HTTP server URL from URL params or localStorage.
 */
export function getActiveHttpServerUrl(): string | null {
  // URL params take precedence
  const urlParam = getHttpMidiServerUrl();
  if (urlParam) return urlParam;

  // Check localStorage
  const saved = getSavedTransportConfig();
  if (saved?.mode === 'http' && saved.httpServerUrl) {
    return saved.httpServerUrl;
  }

  return null;
}

/**
 * Get the SCSI bridge URL from URL params or localStorage.
 */
export function getActiveScsiUrl(): string | null {
  // URL params take precedence
  const urlParam = getScsiBridgeUrl();
  if (urlParam) return urlParam;

  // Check localStorage
  const saved = getSavedTransportConfig();
  if (saved?.mode === 'scsi' && saved.scsiBridgeUrl) {
    return saved.scsiBridgeUrl;
  }

  return null;
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
  const activeMode = getActiveTransportMode();

  // Simulated mode is owned by the per-editor store (see e.g.
  // roland-sxx0-editor's midiStore.createTransportForDevice). The runtime
  // dispatcher has no way to construct a SimulatedAdapter without a fixture
  // path, so failing loud beats falling through to web silently.
  if (activeMode === 'simulated') {
    throw new Error(
      '?midi=simulated reached createRuntimeMidiTransport(). ' +
      'Editors that support fixture replay must dispatch the simulated ' +
      'transport themselves (see roland-sxx0-editor/src/stores/midiStore.ts). ' +
      'This editor does not yet support ?midi=simulated.'
    );
  }

  // HTTP mode
  if (activeMode === 'http') {
    const serverUrl = config.http?.serverUrl ?? getActiveHttpServerUrl();
    if (!serverUrl) {
      throw new Error(
        'HTTP MIDI mode requires server URL. ' +
        'Set via URL parameter (?midi=http&midiServerPort=PORT) or connection settings.'
      );
    }
    return {
      mode: 'http',
      transport: createHttpMidiTransport({ serverUrl }),
    };
  }

  // SCSI mode
  if (activeMode === 'scsi') {
    const bridgeUrl = config.scsi?.bridgeUrl ?? getActiveScsiUrl();
    if (!bridgeUrl) {
      throw new Error(
        'SCSI MIDI mode requires bridge URL. ' +
        'Set via URL parameter (?midi=scsi&scsiBridgeUrl=URL) or connection settings.'
      );
    }
    return {
      mode: 'scsi',
      transport: createScsiMidiTransport({ bridgeUrl }),
    };
  }

  // Mock mode
  const useMockMidi = activeMode === 'mock' || (Boolean(config.mock) && config.mock?.enabled);
  if (useMockMidi && config.mock) {
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
