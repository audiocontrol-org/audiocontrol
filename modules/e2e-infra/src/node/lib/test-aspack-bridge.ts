/**
 * Test ASPACK upload through the bridge WebSocket (sample-upload-fast).
 *
 * Run: E2E_SCSI_BRIDGE_URL=http://10.0.0.57:7033 tsx modules/e2e-infra/src/node/lib/test-aspack-bridge.ts
 */

import WebSocket from 'ws';

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://10.0.0.57:7033';
const SAMPLE_RATE = 44100;
const SAMPLE_COUNT = 44100; // 1 second

async function main() {
  const samples: number[] = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    samples.push(Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 16000));
  }

  const wsUrl = BRIDGE_URL.replace(/^http/, 'ws') + '/sds/stream';
  console.log(`\n=== ASPACK Bridge Upload Test ===`);
  console.log(`Bridge: ${wsUrl}`);
  console.log(`Sample: ${SAMPLE_COUNT} samples (${(SAMPLE_COUNT * 2 / 1024).toFixed(1)} KB)\n`);

  const startTime = performance.now();
  let progressCount = 0;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('ASPACK upload timed out after 60s'));
    }, 60_000);

    ws.on('open', () => {
      console.log('WebSocket connected, sending sample-upload-fast...');
      ws.send(JSON.stringify({
        type: 'sample-upload-fast',
        target_id: 6,
        sample_number: 80,
        channel: 0,
        sample_rate: SAMPLE_RATE,
        samples,
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case 'upload-progress':
          progressCount++;
          if (progressCount <= 3 || progressCount % 5 === 0) {
            const pct = msg.total > 0 ? Math.round(msg.transferred / msg.total * 100) : 0;
            console.log(`  Progress: ${msg.transferred}/${msg.total} (${pct}%)`);
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
  const throughput = (SAMPLE_COUNT * 2) / (totalMs / 1000);

  console.log(`\n=== Results ===`);
  console.log(`Total time: ${Math.round(totalMs)}ms`);
  console.log(`Throughput: ${(throughput / 1024).toFixed(1)} KB/s`);
  console.log(`Progress updates: ${progressCount}`);
  console.log(`\nComparison:`);
  console.log(`  Batched SDS:  2.2 KB/s (~40s for this sample)`);
  console.log(`  ASPACK:       ${(throughput / 1024).toFixed(1)} KB/s (${(totalMs / 1000).toFixed(1)}s)`);
  console.log(`  Speedup:      ${(throughput / 1024 / 2.2).toFixed(1)}x`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
