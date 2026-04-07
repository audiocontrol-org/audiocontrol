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

export interface ScsiDiskClient {
  inquiry(targetId: number): Promise<ScsiInquiryResult>;
  readCapacity(targetId: number): Promise<ScsiCapacityResult>;
  readBlocks(targetId: number, lba: number, count: number): Promise<Uint8Array>;
  writeBlocks(targetId: number, lba: number, data: Uint8Array): Promise<void>;
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
  };
}
