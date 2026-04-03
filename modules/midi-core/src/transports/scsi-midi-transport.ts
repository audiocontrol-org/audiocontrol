/**
 * SCSI MIDI Transport - MIDI communication via Pi SCSI bridge daemon
 *
 * This transport implements the MidiIO interface using HTTP requests for
 * sending SysEx messages and WebSocket for receiving them from the Pi
 * bridge daemon. It enables communication with SCSI-based samplers
 * (e.g., Akai S3000XL) connected via a Raspberry Pi running scsi2pi.
 */

import type { MidiIO, SysExCallback } from '../types';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ScsiMidiBridgeStatus {
  version: string;
  scsi2piVersion: string;
  boardId: number;
  samplerReachable: boolean;
}

export interface ScsiDevice {
  id: number;
  vendor: string;
  product: string;
  revision: string;
}

export interface ScsiMidiTransportOptions {
  /** Base URL of the Pi bridge daemon, e.g., "http://s3k.local:7033" */
  bridgeUrl: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface WsMessage {
  type: string;
  data: number[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function wsUrlFromHttp(httpUrl: string, path: string): string {
  const base = stripTrailingSlash(httpUrl);
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}${path}`;
}

async function fetchJson<T>(baseUrl: string, path: string, options?: RequestInit): Promise<T> {
  const url = `${stripTrailingSlash(baseUrl)}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SCSI bridge HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a SCSI MIDI transport that communicates with the Pi bridge daemon.
 *
 * Uses HTTP for sending SysEx and WebSocket for receiving.
 * Implements MidiIO so it can be used as a drop-in replacement for
 * Web MIDI or HTTP MIDI transports.
 */
export function createScsiMidiTransport(options: ScsiMidiTransportOptions): {
  adapter: MidiIO;
  connect: () => Promise<ScsiMidiBridgeStatus>;
  disconnect: () => void;
  scanDevices: () => Promise<ScsiDevice[]>;
} {
  const bridgeUrl = stripTrailingSlash(options.bridgeUrl);
  const listeners = new Set<SysExCallback>();
  let ws: WebSocket | null = null;

  // Serialize sends -- same pattern as httpMidiTransport.
  let sendQueue: Promise<void> = Promise.resolve();

  // Background poll loop for incoming SysEx (SDS data packets, etc.)
  // When WebSocket is unavailable, this polls GET /sds/poll periodically
  // to receive data the device sends autonomously.
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let pollInFlight = false;

  function startPolling(): void {
    if (pollInterval || ws) return; // Don't poll if WebSocket is working
    pollInterval = setInterval(async () => {
      if (pollInFlight || listeners.size === 0) return;
      pollInFlight = true;
      try {
        const res = await fetch(`${bridgeUrl}/sds/poll`);
        const body = await res.json() as { ok: boolean; response: number[] };
        if (body.response && body.response.length > 0) {
          dispatchResponses(body.response);
        }
      } catch {
        // Ignore poll errors — bridge may be temporarily busy
      } finally {
        pollInFlight = false;
      }
    }, 100); // Poll every 100ms
  }

  function stopPolling(): void {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  }

  /** Split concatenated SysEx on F7 boundaries and dispatch each message. */
  function dispatchResponses(data: number[]): void {
    let start = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0xf7) {
        const msg = data.slice(start, i + 1);
        if (msg[0] === 0xf0) {
          listeners.forEach((cb) => cb(msg));
        }
        start = i + 1;
      }
    }
  }

  function handleWsMessage(event: MessageEvent): void {
    try {
      const msg: WsMessage = JSON.parse(String(event.data));
      if (msg.type !== 'sysex' || !Array.isArray(msg.data)) {
        return;
      }
      if (msg.data.length > 0 && msg.data[0] === 0xf0) {
        listeners.forEach((cb) => cb(msg.data));
      }
    } catch (err) {
      console.error('[ScsiMidiTransport] Failed to parse WebSocket message:', err);
    }
  }

  // -------------------------------------------------------------------------
  // MidiIO adapter
  // -------------------------------------------------------------------------

  const adapter: MidiIO = {
    send(message: number[]): void {
      sendQueue = sendQueue.then(async () => {
        try {
          const res = await fetch(`${bridgeUrl}/sds/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
          });
          const body = await res.json() as { ok: boolean; response: number[] };
          if (body.response && body.response.length > 0) {
            dispatchResponses(body.response);
          }
        } catch (err) {
          console.error('[ScsiMidiTransport] Send error:', err);
        }
      });
    },

    onSysEx(callback: SysExCallback): void {
      listeners.add(callback);
      startPolling();
    },

    removeSysExListener(callback: SysExCallback): void {
      listeners.delete(callback);
      if (listeners.size === 0) {
        stopPolling();
      }
    },
  };

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async function connect(): Promise<ScsiMidiBridgeStatus> {
    const status = await fetchJson<ScsiMidiBridgeStatus>(bridgeUrl, '/status').catch((err) => {
      throw new Error(
        `Failed to connect to SCSI bridge at ${bridgeUrl}: ${err instanceof Error ? err.message : String(err)}`
      );
    });

    // Open WebSocket for incoming SysEx.
    // This may fail (e.g., mixed-content: HTTPS page → ws:// connection).
    // WebSocket is only needed for receiving unsolicited SysEx from the device;
    // send/poll/read still work via HTTP. Treat WS failure as non-fatal.
    try {
      const wsUrl = wsUrlFromHttp(bridgeUrl, '/sds/stream');
      ws = new WebSocket(wsUrl);

      ws.addEventListener('message', handleWsMessage);

      ws.addEventListener('error', (err) => {
        console.warn('[ScsiMidiTransport] WebSocket error (incoming SysEx will use polling):', err);
      });
    } catch (err) {
      console.warn('[ScsiMidiTransport] WebSocket not available (mixed-content or network error):', err);
      // Continue without WebSocket — HTTP polling still works
    }

    return status;
  }

  function disconnect(): void {
    stopPolling();
    if (ws) {
      ws.removeEventListener('message', handleWsMessage);
      ws.close();
      ws = null;
    }
    listeners.clear();
  }

  async function scanDevices(): Promise<ScsiDevice[]> {
    return fetchJson<ScsiDevice[]>(bridgeUrl, '/scsi/scan');
  }

  return { adapter, connect, disconnect, scanDevices };
}
