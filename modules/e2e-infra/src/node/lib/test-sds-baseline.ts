/**
 * Phase 3.1 (task #24): Measure current SDS upload baseline.
 *
 * Per decision issue #315, before optimizing we need a real hardware baseline
 * to measure improvements against. This test:
 *
 *   1. Runs SDS uploads at three sample sizes through the production code path
 *      (bridge WebSocket /sds/stream, same as the web app uses)
 *   2. Captures start-of-upload, first-progress, last-progress, end-of-upload
 *      timestamps to expose startup vs steady-state overhead
 *   3. Computes throughput per run and averages per-packet timing
 *   4. Emits a clean baseline report
 *
 * Run:
 *   E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 \
 *     pnpm --filter @audiocontrol/e2e-infra exec tsx src/node/lib/test-sds-baseline.ts
 *
 * Target to beat (per #315):
 *   - Ship threshold: 8 KB/s
 *   - Aspirational: 15 KB/s
 *   - Plateau-below-4 KB/s triggers strategic reassessment
 */

import WebSocket from 'ws';

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const SAMPLE_RATE = 44100;
const SAMPLES_PER_PACKET = 40; // SDS protocol fixed

interface RunResult {
  label: string;
  sampleCount: number;
  totalBytes: number;
  totalMs: number;
  connectMs: number;        // WS open → send request
  firstProgressMs: number;  // send request → first upload-progress
  lastProgressMs: number;   // send request → last upload-progress
  completeMs: number;       // send request → upload-complete
  progressEvents: number;
  throughputKBs: number;
  perPacketMs: number;
}

async function runOne(sampleCount: number, slot: number): Promise<RunResult> {
  const samples = new Int16Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 16000);
  }

  const wsUrl = BRIDGE_URL.replace(/^http/, 'ws') + '/sds/stream';
  const result: Partial<RunResult> = {
    label: `${sampleCount}-sample (${(sampleCount * 2 / 1024).toFixed(1)} KB)`,
    sampleCount,
    totalBytes: sampleCount * 2,
    progressEvents: 0,
  };

  const t0 = performance.now();
  let tConnected = 0;
  let tSendRequest = 0;
  let tFirstProgress = 0;
  let tLastProgress = 0;
  let tComplete = 0;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Upload timed out after 300s (sampleCount=${sampleCount})`));
    }, 300_000);

    ws.on('open', () => {
      tConnected = performance.now();
      ws.send(JSON.stringify({
        type: 'sample-upload',
        target_id: 6,
        sample_number: slot,
        channel: 0,
        sample_rate: SAMPLE_RATE,
        samples: Array.from(samples),
      }));
      tSendRequest = performance.now();
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      switch (msg.type) {
        case 'upload-progress':
          if (tFirstProgress === 0) tFirstProgress = performance.now();
          tLastProgress = performance.now();
          result.progressEvents = (result.progressEvents ?? 0) + 1;
          break;
        case 'upload-complete':
          tComplete = performance.now();
          clearTimeout(timeout);
          ws.close();
          resolve();
          break;
        case 'sample-error':
          clearTimeout(timeout);
          ws.close();
          reject(new Error(msg.error ?? 'unknown sample-error'));
          break;
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  const totalMs = tComplete - t0;
  result.totalMs = totalMs;
  result.connectMs = tConnected - t0;
  result.firstProgressMs = tFirstProgress - tSendRequest;
  result.lastProgressMs = tLastProgress - tSendRequest;
  result.completeMs = tComplete - tSendRequest;
  result.throughputKBs = (sampleCount * 2) / (totalMs / 1000) / 1024;
  const expectedPackets = Math.ceil(sampleCount / SAMPLES_PER_PACKET);
  result.perPacketMs = (tComplete - tSendRequest) / expectedPackets;

  return result as RunResult;
}

async function main() {
  console.log(`\n=== SDS Baseline Measurement (task #24) ===`);
  console.log(`Bridge: ${BRIDGE_URL}`);
  console.log(`Sample rate: ${SAMPLE_RATE} Hz, SDS packet size: ${SAMPLES_PER_PACKET} samples`);
  console.log(`Targets: 8 KB/s minimum, 15 KB/s aspirational (per #315)`);
  console.log(``);

  // Three sizes: small (startup overhead visible), medium, large (steady-state).
  // Use distinct high slot numbers to avoid conflicts with existing samples.
  const runs: RunResult[] = [];
  const sizes: Array<[number, number]> = [
    [1000, 90],   // ~2 KB
    [4000, 91],   // ~8 KB
    [16000, 92],  // ~32 KB
  ];

  for (const [count, slot] of sizes) {
    console.log(`Running ${count}-sample upload to slot ${slot}...`);
    try {
      const r = await runOne(count, slot);
      runs.push(r);
      console.log(
        `  ${r.label}: ${r.totalMs.toFixed(0)}ms, ${r.throughputKBs.toFixed(2)} KB/s, ${r.progressEvents} progress events, ${r.perPacketMs.toFixed(1)}ms/packet\n`,
      );
    } catch (err) {
      console.error(`  FAILED: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  console.log(`=== Baseline Report ===\n`);
  console.log(`| Size         | Total ms | First progress | Last progress | Complete | KB/s | ms/packet |`);
  console.log(`|--------------|----------|----------------|---------------|----------|------|-----------|`);
  for (const r of runs) {
    console.log(
      `| ${r.label.padEnd(12)} | ${r.totalMs.toFixed(0).padStart(8)} | ${r.firstProgressMs.toFixed(0).padStart(14)} | ${r.lastProgressMs.toFixed(0).padStart(13)} | ${r.completeMs.toFixed(0).padStart(8)} | ${r.throughputKBs.toFixed(2).padStart(4)} | ${r.perPacketMs.toFixed(1).padStart(9)} |`,
    );
  }
  console.log();

  // Steady-state throughput: use the largest run (startup overhead amortized).
  if (runs.length > 0) {
    const biggest = runs[runs.length - 1];
    const ratio = biggest.throughputKBs / 8;
    console.log(`Steady-state throughput (largest run): ${biggest.throughputKBs.toFixed(2)} KB/s`);
    console.log(`  vs 8 KB/s ship target: ${(ratio * 100).toFixed(0)}% — need ${(8 / biggest.throughputKBs).toFixed(1)}x improvement`);
    console.log(`  vs 15 KB/s aspirational: ${(biggest.throughputKBs / 15 * 100).toFixed(0)}% — need ${(15 / biggest.throughputKBs).toFixed(1)}x improvement`);
    const projectedSmallSampleMs = (100 * 1024) / (biggest.throughputKBs * 1024) * 1000;
    const projectedLargeSampleS = (1024 * 1024) / (biggest.throughputKBs * 1024);
    console.log(`  100 KB sample at current rate: ${(projectedSmallSampleMs / 1000).toFixed(1)}s`);
    console.log(`  1 MB sample at current rate:   ${projectedLargeSampleS.toFixed(0)}s (${(projectedLargeSampleS / 60).toFixed(1)} min)`);
  }

  console.log(`\nBaseline measurement complete. Next: Phase 3.2 (task #25) — larger CDB batches.`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
