/**
 * S3K program promotion: device-specific library -> common area.
 *
 * Converts a stored S3K program (Zone 3) to a common-area program
 * bundle (Zone 4) by mapping keygroups to zones via the existing
 * akai-to-common converter, then copying referenced sample WAVs.
 *
 * Handles both SysEx-origin (s3000xl-program) and disk-origin
 * (s3000xl-disk-program) formats -- both store the same keygroup
 * fields needed for conversion.
 *
 * See SAMPLER-LIBRARY.md for the four-zone storage model.
 */

import { stringify as stringifyYaml } from 'yaml';
import type { StorageDirectoryHandle } from '@audiocontrol/sampler-library/browser';
import {
  akaiProgramToCommon,
  type CommonProgram,
} from '@audiocontrol/sampler-devices/s3k';
import type { AkaiDiskProgram, AkaiDiskKeygroup } from '@audiocontrol/sampler-devices/s3k';
import {
  loadProgramFromLibrary,
} from '@/lib/program-storage';
import {
  detectProgramFormat,
  deserializeProgram,
  deserializeDiskProgram,
} from '@/lib/program-serialization';
import {
  sanitizeForFilename,
  getNestedDirectory,
} from '@audiocontrol/sampler-library/browser';

// =========================================================================
// Adapter: serialized keygroups -> AkaiDiskKeygroup[]
// =========================================================================

/**
 * Map stored human-readable keygroup fields to the AkaiDiskKeygroup
 * interface expected by akaiProgramToCommon().
 *
 * Both SerializedProgram and SerializedDiskProgram store keygroups
 * with the same shape: { lowNote, highNote, sampleNames }.
 */
function serializedKeygroupsToAkai(
  keygroups: Record<string, unknown>[],
): AkaiDiskKeygroup[] {
  return keygroups.map((kg) => {
    // Extract sample names -- may be stored as sampleNames array or SNAME1-4 fields
    let sampleNames: string[];
    if (Array.isArray(kg.sampleNames)) {
      sampleNames = (kg.sampleNames as string[]).map((n) => String(n).trim());
    } else {
      // SysEx-origin programs store as SNAME1-4 fields
      sampleNames = [];
      for (const field of ['SNAME1', 'SNAME2', 'SNAME3', 'SNAME4']) {
        const name = kg[field];
        if (typeof name === 'string' && name.trim().length > 0) {
          sampleNames.push(name.trim());
        }
      }
    }

    return {
      lowNote: typeof kg.lowNote === 'number' ? kg.lowNote : (typeof kg.LNOTE === 'number' ? kg.LNOTE : 0),
      highNote: typeof kg.highNote === 'number' ? kg.highNote : (typeof kg.HNOTE === 'number' ? kg.HNOTE : 127),
      sampleNames,
      rawData: new Uint8Array(0), // Not needed for conversion
    };
  });
}

/**
 * Build an AkaiDiskProgram from a serialized program's metadata.
 */
function buildAkaiDiskProgram(
  name: string,
  keygroups: Record<string, unknown>[],
  polyphony: number,
): AkaiDiskProgram {
  const akaiKeygroups = serializedKeygroupsToAkai(keygroups);
  return {
    name,
    midiProgramNumber: 0,
    midiChannel: 0,
    polyphony,
    numKeygroups: akaiKeygroups.length,
    keygroups: akaiKeygroups,
    rawProgramHeader: new Uint8Array(0),
  };
}

// =========================================================================
// Promotion
// =========================================================================

/**
 * Extract program metadata from a serialized program (either format).
 */
function extractProgramData(yamlContent: string): {
  name: string;
  keygroups: Record<string, unknown>[];
  polyphony: number;
  sampleReferences: string[];
} {
  const format = detectProgramFormat(yamlContent);
  console.log('[promoteToCommonArea] Detected program format:', format);

  if (format === 's3000xl-disk-program') {
    const disk = deserializeDiskProgram(yamlContent);
    const prog = disk.program as { polyphony?: number };
    return {
      name: disk.name,
      keygroups: disk.keygroups,
      polyphony: typeof prog.polyphony === 'number' ? prog.polyphony : 1,
      sampleReferences: disk.sampleReferences,
    };
  }

  if (format === 's3000xl-program') {
    const sysex = deserializeProgram(yamlContent);
    const prog = sysex.program as { POLYPH?: number };
    return {
      name: sysex.name,
      keygroups: sysex.keygroups,
      polyphony: typeof prog.POLYPH === 'number' ? prog.POLYPH : 1,
      sampleReferences: sysex.sampleReferences,
    };
  }

  throw new Error(`Unknown program format in YAML (format field not recognized)`);
}

/**
 * Promote an S3K device-specific program to the common area.
 *
 * Reads the program from library/s3k/programs/{programDirName}/,
 * converts keygroups to zones via akaiProgramToCommon(), copies
 * sample WAVs, and saves a ProgramYaml bundle to
 * library/common/programs/{targetName}/.
 *
 * @param libraryRoot - Library root directory handle
 * @param programDirName - Directory name in library/s3k/programs/
 * @param targetName - Name for the common-area program (defaults to program name)
 * @returns The CommonProgram that was saved
 */

