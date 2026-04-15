/**
 * Program export + promotion test.
 *
 * Tests the full pipeline from device to common-area ProgramYaml:
 *   1. Fetch program header + keygroups from device via SysEx
 *   2. Convert to common-area format via akaiProgramToCommon
 *   3. Write to filesystem via NodeDirectoryHandle
 *   4. Read back and verify ProgramYaml structure
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';
import type { TestContext, TestResult } from '#node/lib/test-types.js';
import {
  akaiProgramToCommon,
  type AkaiDiskProgram,
  type AkaiDiskKeygroup,
} from '@audiocontrol/sampler-devices/s3k';
import { createNodeStorage } from '@audiocontrol/sampler-library/testing';

export async function runProgramExportTests(ctx: TestContext): Promise<TestResult[]> {
  return [await testProgramExportToCommonArea(ctx)];
}

async function testProgramExportToCommonArea(ctx: TestContext): Promise<TestResult> {
  const name = 'program-export-to-common-area';
  let tempDir: string | undefined;

  try {
    // Step 1: Fetch program header from device
    const programNames = await ctx.client.fetchProgramNames();
    if (programNames.length === 0) {
      return { name, status: 'SKIP', detail: 'No programs on device' };
    }

    const programIndex = 0;
    const programHeader = await ctx.client.fetchProgramHeader(programIndex);
    const programName = programHeader.PRNAME.trim();
    ctx.log(`  Program ${programIndex}: "${programName}", GROUPS=${programHeader.GROUPS}`);

    // Step 2: Fetch all keygroups
    const keygroupCount = programHeader.GROUPS;
    const keygroups: AkaiDiskKeygroup[] = [];
    for (let i = 0; i < keygroupCount; i++) {
      const kg = await ctx.client.fetchKeygroupHeader(programIndex, i);
      ctx.log(`  KG ${i}: LONOTE=${kg.LONOTE}, HINOTE=${kg.HINOTE}, SNAME1="${kg.SNAME1?.trim()}"`);

      // Build AkaiDiskKeygroup from device header
      const sampleNames: string[] = [];
      if (kg.SNAME1?.trim()) sampleNames.push(kg.SNAME1.trim());
      if (kg.SNAME2?.trim()) sampleNames.push(kg.SNAME2.trim());
      if (kg.SNAME3?.trim()) sampleNames.push(kg.SNAME3.trim());
      if (kg.SNAME4?.trim()) sampleNames.push(kg.SNAME4.trim());

      keygroups.push({
        lowNote: kg.LONOTE,
        highNote: kg.HINOTE,
        sampleNames,
        rawData: new Uint8Array(0),
      });
    }

    // Step 3: Convert to common-area program
    const akaiProgram: AkaiDiskProgram = {
      name: programName,
      midiProgramNumber: 0,
      midiChannel: 0,
      polyphony: programHeader.POLYPH ?? 1,
      numKeygroups: keygroups.length,
      keygroups,
      rawProgramHeader: new Uint8Array(0),
    };

    const commonProgram = akaiProgramToCommon(akaiProgram);
    ctx.log(`  Common program: ${commonProgram.zones.length} zones, polyphony="${commonProgram.polyphony}"`);

    // Verify zones match keygroups
    if (commonProgram.zones.length === 0 && keygroups.length > 0) {
      return {
        name,
        status: 'FAIL',
        detail: `Conversion produced 0 zones from ${keygroups.length} keygroups`,
      };
    }

    // Step 4: Write to filesystem via node storage adapter
    tempDir = await mkdtemp(join(tmpdir(), 'e2e-program-export-'));
    const storageRoot = await createNodeStorage(tempDir);

    // Create common-area directory structure
    const libraryDir = await storageRoot.getDirectoryHandle('library', { create: true });
    const commonDir = await libraryDir.getDirectoryHandle('common', { create: true });
    const samplesDir = await commonDir.getDirectoryHandle('samples', { create: true });
    const programDir = await samplesDir.getDirectoryHandle(programName, { create: true });

    // Write program.yaml
    const programYaml = {
      ...commonProgram,
      name: programName,
    };
    const yamlHandle = await programDir.getFileHandle('program.yaml', { create: true });
    const yamlWritable = await yamlHandle.createWritable();
    await yamlWritable.write(stringifyYaml(programYaml, { indent: 2 }));
    await yamlWritable.close();

    // Step 5: Read back and verify
    const readHandle = await programDir.getFileHandle('program.yaml');
    const readFile = await readHandle.getFile();
    const readContent = await readFile.text();
    const parsed = parseYaml(readContent) as Record<string, unknown>;

    ctx.log(`  Written to: ${tempDir}/library/common/samples/${programName}/program.yaml`);
    ctx.log(`  Read back: format="${parsed.format}", zones=${(parsed.zones as unknown[])?.length}`);

    if (parsed.format !== 'program') {
      return { name, status: 'FAIL', detail: `Expected format "program", got "${parsed.format}"` };
    }
    if (parsed.version !== 1) {
      return { name, status: 'FAIL', detail: `Expected version 1, got ${parsed.version}` };
    }

    const zones = parsed.zones as unknown[];
    if (!zones || zones.length === 0) {
      return { name, status: 'FAIL', detail: 'No zones in program.yaml' };
    }

    // Verify each zone has required fields (CommonZone schema)
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i] as Record<string, unknown>;
      if (typeof zone.sample !== 'string' || zone.sample.length === 0) {
        return { name, status: 'FAIL', detail: `Zone ${i} missing sample` };
      }
      const keyRange = zone.keyRange as number[] | undefined;
      const rangeStr = keyRange ? `${keyRange[0]}-${keyRange[1]}` : 'none';
      ctx.log(`  Zone ${i}: keyRange=${rangeStr}, sample="${zone.sample}"`);
    }

    return {
      name,
      status: 'PASS',
      detail: `Program "${programName}" → ${zones.length} zones exported to common area`,
    };
  } catch (err) {
    return { name, status: 'ERROR', detail: String(err) };
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
