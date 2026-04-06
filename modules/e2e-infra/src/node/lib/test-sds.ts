/**
 * SDS round-trip test — send a known sample, receive it back, compare.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';

function generateSineWave(length: number, sampleRate: number, freqHz: number): Int16Array {
  const samples = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    samples[i] = Math.round(32767 * Math.sin((2 * Math.PI * freqHz * i) / sampleRate));
  }
  return samples;
}

export async function runSdsTests(ctx: TestContext): Promise<TestResult[]> {
  return [await testSdsRoundTrip(ctx)];
}

async function testSdsRoundTrip(ctx: TestContext): Promise<TestResult> {
  const name = 'sds-round-trip';
  try {
    const sampleNames = await ctx.client.fetchSampleNames();
    const sampleNumber = sampleNames.length;
    ctx.log(`  Using sample slot ${sampleNumber} (current count: ${sampleNames.length})`);

    const sampleRate = 44100;
    const testSamples = generateSineWave(256, sampleRate, 440);
    ctx.log(`  Generated ${testSamples.length}-sample sine wave (440Hz @ ${sampleRate}Hz)`);

    ctx.log(`  Sending sample via SDS...`);
    await ctx.client.sendSampleViaSds(sampleNumber, testSamples, sampleRate, {
      onProgress: (progress) => {
        if (ctx.verbose) {
          ctx.log(`    SDS send: packet ${progress.currentPacket}/${progress.totalPackets}`);
        }
      },
    });
    ctx.log(`  Send complete`);

    ctx.log(`  Receiving sample via SDS...`);
    const received = await ctx.client.receiveSampleViaSds(sampleNumber, (progress) => {
      if (ctx.verbose) {
        ctx.log(`    SDS receive: packet ${progress.currentPacket}/${progress.totalPackets}`);
      }
    });
    ctx.log(`  Receive complete: ${received.samples.length} samples`);

    if (received.samples.length !== testSamples.length) {
      return {
        name,
        status: 'FAIL',
        detail: `Length mismatch: sent ${testSamples.length}, received ${received.samples.length}`,
      };
    }

    let maxDiff = 0;
    let diffCount = 0;
    for (let i = 0; i < testSamples.length; i++) {
      const diff = Math.abs(testSamples[i] - received.samples[i]);
      if (diff > maxDiff) maxDiff = diff;
      if (diff > 1) diffCount++;
    }

    ctx.log(`  Max sample diff: ${maxDiff}, samples with diff > 1: ${diffCount}/${testSamples.length}`);

    if (!ctx.noRestore) {
      try {
        await ctx.client.deleteSample(sampleNumber);
        ctx.log(`  Cleaned up test sample at slot ${sampleNumber}`);
      } catch (err) {
        ctx.log(`  Warning: could not delete test sample: ${err}`);
      }
    }

    if (diffCount === 0) {
      return { name, status: 'PASS', detail: `${testSamples.length} samples match (max diff: ${maxDiff})` };
    } else if (maxDiff < 16) {
      return { name, status: 'PASS', detail: `${testSamples.length} samples, ${diffCount} with minor rounding (max diff: ${maxDiff})` };
    } else {
      return { name, status: 'FAIL', detail: `${diffCount}/${testSamples.length} samples differ significantly (max diff: ${maxDiff})` };
    }
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
