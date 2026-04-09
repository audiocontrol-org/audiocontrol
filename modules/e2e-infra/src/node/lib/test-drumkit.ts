/**
 * Drum kit import test — send slices via SDS, create program + keygroups, verify.
 *
 * Exercises the same device operations as importDrumKitToDevice() from the
 * S3K editor, but directly against the client API without browser/OPFS.
 * This isolates device communication issues from UI issues.
 */

import type { TestContext, TestResult } from '@/node/lib/test-types.js';
import {
  ProgramHeader_writePRNAME,
  KeygroupHeader_writeLONOTE,
  KeygroupHeader_writeHINOTE,
  KeygroupHeader_writeSNAME1,
  KeygroupHeader_writeLOVEL1,
  KeygroupHeader_writeHIVEL1,
  KeygroupHeader_writeZPLAY1,
  ProgramHeader_writeGROUPS,
} from '@audiocontrol/sampler-devices/s3k';

function generateSliceAudio(sliceIndex: number, samplesPerSlice: number, sampleRate: number): Int16Array {
  const samples = new Int16Array(samplesPerSlice);
  const amplitude = 8000 + sliceIndex * 2000;
  for (let i = 0; i < samplesPerSlice; i++) {
    samples[i] = Math.round(amplitude * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
  }
  return samples;
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

    // Phase 1: Send each slice via SDS
    const sampleSlots: number[] = [];
    let nextSlot = samplesBefore.length;

    for (let i = 0; i < SLICE_COUNT; i++) {
      const sliceAudio = generateSliceAudio(i, SAMPLES_PER_SLICE, SAMPLE_RATE);
      const slotNumber = nextSlot;
      sampleSlots.push(slotNumber);

      ctx.log(`  Sending slice ${i + 1}/${SLICE_COUNT} "${SLICE_NAMES[i]}" to slot ${slotNumber}...`);
      await ctx.client.sendSampleViaSds(slotNumber, sliceAudio, SAMPLE_RATE, {
        name: SLICE_NAMES[i],
        onProgress: (progress) => {
          if (ctx.verbose) {
            ctx.log(`    SDS: ${progress.packetsSent}/${progress.packetsTotal}`);
          }
        },
      });
      nextSlot += 1;
    }

    // Verify all slices arrived
    const samplesAfterSds = await ctx.client.refreshSampleNames();
    ctx.log(`  After SDS: ${samplesAfterSds.length} samples (expected ${samplesBefore.length + SLICE_COUNT})`);
    if (samplesAfterSds.length !== samplesBefore.length + SLICE_COUNT) {
      return {
        name,
        status: 'FAIL',
        detail: `Expected ${samplesBefore.length + SLICE_COUNT} samples, got ${samplesAfterSds.length}`,
      };
    }

    // Verify slice names
    for (let i = 0; i < SLICE_COUNT; i++) {
      const actualName = samplesAfterSds[sampleSlots[i]]?.trim();
      ctx.log(`  Slice ${i} name: "${actualName}" (expected "${SLICE_NAMES[i]}")`);
      if (actualName !== SLICE_NAMES[i]) {
        return {
          name,
          status: 'FAIL',
          detail: `Slice ${i} name mismatch: expected "${SLICE_NAMES[i]}", got "${actualName}"`,
        };
      }
    }

    // Phase 2: Create program
    ctx.log(`  Creating program "${KIT_NAME}" at index ${programsBefore.length}...`);
    const programIndex = programsBefore.length;

    if (programsBefore.length === 0) {
      return {
        name,
        status: 'SKIP',
        detail: 'No existing programs to use as template — device needs at least one program',
      };
    }

    const templateProgram = await ctx.client.fetchProgramHeader(0);
    const programHeader = { ...templateProgram, raw: [...templateProgram.raw] };
    ProgramHeader_writePRNAME(programHeader, KIT_NAME);
    ProgramHeader_writeGROUPS(programHeader, SLICE_COUNT);
    await ctx.client.createProgram(programIndex, programHeader);

    // Verify program was created
    ctx.client.invalidateProgramCache();
    const programsAfter = await ctx.client.fetchProgramNames();
    ctx.log(`  After createProgram: ${programsAfter.length} programs (expected ${programsBefore.length + 1})`);
    if (programsAfter.length !== programsBefore.length + 1) {
      return {
        name,
        status: 'FAIL',
        detail: `Expected ${programsBefore.length + 1} programs, got ${programsAfter.length}`,
      };
    }
    const createdProgramName = programsAfter[programIndex]?.trim();
    ctx.log(`  Program name: "${createdProgramName}"`);

    // Phase 3: Create keygroups
    const templateKeygroup = await ctx.client.fetchKeygroupHeader(programIndex, 0);

    for (let i = 0; i < SLICE_COUNT; i++) {
      const midiNote = Math.max(21, Math.min(127, BASE_NOTE + i));
      const sampleName = samplesAfterSds[sampleSlots[i]];

      ctx.log(`  Keygroup ${i}: note=${midiNote}, sample="${sampleName?.trim()}"`);

      const kgHeader = { ...templateKeygroup, raw: [...templateKeygroup.raw] };
      KeygroupHeader_writeLONOTE(kgHeader, midiNote);
      KeygroupHeader_writeHINOTE(kgHeader, midiNote);
      KeygroupHeader_writeSNAME1(kgHeader, sampleName);
      KeygroupHeader_writeLOVEL1(kgHeader, 0);
      KeygroupHeader_writeHIVEL1(kgHeader, 127);
      KeygroupHeader_writeZPLAY1(kgHeader, 4); // play to end (one-shot)

      if (i === 0) {
        await ctx.client.writeKeygroupHeader(kgHeader);
      } else {
        await ctx.client.createKeygroup(programIndex, i, kgHeader);
      }
    }

    // Phase 4: Verify keygroups by reading them back
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

    // Cleanup: delete the test program and samples
    if (!ctx.noRestore) {
      ctx.log(`  Cleaning up: deleting program ${programIndex}...`);
      try {
        await ctx.client.deleteProgram(programIndex);
      } catch (err) {
        ctx.log(`  Warning: could not delete program: ${err}`);
      }
      for (let i = SLICE_COUNT - 1; i >= 0; i--) {
        try {
          await ctx.client.deleteSample(sampleSlots[i]);
          ctx.log(`  Deleted sample ${sampleSlots[i]}`);
        } catch (err) {
          ctx.log(`  Warning: could not delete sample ${sampleSlots[i]}: ${err}`);
        }
      }
    }

    return {
      name,
      status: 'PASS',
      detail: `${SLICE_COUNT} slices sent, program + ${SLICE_COUNT} keygroups created and verified`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  }
}
