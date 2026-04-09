/**
 * SCSI MIDI Transport - MIDI communication via Pi SCSI bridge daemon
 *
 * This transport implements the MidiIO interface using HTTP requests for
 * sending SysEx messages and WebSocket for receiving them from the Pi
 * bridge daemon. It enables communication with SCSI-based samplers
 * (e.g., Akai S3000XL) connected via a Raspberry Pi running scsi2pi.
 */

import type { MidiIO, SysExCallback, SdsChannel } from '../types';
import type { SdsTransferProgress, SdsDumpHeader } from '../sds/sds-types';

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
  // Relative URL (e.g., "/scsi-bridge") — derive WebSocket URL from page origin
  if (base.startsWith('/')) {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = typeof window !== 'undefined' ? window.location.host : 'localhost';
    return `${protocol}//${host}${base}${path}`;
  }
  // Absolute URL — swap http(s) for ws(s)
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
  sdsChannel: SdsChannel;
  connect: () => Promise<ScsiMidiBridgeStatus>;
  disconnect: () => void;
  scanDevices: () => Promise<ScsiDevice[]>;
} {
  const bridgeUrl = stripTrailingSlash(options.bridgeUrl);
  const listeners = new Set<SysExCallback>();
  let ws: WebSocket | null = null;

  // Serialize sends -- same pattern as httpMidiTransport.
  let sendQueue: Promise<void> = Promise.resolve();

  // SDS transfers use a dedicated WebSocket channel (/sds/stream).
  // SysEx request/response gets its response inline in the HTTP POST body.
  // No background polling needed.

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
      const msgType = message[0] === 0xf0 ? `F0..${message.slice(1, 4).map(b => b.toString(16)).join(' ')}` : 'non-sysex';
      console.log(`[ScsiMidi] send queued: ${message.length} bytes (${msgType}), wsOpen=${ws?.readyState === WebSocket.OPEN}`);
      sendQueue = sendQueue.then(async () => {
        try {
          console.log(`[ScsiMidi] sending via HTTP POST to ${bridgeUrl}/sds/send`);
          const jsonBody = JSON.stringify({ message });
          const res = await fetch(`${bridgeUrl}/sds/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: jsonBody,
          });
          if (!res.ok) {
            const errText = await res.text();
            console.error(`[ScsiMidi] HTTP ${res.status}: ${errText} (sent ${message.length} bytes, body ${jsonBody.length} chars)`);
            return;
          }
          const body = await res.json() as { ok: boolean; response: number[] };
          console.log(`[ScsiMidi] HTTP response: ok=${body.ok}, response=${body.response?.length ?? 0} bytes`);
          if (body.response && body.response.length > 0) {
            dispatchResponses(body.response);
          }
        } catch (err) {
          console.error('[ScsiMidiTransport] Send error:', err);
        }
      });
    },

    onSysEx(callback: SysExCallback): void {
      console.log(`[ScsiMidi] onSysEx registered, listeners: ${listeners.size + 1}`);
      listeners.add(callback);
    },

    removeSysExListener(callback: SysExCallback): void {
      listeners.delete(callback);
    },
  };

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  async function connect(): Promise<ScsiMidiBridgeStatus> {
    // Use /health for the initial connection check — it returns immediately.
    // /status can hang if it probes the sampler via SCSI and the device is slow
    // or the SCSI bus is busy.
    await fetchJson<{ ok: boolean }>(bridgeUrl, '/health').catch((err) => {
      throw new Error(
        `Failed to connect to SCSI bridge at ${bridgeUrl}: ${err instanceof Error ? err.message : String(err)}`
      );
    });
    // Fetch status non-blocking for the return value — use a short timeout
    const status = await Promise.race([
      fetchJson<ScsiMidiBridgeStatus>(bridgeUrl, '/status'),
      new Promise<ScsiMidiBridgeStatus>((resolve) =>
        setTimeout(() => resolve({
          version: 'unknown',
          scsi2piVersion: 'unknown',
          boardId: 0,
          samplerReachable: true, // Optimistic — scan found it
        }), 3000)
      ),
    ]);

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

  // -------------------------------------------------------------------------
  // SDS Channel — dedicated WebSocket path for sample transfers
  // -------------------------------------------------------------------------

  // The SDS channel needs to wait for pending SysEx operations to complete
  // before starting, because the bridge holds a single SCSI mutex.
  const waitForSendQueueIdle = () => sendQueue;
  const sdsChannel = createScsiSdsChannel(bridgeUrl, waitForSendQueueIdle);

  return { adapter, sdsChannel, connect, disconnect, scanDevices };
}

// ---------------------------------------------------------------------------
// SCSI SDS Channel implementation
// ---------------------------------------------------------------------------

/** Default SCSI target ID for S3000XL. */
const DEFAULT_SCSI_TARGET_ID = 6;

function createScsiSdsChannel(
  bridgeUrl: string,
  waitForIdle: () => Promise<void>,
): SdsChannel {
  return {
    async uploadSample(
      sampleNumber: number,
      channel: number,
      sampleRate: number,
      samples: Int16Array,
      onProgress?: (progress: SdsTransferProgress) => void,
    ): Promise<void> {
      // Wait for all pending SysEx operations to complete — the bridge
      // holds a single SCSI mutex, so we can't start SDS while SysEx is in flight.
      await waitForIdle();
      console.log(`[SdsChannel] send queue idle, starting upload`);

      const wsUrl = wsUrlFromHttp(bridgeUrl, '/sds/stream');

      return new Promise<void>((resolve, reject) => {
        const sdsWs = new WebSocket(wsUrl);
        const timeoutMs = 120_000;
        const timeout = setTimeout(() => {
          sdsWs.close();
          reject(new Error(`SDS upload timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs);

        const totalPackets = Math.ceil(samples.length / 120);

        sdsWs.addEventListener('open', () => {
          sdsWs.send(JSON.stringify({
            type: 'sample-upload',
            target_id: DEFAULT_SCSI_TARGET_ID,
            sample_number: sampleNumber,
            channel,
            sample_rate: sampleRate,
            samples: Array.from(samples),
          }));
        });

        sdsWs.addEventListener('message', (event) => {
          const msg = JSON.parse(String(event.data));

          switch (msg.type) {
            case 'upload-progress':
              if (onProgress) {
                onProgress({
                  packetsSent: msg.transferred ?? 0,
                  packetsTotal: msg.total ?? totalPackets,
                  bytesSent: (msg.transferred ?? 0) * 2,
                  bytesTotal: samples.length * 2,
                });
              }
              break;

            case 'upload-complete':
              clearTimeout(timeout);
              sdsWs.close();
              resolve();
              break;

            case 'sample-error':
              clearTimeout(timeout);
              sdsWs.close();
              reject(new Error(`SDS upload error: ${msg.error}`));
              break;
          }
        });

        sdsWs.addEventListener('error', (event) => {
          clearTimeout(timeout);
          reject(new Error(`SDS upload WebSocket error: ${event}`));
        });
      });
    },

    async downloadSample(
      sampleNumber: number,
      channel: number,
      onProgress?: (progress: SdsTransferProgress) => void,
    ): Promise<{ header: SdsDumpHeader; samples: Int16Array }> {
      await waitForIdle();
      console.log(`[SdsChannel] send queue idle, starting download`);

      const wsUrl = wsUrlFromHttp(bridgeUrl, '/sds/stream');

      return new Promise<{ header: SdsDumpHeader; samples: Int16Array }>((resolve, reject) => {
        const sdsWs = new WebSocket(wsUrl);
        const timeoutMs = 60_000;
        const timeout = setTimeout(() => {
          sdsWs.close();
          reject(new Error(`SDS download timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs);

        let header: SdsDumpHeader | undefined;
        const sampleChunks: number[][] = [];
        let totalSamples = 0;

        sdsWs.addEventListener('open', () => {
          sdsWs.send(JSON.stringify({
            type: 'sample-download',
            targetId: DEFAULT_SCSI_TARGET_ID,
            sampleNumber,
            channel,
          }));
        });

        sdsWs.addEventListener('message', (event) => {
          const msg = JSON.parse(String(event.data));

          switch (msg.type) {
            case 'sample-header':
              header = {
                sampleNumber,
                sampleFormat: msg.bitsPerSample ?? 16,
                samplePeriodNs: msg.sampleRate ? Math.round(1_000_000_000 / msg.sampleRate) : 0,
                sampleLength: msg.sampleCount ?? 0,
                loopStart: msg.loopStart ?? 0,
                loopEnd: msg.loopEnd ?? 0,
                loopType: msg.loopType ?? 0x7f,
              };
              break;

            case 'sample-data':
              if (Array.isArray(msg.samples)) {
                sampleChunks.push(msg.samples);
              }
              totalSamples = msg.transferred ?? totalSamples;
              if (onProgress && header) {
                onProgress({
                  packetsSent: totalSamples,
                  packetsTotal: header.sampleLength,
                  bytesSent: totalSamples * 2,
                  bytesTotal: header.sampleLength * 2,
                });
              }
              break;

            case 'sample-complete': {
              clearTimeout(timeout);
              sdsWs.close();
              if (!header) {
                reject(new Error('SDS download completed without receiving a dump header'));
                return;
              }
              const finalCount = msg.totalSamples ?? totalSamples;
              const allSamples = new Int16Array(finalCount);
              let offset = 0;
              for (const chunk of sampleChunks) {
                for (const s of chunk) {
                  if (offset < allSamples.length) {
                    allSamples[offset++] = s;
                  }
                }
              }
              resolve({ header, samples: allSamples });
              break;
            }

            case 'sample-error':
              clearTimeout(timeout);
              sdsWs.close();
              reject(new Error(`SDS download error: ${msg.error}`));
              break;
          }
        });

        sdsWs.addEventListener('error', (event) => {
          clearTimeout(timeout);
          reject(new Error(`SDS download WebSocket error: ${event}`));
        });

        sdsWs.addEventListener('close', () => {
          clearTimeout(timeout);
          if (!header) {
            reject(new Error('SDS download WebSocket closed before receiving header'));
          }
        });
      });
    },
  };
}
