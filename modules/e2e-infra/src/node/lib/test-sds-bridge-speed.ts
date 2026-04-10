/**
 * Test SDS upload speed through the bridge's WebSocket /sds/stream endpoint.
 * This is the path the web app actually uses.
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 tsx modules/e2e-infra/src/node/lib/test-sds-bridge-speed.ts
 */

import WebSocket from 'ws';

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const SAMPLE_RATE = 44100;
const SAMPLE_COUNT = 4000; // ~0.1 seconds — enough to measure throughput

async function main() {
  // Generate test sine wave
  const samples = new Int16Array(SAMPLE_COUNT);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 16000);
  }

  const wsUrl = BRIDGE_URL.replace(/^http/, 'ws') + '/sds/stream';
  console.log(`\n=== Bridge SDS Upload Speed Test ===`);
  console.log(`Bridge: ${wsUrl}`);
  console.log(`Sample: ${SAMPLE_COUNT} samples (${(SAMPLE_COUNT * 2 / 1024).toFixed(1)} KB), rate=${SAMPLE_RATE}`);
  console.log(`Expected packets: ${Math.ceil(SAMPLE_COUNT / 40)}\n`);

  const startTime = performance.now();
  let lastProgress = { transferred: 0, total: 0 };
  let progressCount = 0;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Upload timed out after 120s'));
    }, 120_000);

    ws.on('open', () => {
      console.log('WebSocket connected, sending upload request...');
      ws.send(JSON.stringify({
        type: 'sample-upload',
        target_id: 6,
        sample_number: 96, // Use a high number to avoid conflicts
        channel: 0,
        sample_rate: SAMPLE_RATE,
        samples: Array.from(samples),
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case 'upload-progress':
          lastProgress = { transferred: msg.transferred, total: msg.total };
          progressCount++;
          if (progressCount % 20 === 0) {
            const elapsed = performance.now() - startTime;
            const pct = msg.total > 0 ? Math.round(msg.transferred / msg.total * 100) : 0;
            console.log(`  Progress: ${msg.transferred}/${msg.total} (${pct}%) — ${Math.round(elapsed)}ms elapsed`);
          }
          break;
        case 'upload-complete':
          clearTimeout(timeout);
          ws.close();
          resolve();
          break;
        case 'sample-error':
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.error));
          break;
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  const totalMs = performance.now() - startTime;
  const bytesTransferred = SAMPLE_COUNT * 2;
  const throughput = bytesTransferred / (totalMs / 1000);

  console.log(`\n=== Results ===`);
  console.log(`Total time: ${Math.round(totalMs)}ms`);
  console.log(`Data: ${(bytesTransferred / 1024).toFixed(1)} KB`);
  console.log(`Throughput: ${(throughput / 1024).toFixed(1)} KB/s`);
  console.log(`Progress updates received: ${progressCount}`);
  console.log(`Baseline (pre-batch): ~350 bytes/s`);
  console.log(`Speedup: ${(throughput / 350).toFixed(1)}x`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
