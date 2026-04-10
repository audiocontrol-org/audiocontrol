/**
 * Drum kit import test — send slices via SDS, rename, create program + keygroups.
 *
 * Exercises the same device operations as importDrumKitToDevice() from the
 * S3K editor, but directly against the client API without browser/OPFS.
 *
 * The transfer is staged to avoid SDS↔SysEx interleaving:
 *   1. Send all slices via SDS (back-to-back, no SysEx between them)
 *   2. Verify all arrived via RSLIST
 *   3. Rename each slice via SysEx (RSDATA + SDATA)
 *   4. Create program via SysEx
 *   5. Create keygroups via SysEx
 *   6. Verify everything by reading back
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';
import WebSocket from 'ws';
import {
  ProgramHeader_writePRNAME,
  KeygroupHeader_writeLONOTE,
  KeygroupHeader_writeHINOTE,
  KeygroupHeader_writeSNAME1,
  KeygroupHeader_writeLOVEL1,
  KeygroupHeader_writeHIVEL1,
  KeygroupHeader_writeZPLAY1,
  ProgramHeader_writeGROUPS,
  SampleHeader_writeSHNAME,
} from '@audiocontrol/sampler-devices/s3k';

function generateSliceAudio(sliceIndex: number, samplesPerSlice: number, sampleRate: number): Int16Array {
  const samples = new Int16Array(samplesPerSlice);
  const amplitude = 8000 + sliceIndex * 2000;
  for (let i = 0; i < samplesPerSlice; i++) {
    samples[i] = Math.round(amplitude * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
  }
  return samples;
}

function sendRawSds(
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
        reject(new Error(`SDS error for sample ${sampleNumber}: ${msg.error}`));
      }
    });

    ws.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(new Error(`WS error for sample ${sampleNumber}: ${err.message}`));
    });
  });
}

export async function runDrumKitTests(ctx: TestContext): Promise<TestResult[]> {
  return [await testDrumKitImport(ctx)];
}

async function testDrumKitImport(ctx: TestContext): Promise<TestResult> {
  const name = 'drumkit-import';
  try {
    const SLICE_COUNT = 4;
    const BASE_NOTE = 36; // C2
    const SAMPLE_RATE = 44100;
    const SAMPLES_PER_SLICE = 200;
    const KIT_NAME = 'E2EKIT';
    const SLICE_NAMES = ['KICK', 'SNARE', 'HIHAT', 'CLAP'];

    // Snapshot device state
    const samplesBefore = await ctx.client.fetchSampleNames();
    const programsBefore = await ctx.client.fetchProgramNames();
    ctx.log(`  Before: ${samplesBefore.length} samples, ${programsBefore.length} programs`);

    if (programsBefore.length === 0) {
      return {
        name,
        status: 'SKIP',
        detail: 'No existing programs to use as template — device needs at least one program',
      };
    }

    // ---------------------------------------------------------------
    // Stage 1: Send all slices via SDS (no SysEx between them)
    // ---------------------------------------------------------------
    const startSlot = samplesBefore.length;
    for (let i = 0; i < SLICE_COUNT; i++) {
      const sliceAudio = generateSliceAudio(i, SAMPLES_PER_SLICE, SAMPLE_RATE);
      ctx.log(`  SDS ${i + 1}/${SLICE_COUNT}: slot ${startSlot + i}`);
      await sendRawSds(ctx.bridgeUrl, startSlot + i, SAMPLE_RATE, sliceAudio, ctx.log);
    }
    ctx.log(`  All ${SLICE_COUNT} SDS uploads complete`);

    // ---------------------------------------------------------------
    // Stage 2: Verify all arrived via RSLIST
    // ---------------------------------------------------------------
    const samplesAfterSds = await ctx.client.refreshSampleNames();
    ctx.log(`  RSLIST: ${samplesAfterSds.length} samples (expected ${startSlot + SLICE_COUNT})`);
    if (samplesAfterSds.length < startSlot + SLICE_COUNT) {
      return {
        name,
        status: 'FAIL',
        detail: `Expected ${startSlot + SLICE_COUNT} samples, got ${samplesAfterSds.length}`,
      };
    }

    // ---------------------------------------------------------------
    // Stage 3: Rename each slice via SysEx
    // ---------------------------------------------------------------
    for (let i = 0; i < SLICE_COUNT; i++) {
      const idx = startSlot + i;
      ctx.log(`  Renaming sample ${idx} to "${SLICE_NAMES[i]}"...`);
      const header = await ctx.client.fetchSampleHeader(idx);
      header.SHNAME = SLICE_NAMES[i];
      SampleHeader_writeSHNAME(header, SLICE_NAMES[i]);
      await ctx.client.writeSampleHeader(header);
    }

    // Verify names
    ctx.client.invalidateSampleCache();
    const namesAfterRename = await ctx.client.fetchSampleNames();
    for (let i = 0; i < SLICE_COUNT; i++) {
      const actual = namesAfterRename[startSlot + i]?.trim();
      ctx.log(`  Slot ${startSlot + i}: "${actual}" (expected "${SLICE_NAMES[i]}")`);
      if (actual !== SLICE_NAMES[i]) {
        return {
          name,
          status: 'FAIL',
          detail: `Slice ${i} name mismatch: expected "${SLICE_NAMES[i]}", got "${actual}"`,
        };
      }
    }

    // ---------------------------------------------------------------
    // Stage 4: Create program
    // ---------------------------------------------------------------
    const programIndex = programsBefore.length;
    ctx.log(`  Creating program "${KIT_NAME}" at index ${programIndex}...`);

    const templateProgram = await ctx.client.fetchProgramHeader(0);
    const programHeader = { ...templateProgram, raw: [...templateProgram.raw] };
    ProgramHeader_writePRNAME(programHeader, KIT_NAME);
    ProgramHeader_writeGROUPS(programHeader, SLICE_COUNT);
    await ctx.client.createProgram(programIndex, programHeader);

    ctx.client.invalidateProgramCache();
    const programsAfter = await ctx.client.fetchProgramNames();
    ctx.log(`  Programs: ${programsAfter.length} (expected ${programsBefore.length + 1})`);
    if (programsAfter.length !== programsBefore.length + 1) {
      return {
        name,
        status: 'FAIL',
        detail: `Expected ${programsBefore.length + 1} programs, got ${programsAfter.length}`,
      };
    }

    // ---------------------------------------------------------------
    // Stage 5: Create keygroups
    // ---------------------------------------------------------------
    const templateKeygroup = await ctx.client.fetchKeygroupHeader(programIndex, 0);

    for (let i = 0; i < SLICE_COUNT; i++) {
      const midiNote = Math.max(21, Math.min(127, BASE_NOTE + i));
      const sampleName = namesAfterRename[startSlot + i];

      ctx.log(`  KG ${i}: note=${midiNote}, sample="${sampleName?.trim()}"`);

      const kgHeader = { ...templateKeygroup, raw: [...templateKeygroup.raw] };
      KeygroupHeader_writeLONOTE(kgHeader, midiNote);
      KeygroupHeader_writeHINOTE(kgHeader, midiNote);
      KeygroupHeader_writeSNAME1(kgHeader, sampleName);
      KeygroupHeader_writeLOVEL1(kgHeader, 0);
      KeygroupHeader_writeHIVEL1(kgHeader, 127);
      KeygroupHeader_writeZPLAY1(kgHeader, 4);

      if (i === 0) {
        await ctx.client.writeKeygroupHeader(kgHeader);
      } else {
        await ctx.client.createKeygroup(programIndex, i, kgHeader);
      }
    }

    // ---------------------------------------------------------------
    // Stage 6: Verify keygroups by reading back
    // ---------------------------------------------------------------
    ctx.client.invalidateKeygroupCache();
    for (let i = 0; i < SLICE_COUNT; i++) {
      const readback = await ctx.client.fetchKeygroupHeader(programIndex, i);
      const expectedNote = Math.max(21, Math.min(127, BASE_NOTE + i));
      ctx.log(`  Verify KG ${i}: LONOTE=${readback.LONOTE}, HINOTE=${readback.HINOTE}, SNAME1="${readback.SNAME1?.trim()}"`);

      if (readback.LONOTE !== expectedNote || readback.HINOTE !== expectedNote) {
        return {
          name,
          status: 'FAIL',
          detail: `KG ${i} note range: expected ${expectedNote}-${expectedNote}, got ${readback.LONOTE}-${readback.HINOTE}`,
        };
      }
    }

    // Cleanup
    if (!ctx.noRestore) {
      ctx.log(`  Cleaning up...`);
      try {
        await ctx.client.deleteProgram(programIndex);
      } catch (err) {
        ctx.log(`  Warning: could not delete program: ${err}`);
      }
      for (let i = SLICE_COUNT - 1; i >= 0; i--) {
        try {
          await ctx.client.deleteSample(startSlot + i);
        } catch (err) {
          ctx.log(`  Warning: could not delete sample ${startSlot + i}: ${err}`);
        }
      }
    }

    return {
      name,
      status: 'PASS',
      detail: `${SLICE_COUNT} slices sent + renamed, program + ${SLICE_COUNT} keygroups created and verified`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
