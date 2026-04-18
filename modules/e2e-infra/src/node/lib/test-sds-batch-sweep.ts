/**
 * Phase 3.2 (task #25): Batch-size sweep for SDS upload throughput.
 *
 * Measures throughput at multiple SDS batch sizes (packets per CDB) to find
 * the throughput-vs-batch-size curve and pick a value for production.
 *
 * Bridge must support the `batch_size` field in the `sample-upload` WebSocket
 * message (added in this session for Phase 3.2 work).
 *
 * Run:
 *   E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 \
 *     pnpm --filter @audiocontrol/e2e-infra exec tsx src/node/lib/test-sds-batch-sweep.ts
 *
 * Baseline (per sds-baseline.md): 2.91 KB/s steady-state at batch_size=20.
 * Target: 8 KB/s (per #315). Need 2.8x improvement.
 */

import WebSocket from 'ws';

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const SAMPLE_RATE = 44100;
const SAMPLE_COUNT = 16000; // 32 KB — enough to amortize startup, short enough to iterate

interface SweepResult {
  batchSize: number;
  totalMs: number;
  throughputKBs: number;
  perPacketMs: number;
}

async function runOne(batchSize: number, slot: number): Promise<SweepResult> {
  const samples = new Int16Array(SAMPLE_COUNT);
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    samples[i] = Math.round(Math.sin(2 * Math.PI * 440 * i / SAMPLE_RATE) * 16000);
  }

  const wsUrl = BRIDGE_URL.replace(/^http/, 'ws') + '/sds/stream';
  const t0 = performance.now();
  let tComplete = 0;

  await new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Upload timed out after 300s (batch=${batchSize})`));
    }, 300_000);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'sample-upload',
        target_id: 6,
        sample_number: slot,
        channel: 0,
        sample_rate: SAMPLE_RATE,
        samples: Array.from(samples),
        batch_size: batchSize,
      }));
    });

    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'upload-complete') {
        tComplete = performance.now();
        clearTimeout(timeout);
        ws.close();
        resolve();
      } else if (msg.type === 'sample-error') {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(msg.error ?? 'unknown sample-error'));
      }
    });

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  const totalMs = tComplete - t0;
  const expectedPackets = Math.ceil(SAMPLE_COUNT / 40);
  return {
    batchSize,
    totalMs,
    throughputKBs: (SAMPLE_COUNT * 2) / (totalMs / 1000) / 1024,
    perPacketMs: totalMs / expectedPackets,
  };
}

async function main() {
  console.log(`\n=== SDS Batch-Size Sweep (Phase 3.2 / task #25) ===`);
  console.log(`Bridge: ${BRIDGE_URL}`);
  console.log(`Sample size: ${SAMPLE_COUNT} samples (${(SAMPLE_COUNT * 2 / 1024).toFixed(1)} KB)`);
  console.log(`Baseline: 2.91 KB/s @ batch=20 (per sds-baseline.md)`);
  console.log(`Target: 8 KB/s ship, 15 KB/s aspirational (per #315)`);
  console.log(``);

  // Sweep across batch sizes. Slot rotation to avoid collisions.
  const batchSizes = [20, 40, 60, 100, 150, 200];
  const results: SweepResult[] = [];

  for (let i = 0; i < batchSizes.length; i++) {
    const bs = batchSizes[i];
    const slot = 80 + i;
    console.log(`Running batch_size=${bs} → slot ${slot}...`);
    try {
      const r = await runOne(bs, slot);
      results.push(r);
      console.log(`  ${r.totalMs.toFixed(0)}ms, ${r.throughputKBs.toFixed(2)} KB/s, ${r.perPacketMs.toFixed(2)}ms/packet\n`);
    } catch (err) {
      console.error(`  FAILED: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  console.log(`=== Sweep Report ===\n`);
  console.log(`| batch_size | total_ms | KB/s | ms/packet | speedup |`);
  console.log(`|------------|----------|------|-----------|---------|`);
  const baseline = results.find(r => r.batchSize === 20);
  for (const r of results) {
    const speedup = baseline ? (r.throughputKBs / baseline.throughputKBs).toFixed(2) : '?';
    console.log(`| ${String(r.batchSize).padStart(10)} | ${r.totalMs.toFixed(0).padStart(8)} | ${r.throughputKBs.toFixed(2).padStart(4)} | ${r.perPacketMs.toFixed(2).padStart(9)} | ${speedup.padStart(7)}x |`);
  }
  console.log();

  const best = results.reduce((a, b) => b.throughputKBs > a.throughputKBs ? b : a, results[0]);
  console.log(`Best: batch_size=${best.batchSize} at ${best.throughputKBs.toFixed(2)} KB/s`);
  if (best.throughputKBs >= 8) {
    console.log(`Hit ship target (8 KB/s) with batch alone — proceed to Phase 3.5 verification.`);
  } else if (best.throughputKBs >= 4) {
    console.log(`Below ship target but above plateau threshold. Continue to Phase 3.3 (pipeline ACKs).`);
  } else {
    console.log(`Below plateau threshold. Reopen strategic conversation per #315.`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
