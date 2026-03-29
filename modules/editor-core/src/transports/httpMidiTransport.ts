/**
 * HTTP MIDI Transport - MIDI communication via external midi-server
 *
 * This transport implements the MidiTransport interface using HTTP requests
 * to an external midi-server process. It uses Server-Sent Events (SSE) for
 * real-time incoming MIDI messages.
 *
 * This transport is designed for E2E testing where Web MIDI API's SysEx
 * permissions cause Chrome to crash in Playwright.
 */

import type { MidiIO, MidiPortInfo, SysExCallback } from '@audiocontrol/shared-midi';
import type {
  MidiTransport,
  MidiTransportBrowserInfo,
  MidiTransportConnection,
  MidiTransportPorts,
} from '@/transports/types';

export interface HttpMidiTransportConfig {
  serverUrl: string;
}

interface PortsResponse {
  inputs: string[];
  outputs: string[];
}

interface OpenPortResponse {
  success: boolean;
  error?: string;
}

interface SendResponse {
  success: boolean;
  error?: string;
}

async function fetchJson<T>(serverUrl: string, path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${serverUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function createHttpMidiAdapter(
  serverUrl: string,
  inputId: string,
  outputId: string
): { adapter: MidiIO; eventSource: EventSource } {
  const listeners = new Set<SysExCallback>();

  // Connect SSE for incoming messages
  const eventSource = new EventSource(`${serverUrl}/port/${encodeURIComponent(inputId)}/events`);

  eventSource.addEventListener('midi', (e: MessageEvent) => {
    try {
      const data = JSON.parse(e.data);
      const bytes: number[] = data.bytes;
      // Only dispatch SysEx messages (starting with 0xF0)
      if (bytes.length > 0 && bytes[0] === 0xf0) {
        listeners.forEach((cb) => cb(bytes));
      }
    } catch (err) {
      console.error('[HttpMidiTransport] Failed to parse SSE event:', err);
    }
  });

  eventSource.onerror = (err) => {
    console.error('[HttpMidiTransport] SSE error:', err);
  };

  const adapter: MidiIO = {
    send: (message: number[]) => {
      // Fire-and-forget send (don't await to match Web MIDI behavior)
      fetch(`${serverUrl}/port/${encodeURIComponent(outputId)}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      }).catch((err) => {
        console.error('[HttpMidiTransport] Send error:', err);
      });
    },
    onSysEx: (callback: SysExCallback) => {
      listeners.add(callback);
    },
    removeSysExListener: (callback: SysExCallback) => {
      listeners.delete(callback);
    },
  };

  return { adapter, eventSource };
}

export function createHttpMidiTransport(config: HttpMidiTransportConfig): MidiTransport {
  const { serverUrl } = config;
  let stateHandler: (() => void) | null = null;

  const browserInfo: MidiTransportBrowserInfo = {
    supported: true,
    browser: 'HTTP MIDI',
    notes: 'MIDI via external midi-server process. Used for E2E testing.',
  };

  return {
    kind: 'http-midi',

    isSupported: () => true,

    getBrowserInfo: () => browserInfo,

    initialize: async (): Promise<MidiTransportPorts> => {
      const ports = await fetchJson<PortsResponse>(serverUrl, '/ports');

      const inputs: MidiPortInfo[] = ports.inputs.map((name, idx) => ({
        id: `input-${idx}`,
        name,
        state: 'connected' as const,
      }));

      const outputs: MidiPortInfo[] = ports.outputs.map((name, idx) => ({
        id: `output-${idx}`,
        name,
        state: 'connected' as const,
      }));

      return { inputs, outputs, sysExEnabled: true };
    },

    refresh: async (): Promise<MidiTransportPorts> => {
      const ports = await fetchJson<PortsResponse>(serverUrl, '/ports');

      const inputs: MidiPortInfo[] = ports.inputs.map((name, idx) => ({
        id: `input-${idx}`,
        name,
        state: 'connected' as const,
      }));

      const outputs: MidiPortInfo[] = ports.outputs.map((name, idx) => ({
        id: `output-${idx}`,
        name,
        state: 'connected' as const,
      }));

      return { inputs, outputs, sysExEnabled: true };
    },

    onStateChange: (handler) => {
      stateHandler = handler;
    },

    connect: async (inputId: string, outputId: string): Promise<MidiTransportConnection> => {
      // Get port list to resolve names
      const ports = await fetchJson<PortsResponse>(serverUrl, '/ports');

      // Parse input/output indices from IDs
      const inputIdx = parseInt(inputId.replace('input-', ''), 10);
      const outputIdx = parseInt(outputId.replace('output-', ''), 10);

      const inputName = ports.inputs[inputIdx];
      const outputName = ports.outputs[outputIdx];

      if (!inputName) {
        throw new Error(`Input port not found: ${inputId}`);
      }
      if (!outputName) {
        throw new Error(`Output port not found: ${outputId}`);
      }

      // Open ports on server
      const inputResult = await fetchJson<OpenPortResponse>(
        serverUrl,
        `/port/${encodeURIComponent(inputId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ name: inputName, type: 'input' }),
        }
      );
      if (!inputResult.success) {
        throw new Error(`Failed to open input port: ${inputResult.error}`);
      }

      const outputResult = await fetchJson<OpenPortResponse>(
        serverUrl,
        `/port/${encodeURIComponent(outputId)}`,
        {
          method: 'POST',
          body: JSON.stringify({ name: outputName, type: 'output' }),
        }
      );
      if (!outputResult.success) {
        throw new Error(`Failed to open output port: ${outputResult.error}`);
      }

      // Create adapter with SSE connection
      const { adapter, eventSource } = createHttpMidiAdapter(serverUrl, inputId, outputId);

      const inputInfo: MidiPortInfo = {
        id: inputId,
        name: inputName,
        state: 'connected',
      };

      const outputInfo: MidiPortInfo = {
        id: outputId,
        name: outputName,
        state: 'connected',
      };

      return {
        adapter,
        inputInfo,
        outputInfo,
        disconnect: async () => {
          // Close SSE connection
          eventSource.close();

          // Close ports on server
          await fetch(`${serverUrl}/port/${encodeURIComponent(inputId)}`, {
            method: 'DELETE',
          }).catch(() => {
            // Ignore errors on cleanup
          });
          await fetch(`${serverUrl}/port/${encodeURIComponent(outputId)}`, {
            method: 'DELETE',
          }).catch(() => {
            // Ignore errors on cleanup
          });
        },
      };
    },
  };
}
