/**
 * Exploratory test: can we send multiple SDS samples back-to-back
 * without any SysEx in between?
 *
 * Uses the bridge WebSocket directly — no S3K client, no RSLIST polls,
 * no renames. Just raw SDS transfers to see if the device accepts them.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';
import WebSocket from 'ws';

function generateSineWave(length: number, freq: number, sampleRate: number): Int16Array {
  const samples = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.round(16000 * Math.sin((2 * Math.PI * freq * i) / sampleRate));
  }
  return samples;
}

function sendOneSample(
  bridgeUrl: string,
  sampleNumber: number,
  sampleRate: number,
  samples: Int16Array,
  log: (msg: string) => void,
): Promise<void> {
  const wsUrl = bridgeUrl.replace(/^http/, 'ws') + '/sds/stream';

  return new Promise<void>((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`SDS upload timed out for sample ${sampleNumber}`));
    }, 60_000);

    ws.on('open', () => {
      log(`    WS open, sending sample ${sampleNumber} (${samples.length} samples)`);
      ws.send(JSON.stringify({
        type: 'sample-upload',
        target_id: 6,
        sample_number: sampleNumber,
        channel: 0,
        sample_rate: sampleRate,
        samples: Array.from(samples),
      }));
    });

    ws.on('message', (data: Buffer) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'upload-complete') {
        clearTimeout(timeout);
        ws.close();
        log(`    Sample ${sampleNumber} upload complete`);
        resolve();
      } else if (msg.type === 'upload-error') {
        clearTimeout(timeout);
        ws.close();
        reject(new Error(`SDS upload error for sample ${sampleNumber}: ${msg.error}`));
      }
    });

    ws.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error for sample ${sampleNumber}: ${err.message}`));
    });
  });
}

export async function runMultiSdsTests(ctx: TestContext): Promise<TestResult[]> {
  return [await testMultiSdsSend(ctx)];
}

async function testMultiSdsSend(ctx: TestContext): Promise<TestResult> {
  const name = 'multi-sds-send';
  const SLICE_COUNT = 4;
  const SAMPLE_RATE = 44100;
  const SAMPLES_PER_SLICE = 200;

  try {
    // Get current sample count so we know what slot numbers to use
    const sampleNames = await ctx.client.fetchSampleNames();
    const startSlot = sampleNames.length;
    ctx.log(`  Device has ${startSlot} samples, will send to slots ${startSlot}-${startSlot + SLICE_COUNT - 1}`);

    // Send all 4 samples back-to-back via SDS, no SysEx in between
    for (let i = 0; i < SLICE_COUNT; i++) {
      const slotNumber = startSlot + i;
      const audio = generateSineWave(SAMPLES_PER_SLICE, 440 + i * 100, SAMPLE_RATE);
      ctx.log(`  Sending sample ${i + 1}/${SLICE_COUNT} to slot ${slotNumber}...`);
      await sendOneSample(ctx.bridgeUrl, slotNumber, SAMPLE_RATE, audio, ctx.log);
    }

    ctx.log(`  All ${SLICE_COUNT} SDS uploads complete. Now checking RSLIST...`);

    // NOW do SysEx: check if all samples arrived
    const namesAfter = await ctx.client.refreshSampleNames();
    ctx.log(`  Sample count after: ${namesAfter.length} (expected ${startSlot + SLICE_COUNT})`);

    if (namesAfter.length < startSlot + SLICE_COUNT) {
      return {
        name,
        status: 'FAIL',
        detail: `Expected ${startSlot + SLICE_COUNT} samples, got ${namesAfter.length}`,
      };
    }

    // Log the names the device assigned
    for (let i = 0; i < SLICE_COUNT; i++) {
      const assignedName = namesAfter[startSlot + i]?.trim() ?? '(missing)';
      ctx.log(`  Slot ${startSlot + i}: "${assignedName}"`);
    }

    // Cleanup
    if (!ctx.noRestore) {
      for (let i = SLICE_COUNT - 1; i >= 0; i--) {
        try {
          await ctx.client.deleteSample(startSlot + i);
          ctx.log(`  Deleted sample ${startSlot + i}`);
        } catch (err) {
          ctx.log(`  Warning: could not delete sample ${startSlot + i}: ${err}`);
        }
      }
    }

    return {
      name,
      status: 'PASS',
      detail: `${SLICE_COUNT} samples sent back-to-back, all arrived on device`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
