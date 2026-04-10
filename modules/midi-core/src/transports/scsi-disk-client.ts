/**
 * SCSI Disk Client — browser-safe HTTP client for SCSI block I/O
 *
 * Talks to the scsi-midi-bridge's /scsi/* endpoints to read and write
 * Akai-formatted disk images served by s2p.
 */

export interface ScsiInquiryResult {
  deviceType: number;
  vendor: string;
  product: string;
  revision: string;
}

export interface ScsiCapacityResult {
  blockCount: number;
  blockSize: number;
}

export interface SampleTransferHeader {
  name: string;
  sampleRate: number;
  sampleCount: number;
}

export interface SampleTransferProgress {
  transferred: number;
  total: number;
}

export interface SampleDownloadCallbacks {
  onHeader: (header: SampleTransferHeader) => void;
  onData: (samples: Int16Array, progress: SampleTransferProgress) => void;
  onComplete: (totalSamples: number) => void;
}

export interface SampleUploadCallbacks {
  onProgress: (progress: SampleTransferProgress) => void;
  onComplete: (totalSamples: number) => void;
}

export interface ScsiDiskClient {
  inquiry(targetId: number): Promise<ScsiInquiryResult>;
  readCapacity(targetId: number): Promise<ScsiCapacityResult>;
  readBlocks(targetId: number, lba: number, count: number): Promise<Uint8Array>;
  writeBlocks(targetId: number, lba: number, data: Uint8Array): Promise<void>;
  downloadSample(
    targetId: number,
    sampleNumber: number,
    channel: number,
    callbacks: SampleDownloadCallbacks,
  ): Promise<void>;
  uploadSample(
    targetId: number,
    sampleNumber: number,
    channel: number,
    sampleRate: number,
    samples: Int16Array,
    callbacks: SampleUploadCallbacks,
  ): Promise<void>;
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function createScsiDiskClient(bridgeUrl: string): ScsiDiskClient {
  const baseUrl = stripTrailingSlash(bridgeUrl);

  async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
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

  return {
    async inquiry(targetId: number): Promise<ScsiInquiryResult> {
      return fetchJson<ScsiInquiryResult>(`/scsi/inquiry/${targetId}`);
    },

    async readCapacity(targetId: number): Promise<ScsiCapacityResult> {
      return fetchJson<ScsiCapacityResult>(`/scsi/capacity/${targetId}`);
    },

    async readBlocks(targetId: number, lba: number, count: number): Promise<Uint8Array> {
      const resp = await fetchJson<{ status: number; data_in: number[] }>(
        '/scsi/read',
        {
          method: 'POST',
          body: JSON.stringify({ target_id: targetId, lba, count }),
        },
      );
      if (resp.status !== 0) {
        throw new Error(`SCSI READ failed: status ${resp.status}`);
      }
      return new Uint8Array(resp.data_in);
    },

    async writeBlocks(targetId: number, lba: number, data: Uint8Array): Promise<void> {
      const resp = await fetchJson<{ status: number }>(
        '/scsi/write',
        {
          method: 'POST',
          body: JSON.stringify({
            target_id: targetId,
            lba,
            data: Array.from(data),
          }),
        },
      );
      if (resp.status !== 0) {
        throw new Error(`SCSI WRITE failed: status ${resp.status}`);
      }
    },

    downloadSample(
      targetId: number,
      sampleNumber: number,
      channel: number,
      callbacks: SampleDownloadCallbacks,
    ): Promise<void> {
      return sampleTransfer(baseUrl, {
        type: 'sample-download',
        target_id: targetId,
        sample_number: sampleNumber,
        channel,
      }, callbacks);
    },

    uploadSample(
      targetId: number,
      sampleNumber: number,
      channel: number,
      sampleRate: number,
      samples: Int16Array,
      callbacks: SampleUploadCallbacks,
    ): Promise<void> {
      return sampleTransfer(baseUrl, {
        type: 'sample-upload',
        target_id: targetId,
        sample_number: sampleNumber,
        channel,
        sample_rate: sampleRate,
        samples: Array.from(samples),
      }, callbacks);
    },
  };
}

/** Shared WebSocket transfer logic for download and upload. */
function sampleTransfer(
  baseUrl: string,
  request: Record<string, unknown>,
  callbacks: SampleDownloadCallbacks | SampleUploadCallbacks,
): Promise<void> {
  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/sds/stream';

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    // SDS transfers over SCSI can take several minutes for large samples.
    // Use a generous timeout — the bridge has its own per-transfer timeout.
    const timeoutMs = 600_000;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('sample transfer timed out'));
    }, timeoutMs);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify(request));
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));

      switch (msg.type) {
        case 'sample-header':
          if ('onHeader' in callbacks) {
            callbacks.onHeader({
              name: msg.name,
              sampleRate: msg.sampleRate,
              sampleCount: msg.sampleCount,
            });
          }
          break;

        case 'sample-data':
          if ('onData' in callbacks) {
            callbacks.onData(
              new Int16Array(msg.samples),
              { transferred: msg.transferred, total: msg.total },
            );
          }
          break;

        case 'upload-progress':
          if ('onProgress' in callbacks) {
            callbacks.onProgress({
              transferred: msg.transferred,
              total: msg.total,
            });
          }
          break;

        case 'sample-complete':
          clearTimeout(timeout);
          ws.close();
          if ('onComplete' in callbacks) {
            callbacks.onComplete(msg.totalSamples);
          }
          resolve();
          break;

        case 'upload-complete':
          clearTimeout(timeout);
          ws.close();
          if ('onComplete' in callbacks) {
            callbacks.onComplete(msg.totalSamples);
          }
          resolve();
          break;

        case 'sample-error':
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.error));
          break;
      }
    });

    ws.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('WebSocket connection error'));
    });
  });
}
