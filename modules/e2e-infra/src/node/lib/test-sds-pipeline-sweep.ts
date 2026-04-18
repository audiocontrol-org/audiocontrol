/**
 * Phase 3.3 (task #26): Pipeline-depth sweep for SDS upload throughput.
 *
 * Measures throughput at multiple pipeline depths (in-flight batches) to find
 * whether overlapping bridge-side send/read with device-side processing yields
 * the throughput improvement Phase 3.2 didn't.
 *
 * Bridge must support the `pipeline_depth` field in the `sample-upload`
 * WebSocket message (added this session for Phase 3.3 work).
 *
 * Run:
 *   E2E_SCSI_BRIDGE_URL=http://s3k.local:7033 \
 *     pnpm --filter @audiocontrol/e2e-infra exec tsx src/node/lib/test-sds-pipeline-sweep.ts
 *
 * Baseline: 2.91 KB/s @ batch=20 depth=1 (per sds-baseline.md).
 * Phase 3.2 conclusion: batch alone won't help — bottleneck is per-packet
 * round-trip. Phase 3.3 attacks that directly.
 * Target: 8 KB/s ship, 15 KB/s aspirational (per #315). Need 2.8x.
 */

import WebSocket from 'ws';

const BRIDGE_URL = process.env.E2E_SCSI_BRIDGE_URL ?? 'http://s3k.local:7033';
const SAMPLE_RATE = 44100;
const SAMPLE_COUNT = 16000; // 32 KB; same as baseline test
const BATCH_SIZE = 20; // Phase 3.2 confirmed optimum

interface SweepResult {
  pipelineDepth: number;
  totalMs: number;
  throughputKBs: number;
  perPacketMs: number;
}

async function runOne(pipelineDepth: number, slot: number): Promise<SweepResult> {
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
      reject(new Error(`Upload timed out after 300s (depth=${pipelineDepth})`));
    }, 300_000);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'sample-upload',
        target_id: 6,
        sample_number: slot,
        channel: 0,
        sample_rate: SAMPLE_RATE,
        samples: Array.from(samples),
        batch_size: BATCH_SIZE,
        pipeline_depth: pipelineDepth,
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
    pipelineDepth,
    totalMs,
    throughputKBs: (SAMPLE_COUNT * 2) / (totalMs / 1000) / 1024,
    perPacketMs: totalMs / expectedPackets,
  };
}

async function main() {
  console.log(`\n=== SDS Pipeline-Depth Sweep (Phase 3.3 / task #26) ===`);
  console.log(`Bridge: ${BRIDGE_URL}`);
  console.log(`Sample size: ${SAMPLE_COUNT} samples (${(SAMPLE_COUNT * 2 / 1024).toFixed(1)} KB)`);
  console.log(`batch_size: ${BATCH_SIZE} (Phase 3.2 optimum)`);
  console.log(`Baseline: 2.91 KB/s @ depth=1 (per sds-baseline.md)`);
  console.log(`Target: 8 KB/s ship, 15 KB/s aspirational (per #315)`);
  console.log(``);

  // Sweep pipeline depths. Slot rotation to avoid collisions.
  const depths = [1, 2, 3, 4, 6, 8];
  const results: SweepResult[] = [];

  for (let i = 0; i < depths.length; i++) {
    const d = depths[i];
    const slot = 70 + i;
    console.log(`Running pipeline_depth=${d} → slot ${slot}...`);
    try {
      const r = await runOne(d, slot);
      results.push(r);
      console.log(`  ${r.totalMs.toFixed(0)}ms, ${r.throughputKBs.toFixed(2)} KB/s, ${r.perPacketMs.toFixed(2)}ms/packet\n`);
    } catch (err) {
      console.error(`  FAILED: ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }

  console.log(`=== Sweep Report ===\n`);
  console.log(`| pipeline_depth | total_ms | KB/s | ms/packet | speedup |`);
  console.log(`|----------------|----------|------|-----------|---------|`);
  const baseline = results.find(r => r.pipelineDepth === 1);
  for (const r of results) {
    const speedup = baseline ? (r.throughputKBs / baseline.throughputKBs).toFixed(2) : '?';
    console.log(`| ${String(r.pipelineDepth).padStart(14)} | ${r.totalMs.toFixed(0).padStart(8)} | ${r.throughputKBs.toFixed(2).padStart(4)} | ${r.perPacketMs.toFixed(2).padStart(9)} | ${speedup.padStart(7)}x |`);
  }
  console.log();

  const best = results.reduce((a, b) => b.throughputKBs > a.throughputKBs ? b : a, results[0]);
  console.log(`Best: pipeline_depth=${best.pipelineDepth} at ${best.throughputKBs.toFixed(2)} KB/s`);
  if (best.throughputKBs >= 8) {
    console.log(`Hit ship target (8 KB/s) — proceed to Phase 3.5 hardware verification.`);
  } else if (best.throughputKBs >= 4) {
    console.log(`Above plateau threshold but below ship target. Continue to Phase 3.4 (skip per-packet ACK).`);
  } else {
    console.log(`Below plateau threshold (4 KB/s). Reopen strategic conversation per #315.`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