/**
 * Save a program from device SysEx headers directly to the common area.
 *
 * Converts keygroup headers to the device-agnostic zone format and
 * saves as program.yaml in library/common/programs/. Caller is responsible
 * for receiving and saving sample WAVs into the program directory.
 */
export async function saveDeviceProgramToCommonArea(
  libraryRoot: StorageDirectoryHandle,
  programName: string,
  keygroupHeaders: Record<string, unknown>[],
  polyphony: number,
): Promise<{ programDir: StorageDirectoryHandle; sampleRefs: string[] }> {
  // Convert device headers to common format
  const akaiProgram = buildAkaiDiskProgram(programName, keygroupHeaders, polyphony);
  const commonProgram = akaiProgramToCommon(akaiProgram);

  const outputName = programName.trim();
  const safeName = sanitizeForFilename(outputName);

  // Create common-area program directory
  const programsDir = await getNestedDirectory(libraryRoot, ['library', 'common', 'programs']);
  const programDir = await programsDir.getDirectoryHandle(safeName, { create: true });

  // Save program.yaml
  const programYaml = { ...commonProgram, name: outputName };
  const yamlHandle = await programDir.getFileHandle('program.yaml', { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(stringifyYaml(programYaml, { indent: 2, lineWidth: 120 }));
  await yamlWritable.close();

  // Return the dir handle and sample references so caller can save WAVs
  const sampleRefs = akaiProgram.keygroups.flatMap((kg) => kg.sampleNames.filter((n) => n.length > 0));
  return { programDir, sampleRefs: [...new Set(sampleRefs)] };
}

export async function promoteToCommonArea(
  libraryRoot: StorageDirectoryHandle,
  programDirName: string,
  targetName?: string,
): Promise<CommonProgram> {
  console.log('[promoteToCommonArea] Starting promotion for:', programDirName);

  // 1. Load the serialized program
  let yamlContent: string;
  try {
    yamlContent = await loadProgramFromLibrary(libraryRoot, programDirName);
  } catch (err) {
    console.error('[promoteToCommonArea] Failed to load program from library:', programDirName, err);
    throw new Error(`Cannot load program "${programDirName}" from S3K library: ${err instanceof Error ? err.message : String(err)}`);
  }

  let data: ReturnType<typeof extractProgramData>;
  try {
    data = extractProgramData(yamlContent);
  } catch (err) {
    console.error('[promoteToCommonArea] Failed to parse program YAML:', err);
    throw new Error(`Cannot parse program "${programDirName}": ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('[promoteToCommonArea] Program data extracted:', data.name, 'keygroups:', data.keygroups.length, 'samples:', data.sampleReferences.length);

  // 2. Convert to common-area program via existing converter
  const akaiProgram = buildAkaiDiskProgram(data.name, data.keygroups, data.polyphony);
  const commonProgram = akaiProgramToCommon(akaiProgram);

  // Use target name or program's own name
  const outputName = targetName ?? data.name.trim();
  const safeName = sanitizeForFilename(outputName);

  // 3. Create the common-area program directory
  const commonProgramsDir = await getNestedDirectory(libraryRoot, ['library', 'common', 'programs']);
  const programDir = await commonProgramsDir.getDirectoryHandle(safeName, { create: true });

  // 4. Save program.yaml
  const programYaml = {
    ...commonProgram,
    name: outputName,
  };
  const yamlHandle = await programDir.getFileHandle('program.yaml', { create: true });
  const yamlWritable = await yamlHandle.createWritable();
  await yamlWritable.write(stringifyYaml(programYaml, { indent: 2, lineWidth: 120 }));
  await yamlWritable.close();

  // 5. Copy sample WAV files from S3K program bundle to common area
  const s3kProgramsDir = await getNestedDirectory(libraryRoot, ['library', 's3k', 'programs']);
  try {
    const s3kProgramDir = await s3kProgramsDir.getDirectoryHandle(programDirName);
    const s3kSamplesDir = await s3kProgramDir.getDirectoryHandle('samples');

    for (const sampleRef of data.sampleReferences) {
      const sampleFileName = `${sanitizeForFilename(sampleRef)}.wav`;
      try {
        const srcHandle = await s3kSamplesDir.getFileHandle(sampleFileName);
        const srcFile = await srcHandle.getFile();
        const wavData = await srcFile.arrayBuffer();

        const dstHandle = await programDir.getFileHandle(sampleFileName, { create: true });
        const dstWritable = await dstHandle.createWritable();
        await dstWritable.write(wavData);
        await dstWritable.close();
        console.log('[promoteToCommonArea] Copied sample:', sampleRef);
      } catch {
        // Sample not in bundle -- zone will reference it but file won't be present.
        // This is expected when programs were exported without "include samples".
        console.warn(`[promoteToCommonArea] Sample "${sampleRef}" not found in S3K program bundle`);
      }
    }
  } catch {
    // No samples directory -- program was exported without samples
    console.warn(`[promoteToCommonArea] No samples directory in S3K program bundle "${programDirName}"`);
  }

  console.log('[promoteToCommonArea] Promotion complete:', outputName);
  return commonProgram;
}
