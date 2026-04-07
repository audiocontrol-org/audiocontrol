/**
 * SCSI SDS sample transfer tests — verifies the bridge's WebSocket-based
 * SDS transfer path (SCSI_EXEC with raw CDBs, not MIDI_* abstraction).
 *
 * Uses the built-in Node.js WebSocket API (Node 22+).
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';

interface SampleHeader {
  name: string;
  sampleRate: number;
  sampleCount: number;
}

interface DownloadResult {
  header: SampleHeader;
  totalSamplesReceived: number;
  chunks: number;
  elapsedMs: number;
}

async function downloadSampleViaWebSocket(
  bridgeUrl: string,
  targetId: number,
  sampleNumber: number,
  channel: number,
  log: (msg: string) => void,
  verbose: boolean,
): Promise<DownloadResult> {
  const wsUrl = bridgeUrl.replace(/^http/, 'ws') + '/sds/stream';

  return new Promise<DownloadResult>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeoutMs = 60_000;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`download timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);

    let header: SampleHeader | undefined;
    let totalSamplesReceived = 0;
    let chunks = 0;
    const startTime = Date.now();

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({
        type: 'sample-download',
        targetId,
        sampleNumber,
        channel,
      }));
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(String(event.data));

      switch (msg.type) {
        case 'sample-header':
          header = {
            name: msg.name,
            sampleRate: msg.sampleRate,
            sampleCount: msg.sampleCount,
          };
          log(`    Header: name="${header.name}" rate=${header.sampleRate} count=${header.sampleCount}`);
          break;

        case 'sample-data':
          chunks++;
          totalSamplesReceived = msg.transferred;
          if (verbose && (chunks <= 3 || chunks % 50 === 0)) {
            log(`    Chunk ${chunks}: ${msg.samples?.length || 0} samples, progress: ${msg.transferred}/${msg.total}`);
          }
          break;

        case 'sample-complete':
          clearTimeout(timeout);
          ws.close();
          resolve({
            header: header!,
            totalSamplesReceived: msg.totalSamples,
            chunks,
            elapsedMs: Date.now() - startTime,
          });
          break;

        case 'sample-error':
          clearTimeout(timeout);
          ws.close();
          reject(new Error(`bridge error: ${msg.error}`));
          break;
      }
    });

    ws.addEventListener('error', (event) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${event}`));
    });

    ws.addEventListener('close', () => {
      clearTimeout(timeout);
      if (!header) {
        reject(new Error('WebSocket closed before receiving header'));
      }
    });
  });
}

export async function runScsiSdsTransferTests(ctx: TestContext): Promise<TestResult[]> {
  return [await testScsiSdsDownload(ctx)];
}

/**
 * Download a sample via SCSI WebSocket and validate both the header
 * (name, rate, count) and the data (all expected samples received).
 * Single download — avoids stale device state from repeated transfers.
 */
async function testScsiSdsDownload(ctx: TestContext): Promise<TestResult> {
  const name = 'scsi-sds-download';
  try {
    const sampleNames = await ctx.client.fetchSampleNames();
    if (sampleNames.length === 0) {
      return { name, status: 'SKIP', detail: 'no samples on device' };
    }

    ctx.log(`  Downloading sample 0 via SCSI WebSocket...`);
    const result = await downloadSampleViaWebSocket(
      ctx.bridgeUrl, 6, 0, 0, ctx.log, ctx.verbose,
    );

    const h = result.header;
    const results: string[] = [];
    const failures: string[] = [];

    // Validate header: name
    if (!h.name || h.name.length === 0) {
      failures.push('empty sample name');
    } else {
      const printable = /^[A-Za-z0-9#+\-. ]+$/;
      if (!printable.test(h.name)) {
        failures.push(`garbled sample name: "${h.name}"`);
      } else {
        results.push(`name="${h.name}"`);
      }
    }

    // Validate header: sample rate
    const validRates = [8000, 11025, 16000, 22050, 32000, 44100, 48000];
    if (!validRates.includes(h.sampleRate)) {
      failures.push(`unexpected sample rate: ${h.sampleRate}`);
    } else {
      results.push(`${h.sampleRate}Hz`);
    }

    // Validate header: sample count
    if (h.sampleCount < 1 || h.sampleCount > 16_000_000) {
      failures.push(`implausible sample count: ${h.sampleCount}`);
    }

    // Validate data completeness
    const expected = h.sampleCount;
    const received = result.totalSamplesReceived;
    ctx.log(`    Received ${received}/${expected} samples in ${result.chunks} chunks (${result.elapsedMs}ms)`);

    if (received < expected) {
      failures.push(`incomplete: ${received}/${expected} samples`);
    } else {
      results.push(`${received} samples in ${result.chunks} chunks (${result.elapsedMs}ms)`);
    }

    if (failures.length > 0) {
      return { name, status: 'FAIL', detail: failures.join('; ') };
    }

    return { name, status: 'PASS', detail: results.join(', ') };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
